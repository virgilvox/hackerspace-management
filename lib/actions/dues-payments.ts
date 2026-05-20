'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMember, requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'
import { duesPaymentMethodSchema } from '@/lib/validations'
import { isSafeDuesUrl } from '@/lib/dues-payments-logic'

export type DuesPaymentMethod = {
  platform: string
  url: string
  instructions: string | null
  isActive: boolean
  sortOrder: number
}

// Member-facing: the ACTIVE external dues payment links for the caller's space,
// in display order. RLS (SELECT = space member) scopes this; we still pin
// space_id for clarity. Used by the /me dues UI to render click-out buttons.
export async function listActiveDuesPaymentMethods(): Promise<
  { data: DuesPaymentMethod[] } | { error: string }
> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data } = await supabase
    .from('dues_payment_methods')
    .select('platform, url, instructions, is_active, sort_order')
    .eq('space_id', member.space_id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Defense-in-depth: only render absolute-https links. The DB CHECK and the
  // admin Zod schema already enforce this, but a member's browser must never
  // be handed an unsafe href, so re-validate at the boundary that feeds the
  // clickable card and drop anything that is not a safe https URL.
  return { data: (data ?? []).map(toMethod).filter(m => isSafeDuesUrl(m.url)) }
}

// Admin-facing: every configured method (active + inactive) for the management
// UI in /settings.
export async function listDuesPaymentMethods(): Promise<
  { data: DuesPaymentMethod[] } | { error: string }
> {
  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data } = await supabase
    .from('dues_payment_methods')
    .select('platform, url, instructions, is_active, sort_order')
    .eq('space_id', member.space_id)
    .order('sort_order', { ascending: true })

  return { data: (data ?? []).map(toMethod) }
}

// Admin: create or update the link for one platform (idempotent on
// (space_id, platform)). The RLS write policies re-check the admin/board role.
export async function upsertDuesPaymentMethod(
  input: unknown,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const v = parseInput(duesPaymentMethodSchema, input)
  if (!v.ok) return { error: v.error }
  const s = v.data

  const { error } = await supabase.from('dues_payment_methods').upsert(
    {
      space_id: member.space_id,
      platform: s.platform,
      url: s.url,
      instructions: s.instructions ?? null,
      is_active: s.is_active ?? true,
      sort_order: s.sort_order ?? 0,
    },
    { onConflict: 'space_id,platform' },
  )
  if (error) return { error: 'Could not save the payment method.' }

  revalidatePath('/settings')
  revalidatePath('/me')
  return { ok: true }
}

// Admin: remove the link for one platform entirely.
export async function deleteDuesPaymentMethod(input: {
  platform: string
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('dues_payment_methods')
    .delete()
    .eq('space_id', member.space_id)
    .eq('platform', input.platform)
  if (error) return { error: 'Could not remove the payment method.' }

  revalidatePath('/settings')
  revalidatePath('/me')
  return { ok: true }
}

function toMethod(r: {
  platform: string
  url: string
  instructions: string | null
  is_active: boolean
  sort_order: number
}): DuesPaymentMethod {
  return {
    platform: r.platform,
    url: r.url,
    instructions: r.instructions ?? null,
    isActive: r.is_active,
    sortOrder: r.sort_order,
  }
}
