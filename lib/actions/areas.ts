'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'
import { createAreaSchema, updateAreaSchema, uuidSchema } from '@/lib/validations'

/**
 * Add a new area to the current space. Admin / board only.
 * `code` is the stable identifier (slug); `name` is what shows up in
 * dropdowns. Renames change the name but keep the code, so existing
 * tasks tagged with the old name will not auto-rename — admins re-tag
 * if they care.
 */
export async function createArea(formData: {
  code: string
  name: string
  icon?: string | null
  sort_order?: number
}) {
  const v = parseInput(createAreaSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('space_areas')
    .insert({
      space_id: member.space_id,
      code: v.data.code,
      name: v.data.name,
      icon: v.data.icon ?? null,
      sort_order: v.data.sort_order ?? 100,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/settings')
  revalidatePath('/tasks')
  revalidatePath('/projects')
  revalidatePath('/ops')
  return { data }
}

/**
 * Edit an area's name, icon, sort order, or archive state.
 */
export async function updateArea(formData: {
  areaId: string
  name?: string
  icon?: string | null
  sort_order?: number
  is_archived?: boolean
}) {
  const v = parseInput(updateAreaSchema, formData)
  if (!v.ok) return { error: v.error }
  const { areaId, ...patch } = v.data

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('space_areas')
    .update(patch)
    .eq('id', areaId)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  revalidatePath('/tasks')
  revalidatePath('/projects')
  revalidatePath('/ops')
  return { success: true as const }
}

/**
 * Delete an area entirely. Admin-only. Prefer archiving via
 * `updateArea({ is_archived: true })` unless the area has never been used.
 */
export async function deleteArea(areaId: string) {
  const v = parseInput(uuidSchema, areaId)
  if (!v.ok) return { error: 'Invalid area ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ['admin'], 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('space_areas')
    .delete()
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  revalidatePath('/tasks')
  revalidatePath('/projects')
  revalidatePath('/ops')
  return { success: true as const }
}
