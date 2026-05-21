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
  createApiButtonSchema,
  updateApiButtonSchema,
  apiButtonIdSchema,
} from '@/lib/validations'
import { redactDoorSecrets } from '@/lib/door-logic'
import { callApi } from '@/lib/door/executor'
import { resolveDoorSecret } from '@/lib/door/secret'
import { checkRateLimit } from '@/lib/security'

type Gate =
  | { ok: true; supabase: ServerSupabase; member: Member }
  | { ok: false; error: string }

// Managing API buttons reuses door.manage (the permission catalog already
// scopes door.manage to "door integrations, buttons, and member cards").
async function requireButtonManager(): Promise<Gate> {
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
  if (!allowed) return { ok: false, error: 'You do not have permission to manage API buttons' }
  return { ok: true, supabase, member }
}

function isUniqueViolation(message: string): boolean {
  return /duplicate key value|already exists|unique constraint/i.test(message)
}

// ─── Definition CRUD (door.manage) ───────────────────────────────────────────

const WRITE_FIELDS = [
  'label', 'button_group', 'sort_order', 'method', 'base_url', 'pinned_host',
  'url_template', 'headers', 'body_template', 'auth_mode', 'auth_param',
  'secret_ref', 'required_permission', 'confirm', 'is_enabled',
] as const

export async function createApiButton(input: unknown) {
  const gate = await requireButtonManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(createApiButtonSchema, input)
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
    .from('api_buttons')
    .insert({
      space_id: member.space_id,
      label: c.label,
      button_group: c.button_group,
      sort_order: c.sort_order,
      method: c.method,
      base_url: c.base_url,
      pinned_host: c.pinned_host,
      url_template: c.url_template ?? null,
      headers: c.headers,
      body_template: c.body_template ?? null,
      auth_mode: c.auth_mode,
      auth_param: c.auth_param ?? null,
      secret_ref: c.secret_ref ?? null,
      required_permission: c.required_permission,
      confirm: c.confirm,
      is_enabled: c.is_enabled,
      created_by: member.id,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'created', 'api_button', data.id as string, c.label)
  revalidatePath('/door/buttons')
  return { data: { id: data.id as string } }
}

export async function updateApiButton(input: unknown) {
  const gate = await requireButtonManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(updateApiButtonSchema, input)
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
  for (const k of WRITE_FIELDS) {
    if (u[k] !== undefined) patch[k] = u[k] ?? null
  }
  if (Object.keys(patch).length === 0) return { data: { id: u.buttonId } }

  const { error } = await supabase
    .from('api_buttons')
    .update(patch)
    .eq('id', u.buttonId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'updated', 'api_button', u.buttonId)
  revalidatePath('/door/buttons')
  return { data: { id: u.buttonId } }
}

export async function deleteApiButton(input: unknown) {
  const gate = await requireButtonManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(apiButtonIdSchema, input)
  if (!v.ok) return { error: v.error }

  const { error } = await supabase
    .from('api_buttons')
    .delete()
    .eq('id', v.data.buttonId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'deleted', 'api_button', v.data.buttonId)
  revalidatePath('/door/buttons')
  return { data: { id: v.data.buttonId } }
}

// Full definitions for the builder UI (door.manage; RLS already gates SELECT).
// secret_ref (an id, not the value) is returned so the picker can show the
// current selection; the secret value never leaves the server.
export async function listApiButtons() {
  const gate = await requireButtonManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const { data, error } = await supabase
    .from('api_buttons')
    .select('id, label, button_group, sort_order, method, base_url, pinned_host, url_template, headers, body_template, auth_mode, auth_param, secret_ref, required_permission, confirm, is_enabled')
    .eq('space_id', member.space_id)
    .order('button_group', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// ─── Member-facing invoke (per-button required_permission) ───────────────────

// The curated list a member may press: enabled buttons whose required_permission
// the caller holds. Members have NO RLS read on api_buttons (a button's url /
// headers / secret_ref are operator config), so this is a service-client read
// after requireMember; only presentational fields are returned (never url /
// headers / body / secret_ref).
export async function listInvokableButtons() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const admin = createAdminClient()
  const { data: buttons, error } = await admin
    .from('api_buttons')
    .select('id, label, button_group, sort_order, confirm, required_permission')
    .eq('space_id', member.space_id)
    .eq('is_enabled', true)
    .order('button_group', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })
  if (error) return { error: error.message }

  // Resolve each distinct required_permission once for this caller.
  const distinct = Array.from(new Set((buttons ?? []).map(b => b.required_permission as string)))
  const allowed = new Set<string>()
  for (const perm of distinct) {
    const { data: ok } = await supabase.rpc('user_has_permission', {
      uid: member.user_id as string,
      sid: member.space_id,
      perm,
    })
    if (ok) allowed.add(perm)
  }

  return {
    data: (buttons ?? [])
      .filter(b => allowed.has(b.required_permission as string))
      .map(b => ({
        id: b.id as string,
        label: b.label as string,
        group: b.button_group as string,
        confirm: b.confirm as boolean,
      })),
  }
}

// Press a button. Any member, gated by the button's own required_permission.
// Service client (the definition is operator config a member cannot RLS-read);
// the secret is decrypted server-side and injected by callApi, never returned.
// Rate-limited; every attempt (incl. a denial) writes one redacted
// api_call_log row through the single hardened egress.
export async function invokeApiButton(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const v = parseInput(apiButtonIdSchema, input)
  if (!v.ok) return { error: v.error }

  // Rate-limit before any DB work so a member cannot flood button loads,
  // permission RPCs, or denial-audit rows.
  const rl = checkRateLimit(`api-invoke:${member.space_id}:${member.id}`, 30, 60_000)
  if (!rl.allowed) return { error: 'Too many actions. Slow down and try again shortly.' }

  const admin = createAdminClient()
  const { data: btn } = await admin
    .from('api_buttons')
    .select('id, label, method, base_url, pinned_host, url_template, headers, body_template, auth_mode, auth_param, secret_ref, required_permission, is_enabled')
    .eq('id', v.data.buttonId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!btn || !btn.is_enabled) return { error: 'That button is not available.' }

  const { data: permitted } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: btn.required_permission as string,
  })
  if (!permitted) {
    await admin.from('api_call_log').insert({
      space_id: member.space_id,
      button_id: btn.id as string,
      actor_member_id: member.id,
      action: 'invoke',
      success: false,
      detail: 'denied: missing permission',
    })
    return { error: 'You do not have permission to use that button.' }
  }

  const secret = await resolveDoorSecret(admin, member.space_id, (btn.secret_ref as string | null) ?? null)
  const authParam = (btn.auth_param as string | null) ?? null

  const result = await callApi({
    method: btn.method as string,
    baseUrl: btn.base_url as string,
    urlTemplate: (btn.url_template as string | null) ?? null,
    pinnedHost: btn.pinned_host as string,
    headers: (btn.headers as Record<string, string> | null) ?? undefined,
    body: (btn.body_template as string | null) ?? null,
    authMode: (btn.auth_mode as 'none' | 'query' | 'header' | 'bearer') ?? 'none',
    authParam,
    secret,
  })

  const detail = redactDoorSecrets(
    (result.ok ? `${btn.method} ${result.status}: ${result.snippet}` : `failed: ${result.reason}`).slice(0, 1000),
    secret,
    authParam,
  )
  await admin.from('api_call_log').insert({
    space_id: member.space_id,
    button_id: btn.id as string,
    actor_member_id: member.id,
    action: 'invoke',
    success: result.ok,
    detail,
  })

  revalidatePath('/door/buttons')
  return result.ok
    ? { data: { ok: true, status: result.status } }
    : { error: 'The API call failed. Ask an admin to check the API-call log for the redacted detail.' }
}

// The press audit (door.manage), for the builder page.
export async function listApiCallLog() {
  const gate = await requireButtonManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const { data, error } = await supabase
    .from('api_call_log')
    .select('id, button_id, action, success, detail, occurred_at')
    .eq('space_id', member.space_id)
    .order('occurred_at', { ascending: false })
    .limit(200)
  if (error) return { error: error.message }
  return { data: data ?? [] }
}
