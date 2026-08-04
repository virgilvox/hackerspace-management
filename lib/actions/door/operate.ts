'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseInput } from '@/lib/auth-helpers'
import {
  doorGrantSchema,
  doorRevokeSchema,
  doorControlSchema,
  doorConnectionIdSchema,
} from '@/lib/validations'
import {
  encodeHeatSyncControl,
  encodeHeatSyncGrant,
  encodeHeatSyncRevoke,
  applyTemplate,
  last4,
} from '@/lib/door-logic'
import { callDoor } from '@/lib/door/executor'
import { checkRateLimit } from '@/lib/security'
import { requireDoorOperator } from './_guards'
import { resolveSecret, loadEnabledConnection, auditDoor, reserveSlot } from './_audit'

// ─── Live actions (door.operate) ─────────────────────────────────────────────
// These reach the physical controller. door.operate holders deliberately do
// NOT have RLS SELECT on door_connections / member_cards (the UID is a
// credential), so every read here goes through the service client AFTER the
// operator permission is verified, always scoped by space_id. Every attempt
// writes one redacted door_access_log row; the executor is the single egress.

export async function grantCard(input: unknown) {
  const gate = await requireDoorOperator()
  if (!gate.ok) return { error: gate.error }
  const { member } = gate

  const v = parseInput(doorGrantSchema, input)
  if (!v.ok) return { error: v.error }
  const { connectionId, cardId, permissionMask } = v.data

  const rl = checkRateLimit(`door-grant:${member.space_id}:${member.id}`, 30, 60_000)
  if (!rl.allowed) return { error: 'Too many door changes. Slow down and try again shortly.' }

  const admin = createAdminClient()
  const cx = await loadEnabledConnection(admin, member.space_id, connectionId)
  if (!cx.ok) return { error: cx.error }
  const conn = cx.conn

  const { data: card } = await admin
    .from('member_cards')
    .select('id, member_id, card_uid, is_active')
    .eq('id', cardId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!card) return { error: 'Card not found in this space' }
  if (!card.is_active) return { error: 'That card is inactive. Reactivate it before granting access.' }
  const targetMemberId = (card.member_id as string) ?? null

  const password = await resolveSecret(admin, member.space_id, conn.secret_ref)

  const reserved = await reserveSlot(admin, member.space_id, connectionId, cardId, member.id)
  if (!reserved.ok) {
    await auditDoor(admin, {
      spaceId: member.space_id, connectionId, actorMemberId: member.id,
      targetMemberId, action: 'grant', success: false,
      detail: `failed: ${reserved.error}`, password,
    })
    return { error: reserved.error }
  }

  let query: string
  if (conn.adapter === 'native_heatsync') {
    const enc = encodeHeatSyncGrant({
      slot: reserved.slot,
      permissionMask,
      tagHex: card.card_uid as string,
      password: password ?? '',
    })
    if (!enc.ok) {
      if (reserved.created) await admin.from('door_card_slots').delete().eq('connection_id', connectionId).eq('card_id', cardId)
      return { error: enc.reason }
    }
    query = enc.query
  } else {
    const tmpl = conn.verbs?.grant
    if (!tmpl) {
      if (reserved.created) await admin.from('door_card_slots').delete().eq('connection_id', connectionId).eq('card_id', cardId)
      return { error: 'This connection has no "grant" verb template configured.' }
    }
    query = applyTemplate(tmpl, {
      slot: reserved.slot, tag: card.card_uid as string, perm: permissionMask, pw: password ?? '',
    })
  }

  const result = await callDoor({ url: conn.base_url + query, pinnedHost: conn.pinned_host, password, authParam: conn.auth_param })

  if (!result.ok) {
    // Roll back the reservation so slots do not leak on a failed write.
    if (reserved.created) {
      await admin.from('door_card_slots').delete().eq('connection_id', connectionId).eq('card_id', cardId)
    }
    await auditDoor(admin, {
      spaceId: member.space_id, connectionId, actorMemberId: member.id,
      targetMemberId, action: 'grant', success: false,
      detail: `failed: ${result.reason}`, password,
    })
    return { error: 'The door controller call failed. Check the door audit log for the redacted detail.' }
  }

  await auditDoor(admin, {
    spaceId: member.space_id, connectionId, actorMemberId: member.id,
    targetMemberId, action: 'grant', success: true,
    detail: `slot ${reserved.slot} · status ${result.status}: ${result.snippet}`, password,
  })
  revalidatePath('/door/manage')
  return { data: { ok: true, slot: reserved.slot } }
}

export async function revokeCard(input: unknown) {
  const gate = await requireDoorOperator()
  if (!gate.ok) return { error: gate.error }
  const { member } = gate

  const v = parseInput(doorRevokeSchema, input)
  if (!v.ok) return { error: v.error }
  const { connectionId, cardId } = v.data

  const rl = checkRateLimit(`door-revoke:${member.space_id}:${member.id}`, 30, 60_000)
  if (!rl.allowed) return { error: 'Too many door changes. Slow down and try again shortly.' }

  const admin = createAdminClient()
  const cx = await loadEnabledConnection(admin, member.space_id, connectionId)
  if (!cx.ok) return { error: cx.error }
  const conn = cx.conn

  const { data: card } = await admin
    .from('member_cards')
    .select('id, member_id')
    .eq('id', cardId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  const targetMemberId = (card?.member_id as string) ?? null

  const { data: slotRow } = await admin
    .from('door_card_slots')
    .select('slot')
    .eq('connection_id', connectionId)
    .eq('card_id', cardId)
    .maybeSingle()

  const password = await resolveSecret(admin, member.space_id, conn.secret_ref)

  // Idempotent: nothing assigned means it is already revoked.
  if (!slotRow) {
    await auditDoor(admin, {
      spaceId: member.space_id, connectionId, actorMemberId: member.id,
      targetMemberId, action: 'revoke', success: true,
      detail: 'no slot assigned (already revoked)', password,
    })
    revalidatePath('/door/manage')
    return { data: { ok: true, alreadyRevoked: true } }
  }
  const slot = slotRow.slot as number

  let query: string
  if (conn.adapter === 'native_heatsync') {
    const enc = encodeHeatSyncRevoke(slot, password ?? '')
    if (!enc.ok) return { error: enc.reason }
    query = enc.query
  } else {
    const tmpl = conn.verbs?.revoke
    if (!tmpl) return { error: 'This connection has no "revoke" verb template configured.' }
    query = applyTemplate(tmpl, { slot, pw: password ?? '' })
  }

  const result = await callDoor({ url: conn.base_url + query, pinnedHost: conn.pinned_host, password, authParam: conn.auth_param })

  if (!result.ok) {
    // Keep the slot row so the app's map stays in sync with the device's
    // belief; the operator can retry.
    await auditDoor(admin, {
      spaceId: member.space_id, connectionId, actorMemberId: member.id,
      targetMemberId, action: 'revoke', success: false,
      detail: `failed (slot ${slot} kept): ${result.reason}`, password,
    })
    return { error: 'The door controller call failed. Check the door audit log for the redacted detail.' }
  }

  await admin.from('door_card_slots').delete().eq('connection_id', connectionId).eq('card_id', cardId)
  await auditDoor(admin, {
    spaceId: member.space_id, connectionId, actorMemberId: member.id,
    targetMemberId, action: 'revoke', success: true,
    detail: `slot ${slot} freed · status ${result.status}: ${result.snippet}`, password,
  })
  revalidatePath('/door/manage')
  return { data: { ok: true } }
}

// Active cards in the space plus the slot (if any) each holds on this
// connection, for the operator grant/revoke UI. door.operate; service client
// (operators have no RLS read on member_cards). The raw UID is never returned
// -- only the masked last4, like the member self-view.
export async function listDoorCards(input: unknown) {
  const gate = await requireDoorOperator()
  if (!gate.ok) return { error: gate.error }
  const { member } = gate

  const v = parseInput(doorConnectionIdSchema, input)
  if (!v.ok) return { error: v.error }

  const admin = createAdminClient()
  const { data: cards, error } = await admin
    .from('member_cards')
    .select('id, card_uid, label, member_id, space_members!member_cards_member_id_fkey(display_name)')
    .eq('space_id', member.space_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }

  const { data: slots } = await admin
    .from('door_card_slots')
    .select('card_id, slot')
    .eq('connection_id', v.data.connectionId)
  const slotByCard = new Map<string, number>()
  for (const s of slots ?? []) slotByCard.set(s.card_id as string, s.slot as number)

  return {
    data: (cards ?? []).map(c => {
      // TODO(types): remove after regenerating types/database.ts (missing FK relationship metadata)
      const sm = c.space_members as unknown as { display_name: string | null } | { display_name: string | null }[] | null
      const name = Array.isArray(sm) ? sm[0]?.display_name : sm?.display_name
      return {
        cardId: c.id as string,
        memberName: name ?? 'Unknown member',
        label: (c.label as string | null) ?? null,
        last4: last4(c.card_uid as string),
        slot: slotByCard.has(c.id as string) ? (slotByCard.get(c.id as string) as number) : null,
      }
    }),
  }
}

// Open / unlock / lock. No slot involvement. HeatSync 'open' = momentary o1.
// Generic controllers must have the matching verb template configured.
export async function doorControl(input: unknown) {
  const gate = await requireDoorOperator()
  if (!gate.ok) return { error: gate.error }
  const { member } = gate

  const v = parseInput(doorControlSchema, input)
  if (!v.ok) return { error: v.error }
  const { connectionId, verb } = v.data

  const rl = checkRateLimit(`door-control:${member.space_id}:${member.id}`, 20, 60_000)
  if (!rl.allowed) return { error: 'Too many door commands. Slow down and try again shortly.' }

  const admin = createAdminClient()
  const cx = await loadEnabledConnection(admin, member.space_id, connectionId)
  if (!cx.ok) return { error: cx.error }
  const conn = cx.conn

  const password = await resolveSecret(admin, member.space_id, conn.secret_ref)

  let query: string
  if (conn.adapter === 'native_heatsync') {
    const enc = encodeHeatSyncControl(verb === 'open' ? 'open1' : verb, password ?? '')
    if (!enc.ok) return { error: enc.reason }
    query = enc.query
  } else {
    const tmpl = conn.verbs?.[verb]
    if (!tmpl) return { error: `This connection has no "${verb}" verb template configured.` }
    query = applyTemplate(tmpl, { pw: password ?? '' })
  }

  const result = await callDoor({ url: conn.base_url + query, pinnedHost: conn.pinned_host, password, authParam: conn.auth_param })

  await auditDoor(admin, {
    spaceId: member.space_id, connectionId, actorMemberId: member.id,
    action: verb, success: result.ok,
    detail: result.ok ? `status ${result.status}: ${result.snippet}` : `failed: ${result.reason}`,
    password,
  })

  revalidatePath('/door/manage')
  return result.ok ? { data: { ok: true, status: result.status } } : { error: 'The door controller call failed. Check the door audit log for the redacted detail.' }
}
