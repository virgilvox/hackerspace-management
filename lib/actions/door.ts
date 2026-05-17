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
} from '@/lib/validations'
import {
  encodeHeatSyncControl,
  applyTemplate,
  redactDoorSecrets,
} from '@/lib/door-logic'
import { callDoor } from '@/lib/door/executor'
import { decryptSecret } from '@/lib/secrets/crypto'

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
