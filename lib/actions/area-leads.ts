'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'
import { upsertAreaLeadSchema } from '@/lib/validations'

export async function upsertAreaLead(formData: {
  area_code: string
  area_name: string
  lead_id?: string
  lead_handle?: string
  status?: string
}) {
  const v = parseInput(upsertAreaLeadSchema, formData)
  if (!v.ok) return { error: v.error }

  // area_code is the (space_id, area_code) upsert conflict target. Postgres
  // treats NULLs as distinct in unique constraints, so a null/empty code
  // would let duplicate area-lead rows accumulate. Require it.
  if (!v.data.area_code || !v.data.area_code.trim()) {
    return { error: 'An area code is required.' }
  }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // If a lead member is referenced, confirm they belong to this space (the
  // row is space-scoped and RLS scopes reads, but reject a foreign id at the
  // boundary for consistency with the rest of the codebase).
  if (v.data.lead_id) {
    const { data: lead } = await supabase
      .from('space_members')
      .select('id')
      .eq('id', v.data.lead_id)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!lead) return { error: 'The selected lead is not a member of this space.' }
  }

  const { data, error } = await supabase
    .from('area_leads')
    .upsert(
      {
        space_id: member.space_id,
        area_code: v.data.area_code,
        area_name: v.data.area_name,
        lead_id: v.data.lead_id ?? null,
        lead_handle: v.data.lead_handle ?? null,
        status: v.data.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'space_id,area_code' },
    )
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { data }
}
