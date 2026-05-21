// Pure, dependency-free logic for Door epic Phase 4 (inbound access-log
// ingest). No Supabase/React/Next. Two transports feed one normalized event
// shape:
//   * poll: parse a HeatSync `?z` log dump (parseHeatSyncLog)
//   * webhook: normalize pushed event JSON (normalizeWebhookEvents)
// The ingest action resolves each event's card to a member and dedupe-inserts
// it. Card matching is here so it is unit-tested in isolation.

// HeatSync firmware splits a card number across two log keys with this divisor
// (zyphlar/Open_Access_Control_Ethernet.ino, const int divisor = 32767):
// granted G(=num%divisor)+g(=num/divisor); denied D+d. Reconstruct num =
// high*divisor + low.
const HEATSYNC_DIVISOR = 32767n

export type DoorIngestEvent = {
  // 'granted'/'denied' for an access decision; 'unknown' when a webhook payload
  // does not state one.
  result: 'granted' | 'denied' | 'unknown'
  // Reconstructed decimal card number (HeatSync poll). null for webhook events
  // that send a uid string instead.
  cardNumber: string | null
  // Raw card identifier string as sent (webhook). null for poll events.
  cardUid: string | null
  // ISO 8601 event time when the source provides one (webhook). Poll has no
  // reliable absolute date, so it is null and the row uses ingest time.
  occurredAt: string | null
  // Human-readable audit detail. Redacted again at write time.
  detail: string
  // Per-event idempotency token, unique per connection. Poll keys include the
  // ring-buffer slot position so an unchanged re-poll dedupes; webhook keys are
  // the caller-supplied event id.
  dedupeKey: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Parse a HeatSync `?z` response. Output is `<pre>`-wrapped lines of "K: N"
// dumped from a fixed 40-slot ring buffer in raw slot order (empty slots print
// as a NUL key with 0). We pair G+g (granted) and D+d (denied), reconstruct
// the decimal card number, and stamp best-effort H:M:E time-of-day when the
// firmware verbosity emitted it. Raw reads (R/r) are intentionally NOT ingested
// (they duplicate the grant decision at high verbosity and carry no decision).
//
// The ring buffer has no per-entry sequence id, so dedup keys include the slot
// position: an unchanged re-poll dedupes, a genuinely new event in a different
// slot is distinct. The unavoidable limit is that overwriting a slot with
// byte-identical content (same card, same second) collides; the webhook path
// (explicit event ids) is the reliable transport for production.
export function parseHeatSyncLog(text: string, opts?: { maxEvents?: number }): DoorIngestEvent[] {
  const max = opts?.maxEvents ?? 200
  const body = text.replace(/<\/?pre>/gi, '')
  const lines = body.split(/\r?\n/)

  type Tok = { key: string; val: number; slot: number }
  const toks: Tok[] = []
  let slot = 0
  // The body is from an untrusted controller over plaintext HTTP (MITM-able).
  // Bound the value to 15 digits: real firmware values are int32 (<=10 digits),
  // and capping here keeps Number()/BigInt() exact and prevents an Infinity ->
  // BigInt() throw from a hostile response. Over-long digit runs simply don't
  // match and are skipped as junk.
  for (const line of lines) {
    const m = line.match(/^\s*(\S):\s*(-?\d{1,15})\s*$/)
    if (!m) continue
    const key = m[1]
    // Every printed slot advances the slot counter, but NUL/control keys are
    // empty ring slots and never emit an event.
    if (key.charCodeAt(0) >= 32) toks.push({ key, val: Number(m[2]), slot })
    slot++
  }

  const events: DoorIngestEvent[] = []
  let h: number | null = null
  let mi: number | null = null
  let e: number | null = null
  for (let i = 0; i < toks.length && events.length < max; i++) {
    const t = toks[i]
    if (t.key === 'H') { h = t.val; continue }
    if (t.key === 'M') { mi = t.val; continue }
    if (t.key === 'E') { e = t.val; continue }
    if (t.key !== 'G' && t.key !== 'D') continue

    const result = t.key === 'G' ? 'granted' : 'denied'
    const hiKey = t.key === 'G' ? 'g' : 'd'
    // The firmware emits the high half immediately after the low half, so look
    // only a few tokens ahead. A bounded window keeps this linear and avoids
    // pairing a G with a distant unrelated g when this event's half is missing.
    let hiTok: Tok | undefined
    for (let j = i + 1; j < toks.length && j <= i + 3; j++) {
      if (toks[j].key === hiKey) { hiTok = toks[j]; break }
    }
    const low = t.val >= 0 ? BigInt(t.val) : 0n
    const high = hiTok && hiTok.val >= 0 ? BigInt(hiTok.val) : 0n
    const cardNumber = (high * HEATSYNC_DIVISOR + low).toString()
    const tod = h !== null && mi !== null && e !== null ? `${pad2(h)}:${pad2(mi)}:${pad2(e)}` : null
    const raw = hiTok ? `${t.key}:${t.val} ${hiKey}:${hiTok.val}` : `${t.key}:${t.val}`

    events.push({
      result,
      cardNumber,
      cardUid: null,
      occurredAt: null,
      detail: tod ? `${result} card #${cardNumber} at ${tod}` : `${result} card #${cardNumber}`,
      dedupeKey: `hs:${t.slot}:${t.key}:${cardNumber}:${tod ?? ''}`,
    })
  }
  return events
}

// A single inbound webhook event after Zod validation (see
// doorWebhookPayloadSchema). The caller-supplied `id` MUST be stable per event
// so retries dedupe; everything else is best-effort.
export type WebhookEventInput = {
  id: string
  card_uid?: string | null
  card_number?: string | null
  result?: 'granted' | 'denied' | 'unknown'
  occurred_at?: string | null
}

export function normalizeWebhookEvents(events: WebhookEventInput[]): DoorIngestEvent[] {
  return events.map(ev => {
    const result = ev.result ?? 'unknown'
    const id = String(ev.id)
    const cardUid = ev.card_uid ? String(ev.card_uid) : null
    const cardNumber = ev.card_number ? String(ev.card_number) : null
    const who = cardUid ? `uid ${cardUid}` : cardNumber ? `card #${cardNumber}` : 'unknown card'
    return {
      result,
      cardNumber,
      cardUid,
      occurredAt: ev.occurred_at ? String(ev.occurred_at) : null,
      detail: `${result} ${who}`,
      dedupeKey: `wh:${id}`,
    }
  })
}

// Parse a stored card_uid as HEX. HeatSync stores the uid as hex (the grant
// encoder requires 1-8 hex chars), so this is the canonical reading. Returns
// null for a non-hex value (it cannot be a HeatSync card).
function hexToBigInt(uid: string): bigint | null {
  const u = uid.trim().toLowerCase().replace(/^0x/, '')
  if (!/^[0-9a-f]+$/.test(u)) return null
  try {
    return BigInt('0x' + u)
  } catch {
    return null
  }
}

// True when a stored member_cards.card_uid refers to the same physical card as
// an ingested event. The match is source-anchored to the HeatSync model rather
// than guessing radixes symmetrically (which mis-attributes all-digit uids,
// e.g. stored "16" = hex 0x16 = 22 must NOT match a decimal poll of card 16):
//
//   * A reported DECIMAL number (poll `?z`, or a webhook card_number, or an
//     all-digit webhook card_uid) matches when hexInt(storedUid) equals it,
//     because the stored uid is hex and the controller reports the decimal
//     card number.
//   * A webhook card_uid that is not purely decimal is matched by exact
//     (case-insensitive) string equality -- a relay should send the uid as
//     stored.
export function cardMatchesEvent(storedUid: string, ev: DoorIngestEvent): boolean {
  const stored = storedUid.trim().toLowerCase()
  if (!stored) return false

  // Exact uid match (a webhook relay sending the stored hex uid).
  if (ev.cardUid && stored === ev.cardUid.trim().toLowerCase()) return true

  // Decimal card number: the poll number, an explicit webhook card_number, or
  // an all-digit webhook card_uid.
  const decStr =
    ev.cardNumber ?? (ev.cardUid && /^\d+$/.test(ev.cardUid.trim()) ? ev.cardUid.trim() : null)
  if (decStr) {
    const h = hexToBigInt(stored)
    if (h !== null) {
      try {
        if (h === BigInt(decStr)) return true
      } catch {
        /* ignore */
      }
    }
  }
  return false
}
