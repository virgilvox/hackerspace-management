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
  createDoorConnectionSchema,
  updateDoorConnectionSchema,
  doorConnectionIdSchema,
  doorGrantSchema,
  doorRevokeSchema,
  doorControlSchema,
} from '@/lib/validations'
import {
  encodeHeatSyncControl,
  encodeHeatSyncGrant,
  encodeHeatSyncRevoke,
  applyTemplate,
  redactDoorSecrets,
} from '@/lib/door-logic'
import { pickLowestFreeSlot, slotCapacity } from '@/lib/door-slots-logic'
import { callDoor } from '@/lib/door/executor'
import { decryptSecret } from '@/lib/secrets/crypto'
import { checkRateLimit } from '@/lib/security'

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
  if (!allowed) return { ok: false, error: 'You do not have permission to manage door connections' }
  return { ok: true, supabase, member }
}

// Load + decrypt a connection's door password from the encrypted secrets
// vault. Service client: a door manager may legitimately not hold
// ops.secrets.read, and the plaintext must never reach the browser. Returns
// null when no secret is referenced (auth_mode 'none').
async function resolveSecret(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  secretRef: string | null,
): Promise<string | null> {
  if (!secretRef) return null
  const { data } = await admin
    .from('secrets')
    .select('encryption_version, encrypted_value, value')
    .eq('id', secretRef)
    .eq('space_id', spaceId)
    .maybeSingle()
  if (!data) return null
  if (data.encryption_version === 1 && data.encrypted_value) {
    const raw = data.encrypted_value as unknown
    const buf =
      typeof raw === 'string'
        ? Buffer.from((raw as string).replace(/^\\x/, ''), 'hex')
        : Buffer.from(raw as Uint8Array)
    try {
      return decryptSecret(buf, 1)
    } catch {
      return null
    }
  }
  return (data.value as string | null) ?? null
}

function isUniqueViolation(message: string): boolean {
  return /duplicate key value|already exists|unique constraint/i.test(message)
}

// ─── Connection CRUD (door.manage) ───────────────────────────────────────────

export async function createDoorConnection(input: unknown) {
  const gate = await requireDoorManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(createDoorConnectionSchema, input)
  if (!v.ok) return { error: v.error }
  const c = v.data

  if (c.secret_ref) {
    const admin = createAdminClient()
    const { data: sec } = await admin
      .from('secrets')
      .select('id')
      .eq('id', c.secret_ref)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!sec) return { error: 'The referenced secret was not found in this space.' }
  }

  const { data, error } = await supabase
    .from('door_connections')
    .insert({
      space_id: member.space_id,
      name: c.name,
      adapter: c.adapter,
      base_url: c.base_url,
      pinned_host: c.pinned_host,
      auth_mode: c.auth_mode,
      auth_param: c.auth_param ?? null,
      secret_ref: c.secret_ref ?? null,
      verbs: c.verbs,
      allow_member_self_entry: c.allow_member_self_entry,
      is_enabled: c.is_enabled,
      created_by: member.id,
    })
    .select('id')
    .single()
  if (error) {
    if (isUniqueViolation(error.message)) return { error: 'A connection with that name already exists.' }
    return { error: error.message }
  }

  await logActivity(supabase, member, 'created', 'door_connection', data.id as string, c.name)
  revalidatePath('/door/manage')
  return { data: { id: data.id as string } }
}

export async function updateDoorConnection(input: unknown) {
  const gate = await requireDoorManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(updateDoorConnectionSchema, input)
  if (!v.ok) return { error: v.error }
  const u = v.data

  if (u.secret_ref) {
    const admin = createAdminClient()
    const { data: sec } = await admin
      .from('secrets')
      .select('id')
      .eq('id', u.secret_ref)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!sec) return { error: 'The referenced secret was not found in this space.' }
  }

  const patch: Record<string, unknown> = {}
  for (const k of [
    'name', 'adapter', 'base_url', 'pinned_host', 'auth_mode',
    'auth_param', 'secret_ref', 'verbs', 'allow_member_self_entry', 'is_enabled',
  ] as const) {
    if (u[k] !== undefined) patch[k] = u[k] === undefined ? null : u[k] ?? null
  }
  if (Object.keys(patch).length === 0) return { data: { id: u.connectionId } }

  const { error } = await supabase
    .from('door_connections')
    .update(patch)
    .eq('id', u.connectionId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'updated', 'door_connection', u.connectionId)
  revalidatePath('/door/manage')
  return { data: { id: u.connectionId } }
}

export async function deleteDoorConnection(input: unknown) {
  const gate = await requireDoorManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(doorConnectionIdSchema, input)
  if (!v.ok) return { error: v.error }

  const { error } = await supabase
    .from('door_connections')
    .delete()
    .eq('id', v.data.connectionId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'deleted', 'door_connection', v.data.connectionId)
  revalidatePath('/door/manage')
  return { data: { id: v.data.connectionId } }
}

export async function listDoorConnections() {
  const gate = await requireDoorManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const { data, error } = await supabase
    .from('door_connections')
    .select('id, name, adapter, base_url, pinned_host, auth_mode, auth_param, secret_ref, verbs, allow_member_self_entry, is_enabled, updated_at')
    .eq('space_id', member.space_id)
    .order('name', { ascending: true })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// Available secrets (titles only) so the admin can pick one for a connection
// without the values ever being exposed here.
export async function listSecretTitles() {
  const gate = await requireDoorManager()
  if (!gate.ok) return { error: gate.error }
  const { member } = gate
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('secrets')
    .select('id, title')
    .eq('space_id', member.space_id)
    .order('title', { ascending: true })
  if (error) return { error: error.message }
  return { data: (data ?? []).map(s => ({ id: s.id as string, title: s.title as string })) }
}

// Safe connectivity check: runs the 'status' verb only. Never opens a door.
// Writes one redacted audit row.
export async function testDoorConnection(input: unknown) {
  const gate = await requireDoorManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(doorConnectionIdSchema, input)
  if (!v.ok) return { error: v.error }

  const { data: conn } = await supabase
    .from('door_connections')
    .select('id, space_id, adapter, base_url, pinned_host, secret_ref, verbs, is_enabled')
    .eq('id', v.data.connectionId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!conn) return { error: 'Connection not found' }
  if (!conn.is_enabled) return { error: 'This connection is disabled.' }

  const admin = createAdminClient()
  const password = await resolveSecret(admin, member.space_id, conn.secret_ref as string | null)

  let query: string
  if (conn.adapter === 'native_heatsync') {
    const enc = encodeHeatSyncControl('status', password ?? '')
    if (!enc.ok) return { error: enc.reason }
    query = enc.query
  } else {
    const tmpl = (conn.verbs as Record<string, string> | null)?.status
    if (!tmpl) return { error: 'This connection has no "status" verb template configured.' }
    query = applyTemplate(tmpl, { pw: password ?? '' })
  }

  const result = await callDoor({
    url: (conn.base_url as string) + query,
    pinnedHost: conn.pinned_host as string,
    password,
  })

  const detail = result.ok
    ? redactDoorSecrets(`status ${result.status}: ${result.snippet}`.slice(0, 1000), password)
    : redactDoorSecrets(`failed: ${result.reason}`.slice(0, 1000), password)

  await admin.from('door_access_log').insert({
    space_id: member.space_id,
    connection_id: conn.id,
    actor_member_id: member.id,
    action: 'test',
    success: result.ok,
    detail,
  })

  revalidatePath('/door/manage')
  return result.ok
    ? { data: { ok: true, status: result.status } }
    : { error: result.reason }
}

export async function listDoorAccessLog() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data: canManage } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'door.manage',
  })
  let permitted = !!canManage
  if (!permitted) {
    const { data: canOp } = await supabase.rpc('user_has_permission', {
      uid: member.user_id as string,
      sid: member.space_id,
      perm: 'door.operate',
    })
    permitted = !!canOp
  }
  if (!permitted) return { error: 'You do not have permission to view the access log' }

  const { data, error } = await supabase
    .from('door_access_log')
    .select('id, connection_id, action, success, detail, occurred_at')
    .eq('space_id', member.space_id)
    .order('occurred_at', { ascending: false })
    .limit(200)
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// ─── Live actions (door.operate) ─────────────────────────────────────────────
// These reach the physical controller. door.operate holders deliberately do
// NOT have RLS SELECT on door_connections / member_cards (the UID is a
// credential), so every read here goes through the service client AFTER the
// operator permission is verified, always scoped by space_id. Every attempt
// writes one redacted door_access_log row; the executor is the single egress.

async function requireDoorOperator(): Promise<Gate> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { ok: false, error: auth.error }
  const { member } = auth
  const { data: allowed, error } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'door.operate',
  })
  if (error) return { ok: false, error: error.message }
  if (!allowed) return { ok: false, error: 'You do not have permission to operate the door' }
  return { ok: true, supabase, member }
}

type ConnRow = {
  id: string
  adapter: string
  base_url: string
  pinned_host: string
  secret_ref: string | null
  verbs: Record<string, string> | null
  is_enabled: boolean
}

async function loadEnabledConnection(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  connectionId: string,
): Promise<{ ok: true; conn: ConnRow } | { ok: false; error: string }> {
  const { data } = await admin
    .from('door_connections')
    .select('id, adapter, base_url, pinned_host, secret_ref, verbs, is_enabled')
    .eq('id', connectionId)
    .eq('space_id', spaceId)
    .maybeSingle()
  if (!data) return { ok: false, error: 'Connection not found' }
  if (!data.is_enabled) return { ok: false, error: 'This connection is disabled.' }
  return { ok: true, conn: data as unknown as ConnRow }
}

async function auditDoor(
  admin: ReturnType<typeof createAdminClient>,
  row: {
    spaceId: string
    connectionId: string
    actorMemberId: string
    targetMemberId?: string | null
    action: string
    success: boolean
    detail: string
    password?: string | null
  },
) {
  await admin.from('door_access_log').insert({
    space_id: row.spaceId,
    connection_id: row.connectionId,
    actor_member_id: row.actorMemberId,
    target_member_id: row.targetMemberId ?? null,
    action: row.action,
    success: row.success,
    detail: redactDoorSecrets(row.detail.slice(0, 1000), row.password),
  })
}

// Reserve (or reuse) the card's slot on this connection. The DB unique
// constraints arbitrate concurrency: (connection_id, card_id) makes re-grant
// idempotent; (connection_id, slot) makes a slot race fail loudly so we retry.
async function reserveSlot(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  connectionId: string,
  cardId: string,
  createdBy: string,
): Promise<
  | { ok: true; slot: number; created: boolean }
  | { ok: false; error: string }
> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: existing } = await admin
      .from('door_card_slots')
      .select('slot')
      .eq('connection_id', connectionId)
      .eq('card_id', cardId)
      .maybeSingle()
    if (existing) return { ok: true, slot: existing.slot as number, created: false }

    const { data: used } = await admin
      .from('door_card_slots')
      .select('slot')
      .eq('connection_id', connectionId)
    const pick = pickLowestFreeSlot((used ?? []).map(r => r.slot as number))
    if (!pick.ok) {
      const cap = slotCapacity()
      return { ok: false, error: `This controller is full (${cap}/${cap} card slots used). Revoke an unused card before granting another.` }
    }

    const { error: insErr } = await admin.from('door_card_slots').insert({
      space_id: spaceId,
      connection_id: connectionId,
      card_id: cardId,
      slot: pick.slot,
      created_by: createdBy,
    })
    if (!insErr) return { ok: true, slot: pick.slot, created: true }
    // Unique violation = a concurrent grant took this slot or this card.
    // Loop: re-read (the card row may now exist → reuse it; else re-pick).
    if (!isUniqueViolation(insErr.message)) return { ok: false, error: insErr.message }
  }
  return { ok: false, error: 'Could not allocate a free slot (contention). Try again.' }
}

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

  const result = await callDoor({ url: conn.base_url + query, pinnedHost: conn.pinned_host, password })

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
    return { error: result.reason }
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

  const result = await callDoor({ url: conn.base_url + query, pinnedHost: conn.pinned_host, password })

  if (!result.ok) {
    // Keep the slot row so the app's map stays in sync with the device's
    // belief; the operator can retry.
    await auditDoor(admin, {
      spaceId: member.space_id, connectionId, actorMemberId: member.id,
      targetMemberId, action: 'revoke', success: false,
      detail: `failed (slot ${slot} kept): ${result.reason}`, password,
    })
    return { error: result.reason }
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

  const result = await callDoor({ url: conn.base_url + query, pinnedHost: conn.pinned_host, password })

  await auditDoor(admin, {
    spaceId: member.space_id, connectionId, actorMemberId: member.id,
    action: verb, success: result.ok,
    detail: result.ok ? `status ${result.status}: ${result.snippet}` : `failed: ${result.reason}`,
    password,
  })

  revalidatePath('/door/manage')
  return result.ok ? { data: { ok: true, status: result.status } } : { error: result.reason }
}
