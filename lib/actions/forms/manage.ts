'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity, parseInput } from '@/lib/auth-helpers'
import {
  createFormSchema,
  updateFormSchema,
  setFormStatusSchema,
  formIdSchema,
  deleteFormSchema,
  deleteSubmissionSchema,
} from '@/lib/validations'
import { parseFormSchema } from '@/lib/forms-schema'
import {
  csvCell,
  shouldBumpFormVersion,
  deriveSubmitterEmail,
} from '@/lib/forms-logic'
import { requireFormsManager, isUniqueViolation } from './_guard'

const SUBMISSIONS_CAP = 5000

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
