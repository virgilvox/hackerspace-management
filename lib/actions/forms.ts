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
import {
  createFormSchema,
  updateFormSchema,
  setFormStatusSchema,
  formIdSchema,
  submitFormSchema,
  linkSubmissionsSchema,
} from '@/lib/validations'
import { parseFormSchema, validateAnswers } from '@/lib/forms-schema'

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
    existing.kind === 'waiver' &&
    existing.status === 'published' &&
    (legalChanged || schemaChanged)
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

  const v = parseInput(formIdSchema, input)
  if (!v.ok) return { error: v.error }

  // Deleting a form cascades to form_submissions. Submissions are immutable
  // waiver/response records, so refuse to delete a form that has any. Close
  // it instead.
  const admin = createAdminClient()
  const { count } = await admin
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', v.data.formId)
    .eq('space_id', member.space_id)
  if ((count ?? 0) > 0) {
    return { error: 'This form has submissions and cannot be deleted. Close it instead.' }
  }

  const { error } = await supabase
    .from('forms')
    .delete()
    .eq('id', v.data.formId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'deleted', 'form', v.data.formId)
  revalidatePath('/forms')
  return { success: true as const }
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

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
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

const IP_RE = /^[0-9a-fA-F:.]{3,45}$/

function clientIp(h: Headers): string | null {
  const fwd = h.get('x-forwarded-for')
  const candidate = (fwd ? fwd.split(',')[0] : h.get('x-real-ip'))?.trim()
  if (!candidate || !IP_RE.test(candidate)) return null
  return candidate
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
  let q = admin
    .from('forms')
    .select('id, space_id, slug, kind, visibility, status, schema, legal_text, version')
  q = body.formId ? q.eq('id', body.formId) : q.eq('slug', body.slug as string)
  const { data: form } = await q.single()
  if (!form) return { error: 'Form not found' }
  if (form.status !== 'published') {
    return { error: 'This form is not accepting responses' }
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

  const h = await headers()
  const { error: insErr } = await admin.from('form_submissions').insert({
    form_id: form.id,
    space_id: form.space_id,
    member_id: linkedMemberId,
    submitter_email: submitterEmail,
    answers: answers.value,
    form_snapshot: form.schema,
    legal_text_snapshot: form.legal_text ?? null,
    form_version: form.version,
    ip: clientIp(h),
    user_agent: h.get('user-agent'),
  })
  if (insErr) return { error: insErr.message }

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

  return { success: true as const }
}

/**
 * Retro-link prior anonymous submissions to a member by matching email.
 *
 * Phase 2 exposes this as the forms.manage "admin manual-link" tool. The
 * automatic path (link on email verification) is Phase 5 and must only run
 * with a verified email; this function trusts its caller to have established
 * that the email belongs to the member.
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
