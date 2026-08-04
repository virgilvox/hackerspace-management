'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  logActivity,
  parseInput,
} from '@/lib/auth-helpers'
import {
  createClassSchema,
  updateClassSchema,
  classIdSchema,
} from '@/lib/validations'
import { requirePermission } from './_guard'
import { findSpaceForm } from './_forms'

// ─── Class definitions (classes.manage) ──────────────────────────────────────

export async function createClass(input: unknown) {
  const gate = await requirePermission('classes.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(createClassSchema, input)
  if (!v.ok) return { error: v.error }
  const c = v.data

  if (c.grants_certification_id) {
    const { data: cert } = await supabase
      .from('certifications')
      .select('id')
      .eq('id', c.grants_certification_id)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!cert) return { error: 'The selected certification was not found in this space.' }
  }

  if (c.required_form_id) {
    const form = await findSpaceForm(createAdminClient(), member.space_id, c.required_form_id)
    if (!form) return { error: 'The selected form was not found in this space.' }
    if (form.status !== 'published') return { error: 'The required form must be published before it can gate signups.' }
  }

  const { data, error } = await supabase
    .from('classes')
    .insert({
      space_id: member.space_id,
      title: c.title,
      description: c.description ?? null,
      payment_link: c.payment_link ?? null,
      capacity: c.capacity ?? null,
      grants_certification_id: c.grants_certification_id ?? null,
      required_form_id: c.required_form_id ?? null,
      created_by: member.id,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'created', 'class', data.id as string, c.title)
  revalidatePath('/classes')
  return { data: { id: data.id as string } }
}

export async function updateClass(input: unknown) {
  const gate = await requirePermission('classes.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(updateClassSchema, input)
  if (!v.ok) return { error: v.error }
  const u = v.data

  if (u.grants_certification_id) {
    const { data: cert } = await supabase
      .from('certifications')
      .select('id')
      .eq('id', u.grants_certification_id)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!cert) return { error: 'The selected certification was not found in this space.' }
  }

  if (u.required_form_id) {
    const form = await findSpaceForm(createAdminClient(), member.space_id, u.required_form_id)
    if (!form) return { error: 'The selected form was not found in this space.' }
    if (form.status !== 'published') return { error: 'The required form must be published before it can gate signups.' }
  }

  const patch: Record<string, unknown> = {}
  if (u.title !== undefined) patch.title = u.title
  if (u.description !== undefined) patch.description = u.description ?? null
  if (u.payment_link !== undefined) patch.payment_link = u.payment_link ?? null
  if (u.capacity !== undefined) patch.capacity = u.capacity ?? null
  if (u.grants_certification_id !== undefined) patch.grants_certification_id = u.grants_certification_id ?? null
  if (u.required_form_id !== undefined) patch.required_form_id = u.required_form_id ?? null
  if (u.is_active !== undefined) patch.is_active = u.is_active
  if (Object.keys(patch).length === 0) return { data: { id: u.classId } }

  const { error } = await supabase
    .from('classes')
    .update(patch)
    .eq('id', u.classId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'updated', 'class', u.classId)
  revalidatePath('/classes')
  return { data: { id: u.classId } }
}

export async function deleteClass(input: unknown) {
  const gate = await requirePermission('classes.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(classIdSchema, input)
  if (!v.ok) return { error: v.error }

  const { count } = await supabase
    .from('class_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', v.data.classId)
  if ((count ?? 0) > 0) {
    return { error: 'This class has scheduled sessions. Archive it instead of deleting.' }
  }

  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', v.data.classId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'deleted', 'class', v.data.classId)
  revalidatePath('/classes')
  return { data: { id: v.data.classId } }
}

export async function listClasses() {
  const gate = await requirePermission('classes.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const { data, error } = await supabase
    .from('classes')
    .select('id, title, description, payment_link, capacity, is_active, grants_certification_id, required_form_id, created_at, updated_at')
    .eq('space_id', member.space_id)
    .order('is_active', { ascending: false })
    .order('title', { ascending: true })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}
