'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthMember, parseInput } from '@/lib/auth-helpers'
import { checkRateLimit } from '@/lib/security'
import {
  submitFormSchema,
  getPublicFormSchema,
} from '@/lib/validations'
import { parseFormSchema, validateAnswers } from '@/lib/forms-schema'
import {
  parseClientIp,
  escapeLike,
  pickMemberForEmail,
  deriveSubmitterEmail,
} from '@/lib/forms-logic'
import { renderFormEmail, formDedupeKey } from '@/lib/notifications-logic'
import { appBaseUrl } from '@/lib/tenant'
import {
  enqueueNotification,
  resolveMemberContact,
  getSpaceName,
  buildManageUrl,
} from '@/lib/notifications/enqueue'
import type { Json } from '@/types/database'

/**
 * Public submission entry point. Callable by anonymous visitors, signed-in
 * non-members, or members depending on the form's visibility. Reads the form
 * with the service client (anon has no grant on `forms`), enforces visibility
 * and the form schema server-side, snapshots the schema/legal-text/version,
 * and writes the row with the service client (form_submissions has no write
 * policy, so this is the only path in).
 */
export async function submitForm(input: unknown) {
  const v = parseInput(submitFormSchema, input)
  if (!v.ok) return { error: v.error }
  const body = v.data

  const admin = createAdminClient()
  const { data: form } = await admin
    .from('forms')
    .select('id, space_id, slug, title, kind, visibility, status, schema, legal_text, version')
    .eq('id', body.formId)
    .maybeSingle()
  if (!form) return { error: 'Form not found' }
  if (form.status !== 'published') {
    return { error: 'This form is not accepting responses' }
  }

  // Anonymous endpoint with no captcha: bound the DB-bloat abuse vector.
  // Generous per-IP+form window because legitimate public signups at a
  // hackerspace often share one NAT/wifi IP (a captcha is the real control,
  // intentionally deferred). Best-effort IP from the proxy header.
  const rlHdrs = await headers()
  const ip = (rlHdrs.get('x-forwarded-for')?.split(',')[0] ?? '').trim() || 'unknown'
  const rl = checkRateLimit(`form-submit:${ip}:${form.id}`, 20, 60_000)
  if (!rl.allowed) {
    return { error: 'Too many submissions from your network. Please wait a moment and try again.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let linkedMemberId: string | null = null
  let submitterEmail: string | null = body.email ? body.email.toLowerCase() : null

  if (form.visibility === 'members') {
    const member = await getAuthMember(supabase)
    if (!member || member.space_id !== form.space_id) {
      return { error: 'You must be a member of this space to submit this form' }
    }
    linkedMemberId = member.id
    submitterEmail = user?.email?.toLowerCase() ?? submitterEmail
  } else if (form.visibility === 'public_auth') {
    if (!user) return { error: 'You must be signed in to submit this form' }
    const member = await getAuthMember(supabase)
    if (member && member.space_id === form.space_id) linkedMemberId = member.id
    submitterEmail = user.email?.toLowerCase() ?? submitterEmail
  }
  // public_anon: no auth required; submitter_email is whatever was provided.

  if (form.kind === 'waiver' && body.consent !== true) {
    return { error: 'You must agree to the waiver to continue' }
  }

  const fields = parseFormSchema(form.schema)
  const answers = validateAnswers(fields, body.answers)
  if (!answers.ok) return { error: answers.error }

  // If no dedicated submitter email, derive one from an email-type answer so
  // a form that collects email as an ordinary field still links + persists
  // it (otherwise submitter_email stays null and nothing ever matches).
  if (!submitterEmail) {
    submitterEmail = deriveSubmitterEmail(
      fields as Array<{ key: string; type: string }>,
      answers.value,
    )
  }

  // Email-match association. PRODUCT DECISION (2026-05, owner-chosen): link a
  // submission to a member whenever the submitter_email matches a member in
  // the space, INCLUDING raw anonymous public submissions where the email was
  // simply typed. Tradeoff understood and accepted: someone could get a
  // submission attributed to another member by typing that member's email
  // (attribution only -- it grants no access). Do NOT "harden" this back to
  // verified-only without an explicit decision; it is intentional, not a bug.
  if (!linkedMemberId && submitterEmail) {
    const { data: matches } = await admin
      .from('space_members')
      .select('id, joined_at')
      .eq('space_id', form.space_id)
      .ilike('email', escapeLike(submitterEmail))
    linkedMemberId = pickMemberForEmail((matches ?? []) as Array<{ id: string; joined_at: string | null }>)
  }

  const h = await headers()
  const { data: submission, error: insErr } = await admin
    .from('form_submissions')
    .insert({
      form_id: form.id,
      space_id: form.space_id,
      member_id: linkedMemberId,
      submitter_email: submitterEmail,
      answers: answers.value as Json,
      form_snapshot: form.schema,
      legal_text_snapshot: form.legal_text ?? null,
      form_version: form.version,
      ip: parseClientIp(h.get('x-forwarded-for'), h.get('x-real-ip')),
      user_agent: h.get('user-agent'),
    })
    .select('id')
    .single()
  if (insErr || !submission) return { error: insErr?.message ?? 'Submission failed' }

  // Advisory audit. No member context for anon submitters, so write directly.
  await admin.from('activity_log').insert({
    space_id: form.space_id,
    user_id: user?.id ?? null,
    display_name: user?.email ?? 'Anonymous',
    action: 'submitted',
    entity_type: 'form',
    entity_id: form.id,
    details: form.slug,
  })

  // Notifications (best-effort, never throws into this action):
  // 1. Submitter confirmation: ONLY when the submitter is authenticated
  //    (members or public_auth). Recipient is the verified auth email, not
  //    body.email. Anonymous public submissions skip the confirmation, since
  //    a typed email could belong to anyone and confirming to it would be a
  //    spam vector.
  // 2. Admin alert: one row per member who holds forms.manage in the space
  //    (the same gate forms-guard / forms RLS use). Dedupe by (submission,
  //    admin) so a replay is a no-op.
  try {
    const submissionId = submission.id as string
    const spaceName = await getSpaceName(admin, form.space_id)
    const formTitle = (form.title as string | null) ?? form.slug ?? ''

    if (user?.email) {
      const recipientEmail = user.email.toLowerCase()
      const recipientName = linkedMemberId
        ? (await resolveMemberContact(admin, form.space_id, linkedMemberId))?.displayName ?? null
        : null
      const { subject, html, text } = renderFormEmail({
        type: 'form_submission_received',
        spaceName,
        recipientName,
        formTitle,
        manageUrl: buildManageUrl(null),
      })
      await enqueueNotification(admin, {
        spaceId: form.space_id,
        memberId: linkedMemberId,
        type: 'form_submission_received',
        recipient: recipientEmail,
        subject,
        bodyHtml: html,
        bodyText: text,
        dedupeKey: formDedupeKey('form_submission_received', { submissionId }),
      })
    }

    const { data: admins } = await admin.rpc('members_with_permission', {
      sid: form.space_id,
      perm: 'forms.manage',
    })
    const adminMemberIds = Array.from(
      new Set(((admins ?? []) as Array<{ member_id: string }>).map(a => a.member_id)),
    )
    if (adminMemberIds.length > 0) {
      const resultsUrl = `${appBaseUrl()}/forms/${form.id}/results`
      const submitterLabel = await deriveSubmitterLabel(admin, form.space_id, {
        linkedMemberId,
        submitterEmail,
        userEmail: user?.email ?? null,
      })
      for (const adminMemberId of adminMemberIds) {
        const contact = await resolveMemberContact(admin, form.space_id, adminMemberId)
        if (!contact?.email) continue
        const { subject, html, text } = renderFormEmail({
          type: 'form_submission_admin',
          spaceName,
          recipientName: contact.displayName,
          formTitle,
          manageUrl: resultsUrl,
          submitterLabel,
        })
        await enqueueNotification(admin, {
          spaceId: form.space_id,
          memberId: adminMemberId,
          type: 'form_submission_admin',
          recipient: contact.email,
          subject,
          bodyHtml: html,
          bodyText: text,
          dedupeKey: formDedupeKey('form_submission_admin', {
            submissionId,
            adminMemberId,
          }),
        })
      }
    }
  } catch (e) {
    console.error('[submitForm] notifications fan-out failed:', e instanceof Error ? e.message : e)
  }

  return { success: true as const }
}

// Helper: how to label the submitter in an admin alert. Prefer the linked
// member's display name (most informative); fall back to the typed/auth
// email; fall back to "someone" for fully anonymous submissions where the
// typed email is also missing. Best-effort: never throws.
async function deriveSubmitterLabel(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  ids: { linkedMemberId: string | null; submitterEmail: string | null; userEmail: string | null },
): Promise<string> {
  if (ids.linkedMemberId) {
    const contact = await resolveMemberContact(admin, spaceId, ids.linkedMemberId)
    if (contact?.displayName) return contact.displayName
  }
  return ids.userEmail || ids.submitterEmail || 'someone'
}

/**
 * Public read for the /f/[slug] page. Service client (anon has no grant on
 * `forms`). Returns only a published form and only public-safe columns.
 */
export async function getPublicForm(input: unknown) {
  const v = parseInput(getPublicFormSchema, input)
  if (!v.ok) return { error: v.error }

  const admin = createAdminClient()
  const { data: space } = await admin
    .from('spaces')
    .select('id')
    .eq('slug', v.data.space)
    .maybeSingle()
  if (!space) return { error: 'This form is not available.' }

  const { data: form } = await admin
    .from('forms')
    .select('id, slug, title, description, kind, visibility, schema, legal_text, version, status')
    .eq('space_id', space.id)
    .eq('slug', v.data.slug)
    .maybeSingle()

  // Members-only forms are never served on the public page (that would expose
  // their schema to anyone). They are filled from inside the app.
  if (!form || form.status !== 'published' || form.visibility === 'members') {
    return { error: 'This form is not available.' }
  }
  return { data: form }
}
