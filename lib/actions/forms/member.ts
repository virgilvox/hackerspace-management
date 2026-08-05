'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthMember, logActivity, parseInput } from '@/lib/auth-helpers'
import {
  linkSubmissionsSchema,
  memberSubmissionsSchema,
} from '@/lib/validations'
import { escapeLike } from '@/lib/forms-logic'
import { requireFormsManager } from './_guard'

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
