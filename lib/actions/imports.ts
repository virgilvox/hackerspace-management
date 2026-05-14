'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole } from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'

export async function importMembers(
  rows: Array<{
    display_name: string
    email: string
    phone?: string
    tier?: string
    joined_at?: string
    last_paid_at?: string
    has_card_access?: boolean
  }>,
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: 'No rows to import' }
  }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const inserts = rows
    .filter(r => typeof r.display_name === 'string' && typeof r.email === 'string')
    .map(r => ({
      space_id: member.space_id,
      display_name: r.display_name,
      email: r.email,
      phone: r.phone ?? null,
      tier: r.tier ?? 'basic',
      role: 'member',
      status: 'current',
      approved: true,
      joined_at: r.joined_at ?? new Date().toISOString(),
      last_paid_at: r.last_paid_at ?? null,
      has_card_access: r.has_card_access ?? false,
    }))

  if (inserts.length === 0) {
    return { error: 'No valid rows to import' }
  }

  // Upsert by (space_id, email) to dedupe re-imports.
  const { data, error } = await supabase
    .from('space_members')
    .upsert(inserts, { onConflict: 'space_id,email', ignoreDuplicates: false })
    .select()

  if (error) return { error: error.message }
  revalidatePath('/members')
  return { data, count: data.length }
}
