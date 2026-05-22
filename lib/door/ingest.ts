// Server-only. The shared ingest core for Door epic Phase 4. Both transports
// (the poll cron and the inbound webhook) parse/normalize events into
// DoorIngestEvent[] and hand them here to resolve each card to a member and
// idempotently insert audit rows. door_access_log has no client write policy,
// so the service (admin) client is the only writer, exactly as for the
// outbound actions.

import type { createAdminClient } from '@/lib/supabase/admin'
import { callDoor } from './executor'
import { resolveDoorSecret } from './secret'
import { encodeHeatSyncControl, applyTemplate, redactDoorSecrets } from '@/lib/door-logic'
import {
  parseHeatSyncLog,
  cardMatchesEvent,
  type DoorIngestEvent,
} from '@/lib/door-log-logic'
import { captureException } from '@/lib/observability/capture'

type Admin = ReturnType<typeof createAdminClient>

// The subset of door_connections the ingest paths read (service client).
export type IngestConn = {
  id: string
  space_id: string
  adapter: string
  base_url: string
  pinned_host: string
  auth_param: string | null
  secret_ref: string | null
  verbs: Record<string, string> | null
  is_enabled: boolean
}

function isUniqueViolation(message: string): boolean {
  return /duplicate key value|already exists|unique constraint/i.test(message)
}

function actionFor(result: DoorIngestEvent['result']): string {
  if (result === 'granted') return 'entry'
  if (result === 'denied') return 'entry_denied'
  return 'inbound'
}

// Resolve each event's card to a member and insert one redacted, deduped
// door_access_log row per new event. Returns counts for the caller's response.
// Dedup is two-layered: a pre-filter against existing (connection_id,
// dedupe_key) cuts the common re-poll case to a single SELECT and zero writes,
// and the partial-unique index makes a concurrent insert race a no-op (the
// unique violation is swallowed per row).
export async function ingestEvents(
  admin: Admin,
  spaceId: string,
  connectionId: string,
  events: DoorIngestEvent[],
): Promise<{ inserted: number; resolved: number; skipped: number }> {
  if (events.length === 0) return { inserted: 0, resolved: 0, skipped: 0 }

  const { data: cards } = await admin
    .from('member_cards')
    .select('id, card_uid, member_id')
    .eq('space_id', spaceId)
    .eq('is_active', true)
  const cardList = (cards ?? []) as { id: string; card_uid: string; member_id: string | null }[]

  const keys = events.map(e => e.dedupeKey)
  const { data: existing } = await admin
    .from('door_access_log')
    .select('dedupe_key')
    .eq('connection_id', connectionId)
    .in('dedupe_key', keys)
  const have = new Set((existing ?? []).map(r => r.dedupe_key as string))

  let inserted = 0
  let resolved = 0
  let skipped = 0
  for (const ev of events) {
    if (have.has(ev.dedupeKey)) {
      skipped++
      continue
    }
    const card = cardList.find(c => cardMatchesEvent(c.card_uid, ev))
    const targetMemberId = card?.member_id ?? null
    if (card) resolved++

    const detail = redactDoorSecrets(
      `${ev.detail} (${card ? 'member matched' : 'no card match'})`.slice(0, 1000),
      null,
      null,
    )

    const row: Record<string, unknown> = {
      space_id: spaceId,
      connection_id: connectionId,
      actor_member_id: null,
      target_member_id: targetMemberId,
      action: actionFor(ev.result),
      success: ev.result === 'granted',
      detail,
      dedupe_key: ev.dedupeKey,
    }
    // A webhook caller supplies occurred_at; accept only a parseable,
    // not-in-the-future time (60s skew) so a relay cannot pin spoofed rows to
    // the top of the operator's occurred_at-ordered log. Otherwise the row
    // defaults to ingest time.
    if (ev.occurredAt) {
      const t = Date.parse(ev.occurredAt)
      if (!Number.isNaN(t) && t <= Date.now() + 60_000) {
        row.occurred_at = new Date(t).toISOString()
      }
    }

    const { error } = await admin.from('door_access_log').insert(row)
    if (error) {
      // A concurrent ingest already inserted this exact event: not an error.
      if (!isUniqueViolation(error.message)) {
        // Anything else (e.g. a transient DB error) is surfaced via console so
        // the row is not silently lost; the next poll re-attempts it.
        console.error('[door-ingest] insert failed:', error.message)
        captureException(error, { surface: 'door/ingest', tags: { stage: 'insert' } })
      }
      continue
    }
    inserted++
  }
  return { inserted, resolved, skipped }
}

// Poll a single native-HeatSync connection's `?z` log and return parsed events.
// Only native_heatsync is parsed (its wire format is characterized); generic
// controllers ingest via the webhook. The full ring-buffer body is requested
// (fullBody) so the parser sees every slot.
export async function pollConnectionLog(
  admin: Admin,
  conn: IngestConn,
): Promise<{ ok: boolean; events: DoorIngestEvent[]; detail: string }> {
  const password = await resolveDoorSecret(admin, conn.space_id, conn.secret_ref)

  let query: string
  if (conn.adapter === 'native_heatsync') {
    const enc = encodeHeatSyncControl('log', password ?? '')
    if (!enc.ok) return { ok: false, events: [], detail: `encode failed: ${enc.reason}` }
    query = enc.query
  } else {
    return { ok: false, events: [], detail: 'poll supports native_heatsync only; use the webhook' }
  }

  const result = await callDoor({
    url: conn.base_url + query,
    pinnedHost: conn.pinned_host,
    password,
    authParam: conn.auth_param,
    fullBody: true,
  })
  if (!result.ok) {
    return { ok: false, events: [], detail: redactDoorSecrets(`poll failed: ${result.reason}`, password, conn.auth_param) }
  }
  const events = parseHeatSyncLog(result.snippet)
  return { ok: true, events, detail: `polled ${events.length} event(s)` }
}
