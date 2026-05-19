'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import {
  upsertRoleLabelSchema,
  createCustomRoleSchema,
  updateCustomRoleSchema,
  uuidSchema,
} from '@/lib/validations'

const ROLE_ADMIN_ROLES = ['admin', 'board'] as const

export async function upsertRoleLabel(input: {
  role: 'admin' | 'board' | 'treasurer' | 'member' | 'associate'
  display_name?: string | null
  description?: string | null
  color?: string | null
  sort_order?: number
}) {
  const v = parseInput(upsertRoleLabelSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ROLE_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('space_role_labels')
    .upsert({
      space_id: member.space_id,
      role: v.data.role,
      display_name: v.data.display_name ?? null,
      description: v.data.description ?? null,
      color: v.data.color ?? null,
      sort_order: v.data.sort_order ?? 0,
    }, { onConflict: 'space_id,role' })

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true as const }
}

export async function createCustomRole(input: {
  slug: string
  name: string
  description?: string | null
  color?: string | null
  sort_order?: number
}) {
  const v = parseInput(createCustomRoleSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ROLE_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('space_custom_roles')
    .insert({
      space_id: member.space_id,
      slug: v.data.slug,
      name: v.data.name,
      description: v.data.description ?? null,
      color: v.data.color ?? null,
      sort_order: v.data.sort_order ?? 100,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { id: data.id }
}

export async function updateCustomRole(roleId: string, updates: {
  name?: string
  description?: string | null
  color?: string | null
  sort_order?: number
}) {
  const idCheck = parseInput(uuidSchema, roleId)
  if (!idCheck.ok) return { error: 'Invalid role ID' }
  const v = parseInput(updateCustomRoleSchema, updates)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ROLE_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const patch: Record<string, unknown> = {}
  if (v.data.name        !== undefined) patch.name = v.data.name
  if (v.data.description !== undefined) patch.description = v.data.description
  if (v.data.color       !== undefined) patch.color = v.data.color
  if (v.data.sort_order  !== undefined) patch.sort_order = v.data.sort_order

  const { error } = await supabase
    .from('space_custom_roles')
    .update(patch)
    .eq('id', idCheck.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true as const }
}

export async function deleteCustomRole(roleId: string) {
  const v = parseInput(uuidSchema, roleId)
  if (!v.ok) return { error: 'Invalid role ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ['admin'], 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('space_custom_roles')
    .delete()
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true as const }
}

export async function assignCustomRole(memberId: string, customRoleId: string) {
  const a = parseInput(uuidSchema, memberId)
  const b = parseInput(uuidSchema, customRoleId)
  if (!a.ok || !b.ok) return { error: 'Invalid ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ROLE_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Pin BOTH the target member and the custom role to the caller's space.
  // The RLS insert WITH CHECK only validated member_id's space, not the
  // custom_role_id's — an admin of space A could otherwise attach space B's
  // custom role to a member of A.
  const { data: cr } = await supabase
    .from('space_custom_roles')
    .select('id')
    .eq('id', b.data)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!cr) return { error: 'Custom role not found in this space.' }
  const { data: tm } = await supabase
    .from('space_members')
    .select('id')
    .eq('id', a.data)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!tm) return { error: 'Member not found in this space.' }

  const { error } = await supabase
    .from('space_member_custom_roles')
    .insert({ member_id: a.data, custom_role_id: b.data })

  if (error) return { error: error.message }
  revalidatePath('/members')
  revalidatePath('/settings')
  return { success: true as const }
}

export async function unassignCustomRole(memberId: string, customRoleId: string) {
  const a = parseInput(uuidSchema, memberId)
  const b = parseInput(uuidSchema, customRoleId)
  if (!a.ok || !b.ok) return { error: 'Invalid ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ROLE_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }

  const { error } = await supabase
    .from('space_member_custom_roles')
    .delete()
    .eq('member_id', a.data)
    .eq('custom_role_id', b.data)

  if (error) return { error: error.message }
  revalidatePath('/members')
  revalidatePath('/settings')
  return { success: true as const }
}
