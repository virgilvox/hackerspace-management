'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  requireMember,
  getAuthMember,
  logActivity,
  parseInput,
  type Member,
  type ServerSupabase,
} from '@/lib/auth-helpers'
import { checkRateLimit } from '@/lib/security'
import {
  createFormSchema,
  updateFormSchema,
  setFormStatusSchema,
  formIdSchema,
  submitFormSchema,
  linkSubmissionsSchema,
  memberSubmissionsSchema,
  deleteFormSchema,
  deleteSubmissionSchema,
  getPublicFormSchema,
} from '@/lib/validations'
import { parseFormSchema, validateAnswers } from '@/lib/forms-schema'
import {
  csvCell,
  parseClientIp,
  shouldBumpFormVersion,
  escapeLike,
  pickMemberForEmail,
  deriveSubmitterEmail,
} from '@/lib/forms-logic'
import { renderFormEmail, formDedupeKey } from '@/lib/notifications-logic'
import {
  enqueueNotification,
  resolveMemberContact,
  getSpaceName,
  buildManageUrl,
} from '@/lib/notifications/enqueue'

// Associate prior unlinked submissions in a space with a member by email
// (case-insensitive, ILIKE-escaped so `_`/`%` in an address are literal).
// Only fills NULL member_id (never re-points an existing link). Shared by
// member create/email-change and submit-time linking. The caller is trusted
// to have established the email belongs to the member; see the note on the
// anon submit path in submitForm.
export async function linkSubmissionsByEmail(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  memberId: string,
  email: string | null | undefined,
): Promise<number> {
  if (!email) return 0
  const { data } = await admin
    .from('form_submissions')
    .update({ member_id: memberId })
    .eq('space_id', spaceId)
    .is('member_id', null)
    .ilike('submitter_email', escapeLike(email.toLowerCase()))
    .select('id')
  return data?.length ?? 0
}

const SUBMISSIONS_CAP = 5000

type Manager = { ok: true; supabase: ServerSupabase; member: Member } | { ok: false; error: string }

// forms.manage gate. Errors here are advisory UX; the database RLS on `forms`
// independently enforces the same permission, so a bypass cannot write.
async function requireFormsManager(): Promise<Manager> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { ok: false, error: auth.error }
  const { member } = auth

  const { data: allowed, error } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'forms.manage',
  })
  if (error) return { ok: false, error: error.message }
  if (!allowed) return { ok: false, error: 'You do not have permission to manage forms' }

  return { ok: true, supabase, member }
}

function isUniqueViolation(message: string): boolean {
  return /duplicate key value|already exists|unique constraint/i.test(message)
}

export async function createForm(input: unknown) {
  const gate = await requireFormsManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(createFormSchema, input)
  if (!v.ok) return { error: v.error }
  const f = v.data

  const { data, error } = await supabase
    .from('forms')
    .insert({
      space_id: member.space_id,
      slug: f.slug,
      title: f.title,
      description: f.description ?? null,
      kind: f.kind,
      visibility: f.visibility,
      schema: f.schema,
      legal_text: f.legal_text ?? null,
      created_by: member.id,
    })
    .select('id')
    .single()

  if (error) {
    if (isUniqueViolation(error.message)) {
      return { error: 'That slug is already taken. Pick a different one.' }
    }
    return { error: error.message }
  }

  await logActivity(supabase, member, 'created', 'form', data.id, f.title)
  revalidatePath('/forms')
  return { data: { id: data.id as string } }
}

export async function updateForm(input: unknown) {
  const gate = await requireFormsManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(updateFormSchema, input)
  if (!v.ok) return { error: v.error }
  const u = v.data

  const { data: existing, error: loadErr } = await supabase
    .from('forms')
    .select('id, space_id, kind, status, version, legal_text')
    .eq('id', u.formId)
    .eq('space_id', member.space_id)
    .single()
  if (loadErr || !existing) return { error: 'Form not found' }

  const patch: Record<string, unknown> = {}
  if (u.title !== undefined) patch.title = u.title
  if (u.description !== undefined) patch.description = u.description
  if (u.visibility !== undefined) patch.visibility = u.visibility
  if (u.schema !== undefined) patch.schema = u.schema
  if (u.legal_text !== undefined) patch.legal_text = u.legal_text

  // Non-blocking re-sign: bumping the version of a published waiver leaves
  // existing submissions valid against their own snapshot. We only nudge new
  // signers. Bump when the legal text or the field schema actually changes.
  const legalChanged = u.legal_text !== undefined && u.legal_text !== existing.legal_text
  const schemaChanged = u.schema !== undefined
  if (
    shouldBumpFormVersion({
      kind: existing.kind,
      status: existing.status,
      legalChanged,
      schemaChanged,
    })
  ) {
    patch.version = (existing.version as number) + 1
  }

  if (Object.keys(patch).length === 0) return { data: { id: u.formId } }

  const { error } = await supabase
    .from('forms')
    .update(patch)
    .eq('id', u.formId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'updated', 'form', u.formId)
  revalidatePath('/forms')
  revalidatePath(`/forms/${u.formId}`)
  return { data: { id: u.formId } }
}

export async function setFormStatus(input: unknown) {
  const gate = await requireFormsManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(setFormStatusSchema, input)
  if (!v.ok) return { error: v.error }

  const { error } = await supabase
    .from('forms')
    .update({ status: v.data.status })
    .eq('id', v.data.formId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, `status:${v.data.status}`, 'form', v.data.formId)
  revalidatePath('/forms')
  revalidatePath(`/forms/${v.data.formId}`)
  return { success: true as const }
}

export async function deleteForm(input: unknown) {
  const gate = await requireFormsManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(deleteFormSchema, input)
  if (!v.ok) return { error: v.error }

  // Permanent: deleting the form FK-cascades every form_submission for it
  // (including signed waivers). The destructive UI confirm + the required
  // `confirm: true` are the safeguards; record how many were destroyed.
  const admin = createAdminClient()
  const { count } = await admin
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', v.data.formId)
    .eq('space_id', member.space_id)

  const { error } = await supabase
    .from('forms')
    .delete()
    .eq('id', v.data.formId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(
    supabase, member, 'deleted', 'form', v.data.formId,
    `form + ${count ?? 0} submission(s) permanently deleted`,
  )
  revalidatePath('/forms')
  return { success: true as const }
}

// Permanently delete one submission. form_submissions has no client write
// policy (immutable by default), so this goes through the service client
// after the forms.manage gate, scoped by space_id.
export async function deleteSubmission(input: unknown) {
  const gate = await requireFormsManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(deleteSubmissionSchema, input)
  if (!v.ok) return { error: v.error }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('form_submissions')
    .select('id, form_id')
    .eq('id', v.data.submissionId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!row) return { error: 'Submission not found' }

  const { error } = await admin
    .from('form_submissions')
    .delete()
    .eq('id', v.data.submissionId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'deleted', 'form_submission', v.data.submissionId)
  revalidatePath(`/forms/${row.form_id}/results`)
  return { success: true as const }
}

// Re-run email-match linking across the whole space. Members are processed
// earliest-joined first so a shared email is claimed deterministically
// (matches pickMemberForEmail / migration 039). Only fills NULL member_id.
export async function relinkAllSubmissions() {
  const gate = await requireFormsManager()
  if (!gate.ok) return { error: gate.error }
  const { member } = gate

  const admin = createAdminClient()
  // Email -> earliest-joined member id (first occurrence wins; members are
  // ordered by joined_at so this matches pickMemberForEmail's determinism).
  const { data: members, error } = await admin
    .from('space_members')
    .select('id, email, joined_at')
    .eq('space_id', member.space_id)
    .not('email', 'is', null)
    .order('joined_at', { ascending: true })
  if (error) return { error: error.message }
  const byEmail = new Map<string, string>()
  for (const m of members ?? []) {
    const e = (m.email as string | null)?.trim().toLowerCase()
    if (e && !byEmail.has(e)) byEmail.set(e, m.id as string)
  }

  // Every unlinked submission: match on submitter_email OR an email found in
  // the answers (forms that collect email as an ordinary field). Backfill
  // submitter_email when we derived it so future paths stay consistent.
  const { data: subs, error: subErr } = await admin
    .from('form_submissions')
    .select('id, submitter_email, answers, form_snapshot')
    .eq('space_id', member.space_id)
    .is('member_id', null)
  if (subErr) return { error: subErr.message }

  let linked = 0
  for (const s of subs ?? []) {
    const email = deriveSubmitterEmail(
      parseFormSchema(s.form_snapshot) as Array<{ key: string; type: string }>,
      (s.answers ?? {}) as Record<string, unknown>,
      s.submitter_email as string | null,
    )
    if (!email) continue
    const memberId = byEmail.get(email)
    if (!memberId) continue
    const patch: Record<string, unknown> = { member_id: memberId }
    if (!s.submitter_email) patch.submitter_email = email
    const { error: upErr } = await admin
      .from('form_submissions')
      .update(patch)
      .eq('id', s.id as string)
      .eq('space_id', member.space_id)
    if (!upErr) linked++
  }

  revalidatePath('/forms')
  revalidatePath('/members')
  return { data: { linked } }
}

export async function listForms() {
  const gate = await requireFormsManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const { data, error } = await supabase
    .from('forms')
    .select('id, slug, title, kind, visibility, status, version, created_at, updated_at')
    .eq('space_id', member.space_id)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function getFormResults(input: unknown) {
  const gate = await requireFormsManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(formIdSchema, input)
  if (!v.ok) return { error: v.error }

  const { data: form, error: formErr } = await supabase
    .from('forms')
    .select('id, slug, title, kind, schema, version')
    .eq('id', v.data.formId)
    .eq('space_id', member.space_id)
    .single()
  if (formErr || !form) return { error: 'Form not found' }

  const { data: submissions, error: subErr } = await supabase
    .from('form_submissions')
    .select(
      'id, member_id, submitter_email, answers, form_version, ip, user_agent, created_at',
    )
    .eq('form_id', v.data.formId)
    .eq('space_id', member.space_id)
    .order('created_at', { ascending: false })
    .limit(SUBMISSIONS_CAP)
  if (subErr) return { error: subErr.message }

  return { data: { form, submissions: submissions ?? [] } }
}

export async function exportFormResultsCsv(input: unknown) {
  const gate = await requireFormsManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(formIdSchema, input)
  if (!v.ok) return { error: v.error }

  const { data: form, error: formErr } = await supabase
    .from('forms')
    .select('id, slug, title, schema')
    .eq('id', v.data.formId)
    .eq('space_id', member.space_id)
    .single()
  if (formErr || !form) return { error: 'Form not found' }

  const { data: submissions, error: subErr } = await supabase
    .from('form_submissions')
    .select('member_id, submitter_email, answers, form_version, ip, created_at')
    .eq('form_id', v.data.formId)
    .eq('space_id', member.space_id)
    .order('created_at', { ascending: false })
    .limit(SUBMISSIONS_CAP)
  if (subErr) return { error: subErr.message }

  const fields = parseFormSchema(form.schema)
  const header = [
    'submitted_at',
    'form_version',
    'member_id',
    'submitter_email',
    'ip',
    ...fields.map(f => f.key),
  ]
  const lines = [header.map(csvCell).join(',')]
  for (const s of submissions ?? []) {
    const answers = (s.answers ?? {}) as Record<string, unknown>
    lines.push(
      [
        s.created_at,
        s.form_version,
        s.member_id,
        s.submitter_email,
        s.ip,
        ...fields.map(f => answers[f.key]),
      ]
        .map(csvCell)
        .join(','),
    )
  }

  await logActivity(supabase, member, 'results_exported', 'form', form.id, form.slug)
  return {
    data: { filename: `${form.slug}-responses.csv`, csv: lines.join('\r\n') },
  }
}

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
      answers: answers.value,
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
      const resultsUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hackerspace.sh'}/forms/${form.id}/results`
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

/**
 * Self-service retro-link (Phase 5). Links the caller's prior ANONYMOUS
 * submissions to their own member row, but only when their email is verified
 * (the locked decision: retro-link to an account only on a verified email).
 *
 * Safe to expose: it takes no trusted parameters. It resolves the member and
 * email strictly from the caller's authenticated session, so a client can
 * only ever link submissions to their own account, and only their own
 * verified email. Idempotent (already-linked rows have a non-null member_id
 * and are excluded). This is the concrete "email-verification" hook; it is
 * also invoked best-effort from joinSpace and finishOnboarding.
 */
export async function claimMyAnonymousSubmissions() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!user.email || !user.email_confirmed_at) return { data: { linked: 0 } }

  const member = await getAuthMember(supabase)
  if (!member) return { data: { linked: 0 } }

  const admin = createAdminClient()
  const { data: linked } = await admin
    .from('form_submissions')
    .update({ member_id: member.id })
    .eq('space_id', member.space_id)
    .is('member_id', null)
    .eq('submitter_email', user.email.toLowerCase())
    .select('id')

  return { data: { linked: linked?.length ?? 0 } }
}

/**
 * Retro-link prior anonymous submissions to a member by matching email.
 *
 * The forms.manage "admin manual-link" tool. Automatic email-match linking
 * also runs at submit time and on member create/email-change/backfill (see
 * linkSubmissionsByEmail and the submitForm note) per the 2026-05 product
 * decision; this manual tool remains for explicit re-linking.
 */
export async function linkSubmissionsForMember(input: unknown) {
  const gate = await requireFormsManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(linkSubmissionsSchema, input)
  if (!v.ok) return { error: v.error }
  const email = v.data.email.toLowerCase()

  const { data: target } = await supabase
    .from('space_members')
    .select('id')
    .eq('id', v.data.memberId)
    .eq('space_id', member.space_id)
    .single()
  if (!target) return { error: 'Member not found in this space' }

  const admin = createAdminClient()
  const { data: linked, error } = await admin
    .from('form_submissions')
    .update({ member_id: v.data.memberId })
    .eq('space_id', member.space_id)
    .is('member_id', null)
    .eq('submitter_email', email)
    .select('id')
  if (error) return { error: error.message }

  await logActivity(
    supabase,
    member,
    'linked_submissions',
    'space_member',
    v.data.memberId,
    `${linked?.length ?? 0} submission(s) for ${email}`,
  )
  return { data: { linked: linked?.length ?? 0 } }
}

/**
 * The forms a given member has submitted (for the per-member panel on the
 * members page). forms.manage gated; the gate's client honors the
 * form_submissions/forms RLS (forms.manage), so no service-client bypass.
 * Metadata only -- answers stay in the audited results surface.
 */
export async function listMemberSubmissions(input: unknown) {
  const gate = await requireFormsManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(memberSubmissionsSchema, input)
  if (!v.ok) return { error: v.error }

  const { data, error } = await supabase
    .from('form_submissions')
    .select('id, form_id, form_version, created_at, forms(title, kind, slug)')
    .eq('space_id', member.space_id)
    .eq('member_id', v.data.memberId)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }

  return {
    data: (data ?? []).map(s => {
      const f = s.forms as { title: string; kind: string; slug: string } | { title: string; kind: string; slug: string }[] | null
      const form = Array.isArray(f) ? f[0] : f
      return {
        id: s.id as string,
        formId: s.form_id as string,
        title: form?.title ?? 'Form',
        kind: form?.kind ?? 'form',
        version: s.form_version as number,
        submittedAt: s.created_at as string,
      }
    }),
  }
}
