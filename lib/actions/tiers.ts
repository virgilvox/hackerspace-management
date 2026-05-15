'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import { createTierSchema, updateTierSchema, uuidSchema } from '@/lib/validations'

const TIER_RW_ROLES = ['admin', 'board', 'treasurer'] as const

export async function createTier(input: {
  slug: string
  name: string
  description?: string | null
  monthly_price_cents: number
  billing_cadence?: 'monthly' | 'quarterly' | 'annual' | 'one_time' | 'custom'
  sort_order?: number
}) {
  const v = parseInput(createTierSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, TIER_RW_ROLES, 'Treasurer, board, or admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('space_tiers')
    .insert({
      space_id: member.space_id,
      slug: v.data.slug,
      name: v.data.name,
      description: v.data.description ?? null,
      monthly_price_cents: v.data.monthly_price_cents,
      billing_cadence: v.data.billing_cadence ?? 'monthly',
      sort_order: v.data.sort_order ?? 100,
      is_system: false,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { id: data.id }
}

export async function updateTier(tierId: string, updates: {
  name?: string
  description?: string | null
  monthly_price_cents?: number
  billing_cadence?: 'monthly' | 'quarterly' | 'annual' | 'one_time' | 'custom'
  sort_order?: number
  is_archived?: boolean
}) {
  const idCheck = parseInput(uuidSchema, tierId)
  if (!idCheck.ok) return { error: 'Invalid tier ID' }
  const v = parseInput(updateTierSchema, updates)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, TIER_RW_ROLES, 'Treasurer, board, or admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const patch: Record<string, unknown> = {}
  if (v.data.name                !== undefined) patch.name = v.data.name
  if (v.data.description         !== undefined) patch.description = v.data.description
  if (v.data.monthly_price_cents !== undefined) patch.monthly_price_cents = v.data.monthly_price_cents
  if (v.data.billing_cadence     !== undefined) patch.billing_cadence = v.data.billing_cadence
  if (v.data.sort_order          !== undefined) patch.sort_order = v.data.sort_order
  if (v.data.is_archived         !== undefined) patch.is_archived = v.data.is_archived

  const { error } = await supabase
    .from('space_tiers')
    .update(patch)
    .eq('id', idCheck.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true as const }
}

export async function deleteTier(tierId: string) {
  const v = parseInput(uuidSchema, tierId)
  if (!v.ok) return { error: 'Invalid tier ID' }

  const supabase = await createClient()
  // RLS blocks deletion of system tiers; admin-only.
  const auth = await requireMemberWithRole(supabase, ['admin'], 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error, count } = await supabase
    .from('space_tiers')
    .delete({ count: 'exact' })
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  if (count === 0) return { error: 'Cannot delete a built-in tier. Archive it instead.' }
  revalidatePath('/settings')
  return { success: true as const }
}
