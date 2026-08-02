'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole } from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'
import { importMembersSchema } from '@/lib/validations'
import type { TablesInsert } from '@/types/database'

export async function importMembers(rows: unknown) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: 'No rows to import' }
  }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Validate per row so one bad row does not reject the whole file; the
  // schema lowercases email and normalizes dates via flexibleDateTime.
  const rowSchema = importMembersSchema.element
  const valid: Array<TablesInsert<'space_members'>> = []
  let skipped = 0
  for (const raw of rows) {
    const r = rowSchema.safeParse(raw)
    if (!r.success) { skipped++; continue }
    valid.push({
      space_id: member.space_id,
      display_name: r.data.display_name,
      email: r.data.email,
      phone: r.data.phone ?? null,
      tier: r.data.tier ?? 'basic',
      role: 'member',
      status: 'current',
      approved: true,
      joined_at: r.data.joined_at ?? new Date().toISOString(),
      last_paid_at: r.data.last_paid_at ?? null,
      has_card_access: r.data.has_card_access ?? false,
    })
  }

  if (valid.length === 0) {
    return { error: `No valid rows to import (${skipped} skipped: bad email, name, tier, or date).` }
  }

  const { data, error } = await supabase
    .from('space_members')
    .upsert(valid, { onConflict: 'space_id,email', ignoreDuplicates: false })
    .select()

  if (error) return { error: error.message }
  revalidatePath('/members')
  return { data, count: data.length, skipped }
}
