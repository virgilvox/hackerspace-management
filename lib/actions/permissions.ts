'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import {
  setRolePermissionsSchema,
  setOpsAclSchema,
  createAreaLeadRoleSchema,
  assignAreaLeadSchema,
  uuidSchema,
} from '@/lib/validations'
import { isValidPermission } from '@/lib/permissions-catalog'

const PERM_ADMIN_ROLES = ['admin', 'board'] as const

// Replace the full permission set for one role/custom-role subject.
export async function setRolePermissions(input: { subject: string; permissions: string[] }) {
  const v = parseInput(setRolePermissionsSchema, input)
  if (!v.ok) return { error: v.error }

  const perms = v.data.permissions.filter(isValidPermission)

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, PERM_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const del = await supabase
    .from('space_role_permissions')
    .delete()
    .eq('space_id', member.space_id)
    .eq('subject', v.data.subject)
  if (del.error) return { error: del.error.message }

  if (perms.length > 0) {
    const ins = await supabase
      .from('space_role_permissions')
      .insert(perms.map(permission => ({ space_id: member.space_id, subject: v.data.subject, permission })))
    if (ins.error) return { error: ins.error.message }
  }

  revalidatePath('/customize')
  return { success: true as const }
}

// Replace the full ACL role list for one Ops item. Empty list => the item
// falls back to its existing visibility rule (no ACL rows).
export async function setOpsAcl(input: {
  entity_type: 'secret' | 'kb' | 'process' | 'area_lead'
  entity_id: string
  roles: string[]
}) {
  const v = parseInput(setOpsAclSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, PERM_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const del = await supabase
    .from('ops_acl')
    .delete()
    .eq('space_id', member.space_id)
    .eq('entity_type', v.data.entity_type)
    .eq('entity_id', v.data.entity_id)
  if (del.error) return { error: del.error.message }

  const roles = Array.from(new Set(v.data.roles.map(r => r.trim()).filter(Boolean)))
  if (roles.length > 0) {
    const ins = await supabase.from('ops_acl').insert(
      roles.map(role => ({
        space_id: member.space_id,
        entity_type: v.data.entity_type,
        entity_id: v.data.entity_id,
        role,
      })),
    )
    if (ins.error) return { error: ins.error.message }
  }

  revalidatePath('/ops')
  return { success: true as const }
}

// An area-lead role is an area_leads row. lead_id NULL renders as "Vacant".
export async function createAreaLeadRole(input: { area_code: string; name: string }) {
  const v = parseInput(createAreaLeadRoleSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, PERM_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('area_leads')
    .insert({
      space_id: member.space_id,
      area_code: v.data.area_code,
      area_name: v.data.name,
      status: 'vacant',
    })
    .select('id, area_code, area_name, lead_id, lead_handle, status')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/customize')
  revalidatePath('/ops')
  return { data }
}

export async function assignAreaLead(input: { area_lead_role_id: string; member_id: string }) {
  const v = parseInput(assignAreaLeadSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, PERM_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data: target } = await supabase
    .from('space_members')
    .select('id, display_name, handle')
    .eq('id', v.data.member_id)
    .eq('space_id', member.space_id)
    .single()
  if (!target) return { error: 'Member not found in this space' }

  const { error } = await supabase
    .from('area_leads')
    .update({
      lead_id: target.id,
      lead_handle: target.handle ?? target.display_name ?? null,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', v.data.area_lead_role_id)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/customize')
  revalidatePath('/members')
  revalidatePath('/ops')
  return { success: true as const }
}

export async function unassignAreaLead(areaLeadRoleId: string) {
  const idCheck = parseInput(uuidSchema, areaLeadRoleId)
  if (!idCheck.ok) return { error: 'Invalid role ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, PERM_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('area_leads')
    .update({ lead_id: null, lead_handle: null, status: 'vacant', updated_at: new Date().toISOString() })
    .eq('id', idCheck.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/customize')
  revalidatePath('/members')
  revalidatePath('/ops')
  return { success: true as const }
}

export async function deleteAreaLeadRole(areaLeadRoleId: string) {
  const idCheck = parseInput(uuidSchema, areaLeadRoleId)
  if (!idCheck.ok) return { error: 'Invalid role ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ['admin'], 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Clear any ACL rows that referenced this area-lead sentinel first.
  await supabase
    .from('ops_acl')
    .delete()
    .eq('space_id', member.space_id)
    .eq('role', `area_lead:${idCheck.data}`)

  const { error } = await supabase
    .from('area_leads')
    .delete()
    .eq('id', idCheck.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/customize')
  revalidatePath('/ops')
  return { success: true as const }
}
