import { createAdminClient } from '@/lib/supabase/admin'
import { redactDoorSecrets } from '@/lib/door-logic'
import { pickLowestFreeSlot, slotCapacity } from '@/lib/door-slots-logic'
import { resolveDoorSecret } from '@/lib/door/secret'

// Connection door password is loaded + decrypted via the shared
// resolveDoorSecret (lib/door/secret.ts); service client, never returned to
// the browser. Aliased here to keep the existing call sites unchanged.
export const resolveSecret = resolveDoorSecret

export function isUniqueViolation(message: string): boolean {
  return /duplicate key value|already exists|unique constraint/i.test(message)
}

type ConnRow = {
  id: string
  adapter: string
  base_url: string
  pinned_host: string
  auth_param: string | null
  secret_ref: string | null
  verbs: Record<string, string> | null
  is_enabled: boolean
}

export async function loadEnabledConnection(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  connectionId: string,
): Promise<{ ok: true; conn: ConnRow } | { ok: false; error: string }> {
  const { data } = await admin
    .from('door_connections')
    .select('id, adapter, base_url, pinned_host, auth_param, secret_ref, verbs, is_enabled')
    .eq('id', connectionId)
    .eq('space_id', spaceId)
    .maybeSingle()
  if (!data) return { ok: false, error: 'Connection not found' }
  if (!data.is_enabled) return { ok: false, error: 'This connection is disabled.' }
  return { ok: true, conn: data as unknown as ConnRow }
}

export async function auditDoor(
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
    authParam?: string | null
  },
) {
  await admin.from('door_access_log').insert({
    space_id: row.spaceId,
    connection_id: row.connectionId,
    actor_member_id: row.actorMemberId,
    target_member_id: row.targetMemberId ?? null,
    action: row.action,
    success: row.success,
    detail: redactDoorSecrets(row.detail.slice(0, 1000), row.password, row.authParam),
  })
}

// Reserve (or reuse) the card's slot on this connection. The DB unique
// constraints arbitrate concurrency: (connection_id, card_id) makes re-grant
// idempotent; (connection_id, slot) makes a slot race fail loudly so we retry.
export async function reserveSlot(
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
