'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  requireMember,
  logActivity,
  parseInput,
  type Member,
  type ServerSupabase,
} from '@/lib/auth-helpers'
import {
  addMemberCardSchema,
  updateMemberCardSchema,
  cardIdSchema,
  listMemberCardsSchema,
} from '@/lib/validations'
import { last4 } from '@/lib/door-logic'

type Gate =
  | { ok: true; supabase: ServerSupabase; member: Member }
  | { ok: false; error: string }

async function requireDoorManager(): Promise<Gate> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { ok: false, error: auth.error }
  const { member } = auth
  const { data: allowed, error } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'door.manage',
  })
  if (error) return { ok: false, error: error.message }
  if (!allowed) return { ok: false, error: 'You do not have permission to manage access cards' }
  return { ok: true, supabase, member }
}

function isUniqueViolation(message: string): boolean {
  return /duplicate key value|already exists|unique constraint/i.test(message)
}

export async function addMemberCard(input: unknown) {
  const gate = await requireDoorManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(addMemberCardSchema, input)
  if (!v.ok) return { error: v.error }
  const c = v.data

  const { data: target } = await supabase
    .from('space_members')
    .select('id')
    .eq('id', c.memberId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!target) return { error: 'Member not found in this space' }

  const { data, error } = await supabase
    .from('member_cards')
    .insert({
      space_id: member.space_id,
      member_id: c.memberId,
      card_uid: c.card_uid,
      card_type: c.card_type,
      label: c.label ?? null,
      created_by: member.id,
    })
    .select('id')
    .single()
  if (error) {
    if (isUniqueViolation(error.message)) {
      return { error: 'That card UID is already registered in this space.' }
    }
    return { error: error.message }
  }

  // Audit without ever logging the raw UID.
  await logActivity(supabase, member, 'added', 'member_card', data.id as string, `card •••${last4(c.card_uid)}`)
  revalidatePath('/members')
  revalidatePath('/me')
  return { data: { id: data.id as string } }
}

export async function updateMemberCard(input: unknown) {
  const gate = await requireDoorManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(updateMemberCardSchema, input)
  if (!v.ok) return { error: v.error }
  const u = v.data

  const patch: Record<string, unknown> = {}
  if (u.label !== undefined) patch.label = u.label ?? null
  if (u.is_active !== undefined) patch.is_active = u.is_active
  if (Object.keys(patch).length === 0) return { data: { id: u.cardId } }

  const { error } = await supabase
    .from('member_cards')
    .update(patch)
    .eq('id', u.cardId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'updated', 'member_card', u.cardId)
  revalidatePath('/members')
  revalidatePath('/me')
  return { data: { id: u.cardId } }
}

export async function deleteMemberCard(input: unknown) {
  const gate = await requireDoorManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(cardIdSchema, input)
  if (!v.ok) return { error: v.error }

  const { error } = await supabase
    .from('member_cards')
    .delete()
    .eq('id', v.data.cardId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'deleted', 'member_card', v.data.cardId)
  revalidatePath('/members')
  revalidatePath('/me')
  return { data: { id: v.data.cardId } }
}

// Manager view: full UID (door.manage holders only, enforced by RLS too).
export async function listMemberCards(input: unknown) {
  const gate = await requireDoorManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(listMemberCardsSchema, input)
  if (!v.ok) return { error: v.error }

  const { data, error } = await supabase
    .from('member_cards')
    .select('id, card_uid, card_type, label, is_active, created_at')
    .eq('space_id', member.space_id)
    .eq('member_id', v.data.memberId)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// The signed-in member's own cards, MASKED. The raw UID is a credential and
// is never returned here; member_cards has no member-facing RLS SELECT
// policy, so this uses the service client and strips card_uid to last4.
export async function getMyCards() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('member_cards')
    .select('id, card_uid, card_type, label, is_active')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return {
    data: (data ?? []).map(c => ({
      id: c.id as string,
      card_type: c.card_type as string,
      label: (c.label as string | null) ?? null,
      is_active: c.is_active as boolean,
      last4: last4(c.card_uid as string),
    })),
  }
}
