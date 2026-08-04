'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember, parseInput } from '@/lib/auth-helpers'
import { doorConnectionIdSchema } from '@/lib/validations'
import { encodeHeatSyncControl, applyTemplate } from '@/lib/door-logic'
import { callDoor } from '@/lib/door/executor'
import { checkRateLimit } from '@/lib/security'
import { resolveSecret, auditDoor } from './_audit'

// ─── Member self-entry ("buzz me in") ────────────────────────────────────────
// ELEVATED RISK, opt-in per connection. Any active member with at least one
// active card on file (the locked eligibility rule: a door_card_slots row is
// NOT required) may trigger a momentary OPEN on a connection that has
// allow_member_self_entry on. Never unlock/lock/grant/revoke; never anonymous;
// the member can only ever open the door for themselves (membership + cards
// resolved server-side, nothing identifying taken from the client). Strict
// per-member rate limit; every attempt writes one redacted door_access_log
// row through the single hardened executor.

// Connections in the caller's space that are enabled AND opted into member
// self-entry, returned ONLY when the caller has an active card on file (so
// the dashboard surface is hidden entirely for ineligible members). Members
// have no RLS read on door_connections/member_cards, so this is a service-
// client read after requireMember.
export async function listSelfEntryDoors() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const admin = createAdminClient()
  const { count: cardCount } = await admin
    .from('member_cards')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .eq('is_active', true)
  if (!cardCount || cardCount < 1) return { data: [] }

  const { data: conns, error } = await admin
    .from('door_connections')
    .select('id, name')
    .eq('space_id', member.space_id)
    .eq('is_enabled', true)
    .eq('allow_member_self_entry', true)
    .order('name', { ascending: true })
  if (error) return { error: error.message }
  return { data: (conns ?? []).map(c => ({ id: c.id as string, name: c.name as string })) }
}

export async function selfEntry(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const v = parseInput(doorConnectionIdSchema, input)
  if (!v.ok) return { error: v.error }

  const rl = checkRateLimit(`door-self:${member.space_id}:${member.id}`, 5, 60_000)
  if (!rl.allowed) return { error: 'Too many entry attempts. Wait a moment and try again.' }

  const admin = createAdminClient()

  const { data: conn } = await admin
    .from('door_connections')
    .select('id, adapter, base_url, pinned_host, auth_param, secret_ref, verbs, is_enabled, allow_member_self_entry')
    .eq('id', v.data.connectionId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!conn || !conn.is_enabled || !conn.allow_member_self_entry) {
    return { error: 'Self-entry is not available for that door.' }
  }

  // Locked rule: any active card on file is enough (no door_card_slots row).
  const { count: cardCount } = await admin
    .from('member_cards')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .eq('is_active', true)
  if (!cardCount || cardCount < 1) {
    await auditDoor(admin, {
      spaceId: member.space_id, connectionId: conn.id as string, actorMemberId: member.id,
      targetMemberId: member.id, action: 'self_entry', success: false,
      detail: 'denied: no active card on file',
    })
    return { error: 'You have no active access card on file. Ask a door manager to add one.' }
  }

  const password = await resolveSecret(admin, member.space_id, conn.secret_ref as string | null)

  let query: string
  if (conn.adapter === 'native_heatsync') {
    const enc = encodeHeatSyncControl('open1', password ?? '')
    if (!enc.ok) return { error: enc.reason }
    query = enc.query
  } else {
    const tmpl = (conn.verbs as Record<string, string> | null)?.open
    if (!tmpl) return { error: 'This door has no "open" command configured.' }
    query = applyTemplate(tmpl, { pw: password ?? '' })
  }

  const result = await callDoor({
    url: (conn.base_url as string) + query,
    pinnedHost: conn.pinned_host as string,
    password,
    authParam: (conn.auth_param as string | null) ?? null,
  })

  await auditDoor(admin, {
    spaceId: member.space_id, connectionId: conn.id as string, actorMemberId: member.id,
    targetMemberId: member.id, action: 'self_entry', success: result.ok,
    detail: result.ok ? `status ${result.status}: ${result.snippet}` : `failed: ${result.reason}`,
    password,
  })

  revalidatePath('/dashboard')
  return result.ok ? { data: { ok: true } } : { error: 'The door controller call failed. Check the door audit log for the redacted detail.' }
}

// The signed-in member's OWN door activity (rows where they were the actor or
// the target). door_access_log has no member-facing RLS SELECT, so this uses
// the service client after requireMember and filters to this member only. The
// detail column is already secret-redacted at write time.
export async function listMyDoorActivity() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('door_access_log')
    .select('id, action, success, detail, occurred_at')
    .eq('space_id', member.space_id)
    .or(`actor_member_id.eq.${member.id},target_member_id.eq.${member.id}`)
    .order('occurred_at', { ascending: false })
    .limit(50)
  if (error) return { error: error.message }
  return { data: data ?? [] }
}
