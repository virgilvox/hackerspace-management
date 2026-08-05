'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  requireMember,
  logActivity,
  parseInput,
} from '@/lib/auth-helpers'
import {
  createDoorConnectionSchema,
  updateDoorConnectionSchema,
  doorConnectionIdSchema,
} from '@/lib/validations'
import {
  encodeHeatSyncControl,
  applyTemplate,
  redactDoorSecrets,
} from '@/lib/door-logic'
import { callDoor } from '@/lib/door/executor'
import { requireDoorManager } from './_guards'
import { resolveSecret, isUniqueViolation } from './_audit'

// ─── Connection CRUD (door.manage) ───────────────────────────────────────────

export async function createDoorConnection(input: unknown) {
  const gate = await requireDoorManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(createDoorConnectionSchema, input)
  if (!v.ok) return { error: v.error }
  const c = v.data

  const refs = [c.secret_ref, c.inbound_secret_ref].filter(Boolean) as string[]
  if (refs.length > 0) {
    const admin = createAdminClient()
    for (const ref of refs) {
      const { data: sec } = await admin
        .from('secrets')
        .select('id')
        .eq('id', ref)
        .eq('space_id', member.space_id)
        .maybeSingle()
      if (!sec) return { error: 'The referenced secret was not found in this space.' }
    }
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
      inbound_enabled: c.inbound_enabled,
      inbound_secret_ref: c.inbound_secret_ref ?? null,
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

  const refs = [u.secret_ref, u.inbound_secret_ref].filter(Boolean) as string[]
  if (refs.length > 0) {
    const admin = createAdminClient()
    for (const ref of refs) {
      const { data: sec } = await admin
        .from('secrets')
        .select('id')
        .eq('id', ref)
        .eq('space_id', member.space_id)
        .maybeSingle()
      if (!sec) return { error: 'The referenced secret was not found in this space.' }
    }
  }

  const patch: Record<string, unknown> = {}
  for (const k of [
    'name', 'adapter', 'base_url', 'pinned_host', 'auth_mode',
    'auth_param', 'secret_ref', 'verbs', 'allow_member_self_entry', 'is_enabled',
    'inbound_enabled', 'inbound_secret_ref',
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
    .select('id, name, adapter, base_url, pinned_host, auth_mode, auth_param, secret_ref, verbs, allow_member_self_entry, is_enabled, inbound_enabled, inbound_secret_ref, updated_at')
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
    .select('id, space_id, adapter, base_url, pinned_host, auth_param, secret_ref, verbs, is_enabled')
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

  const authParam = (conn.auth_param as string | null) ?? null
  const result = await callDoor({
    url: (conn.base_url as string) + query,
    pinnedHost: conn.pinned_host as string,
    password,
    authParam,
  })

  const detail = result.ok
    ? redactDoorSecrets(`status ${result.status}: ${result.snippet}`.slice(0, 1000), password, authParam)
    : redactDoorSecrets(`failed: ${result.reason}`.slice(0, 1000), password, authParam)

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
    : { error: 'The door controller call failed. Check the door audit log for the redacted detail.' }
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
