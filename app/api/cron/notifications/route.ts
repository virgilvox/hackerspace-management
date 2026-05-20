// Notification dispatcher. Drains a bounded batch of pending outbox rows and
// sends them via the email transport. Designed to be hit once a minute by the
// droplet's crontab (see docs/DEPLOYMENT.md). Unauthenticated by session
// (cron has none) so proxy.ts whitelists /api/cron; trust is the CRON_SECRET
// shared-secret header, compared in constant time.
//
// Re-entrancy: there is no row-level claim/lock, so two overlapping runs can
// scan the same pending rows. This is safe because (a) the crontab fires once
// a minute and a run drains <=20 rows in ~5s, so overlap is rare, and (b)
// sendEmail passes a per-attempt Idempotency-Key (`${id}:${attempts}`):
// concurrent runs of the SAME attempt dedupe at Resend, while the next
// minute's retry of a transiently-failed row is a deliberately fresh send.
// Transient failures stay pending until the attempt budget is exhausted;
// permanent ones go to 'failed'.
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { isTerminalAttempt, MAX_NOTIFICATION_ATTEMPTS } from '@/lib/notifications-logic'
import {
  isMuted,
  type PrefMap,
  type NotificationCategory,
} from '@/lib/notifications-prefs-logic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BATCH = 20
// Oldest-first candidate window we fairness-balance across spaces. Larger
// than BATCH so a burst space cannot crowd smaller spaces out of the window.
const CANDIDATES = 200
// ~4.5 sends/sec, under Resend's 5 req/sec team limit.
const SPACING_MS = 220

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : header
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: candidates, error } = await admin
    .from('notifications')
    .select('id, space_id, member_id, type, recipient, subject, body_html, body_text, attempts')
    .eq('status', 'pending')
    .eq('channel', 'email')
    .lt('attempts', MAX_NOTIFICATION_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(CANDIDATES)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fair drain: round-robin the oldest-first candidates across spaces so one
  // tenant's burst can't head-of-line-block others. Fairness binds only under
  // contention: with a single space pending (the common single-hackerspace
  // deployment) it still drains the full BATCH; the round-robin itself caps
  // any one space's share when multiple spaces compete. Per-space queues are
  // bounded only by the CANDIDATES fetch (oldest-first), and Map insertion
  // order preserves that oldest-first ordering across spaces.
  const bySpace = new Map<string, typeof candidates>()
  for (const c of candidates ?? []) {
    const k = c.space_id as string
    if (!bySpace.has(k)) bySpace.set(k, [])
    bySpace.get(k)!.push(c)
  }
  const rows: NonNullable<typeof candidates> = []
  let added = true
  while (added && rows.length < BATCH) {
    added = false
    for (const arr of bySpace.values()) {
      const next = arr.shift()
      if (next) {
        rows.push(next)
        added = true
        if (rows.length >= BATCH) break
      }
    }
  }

  // Per-member notification preferences for the rows we're about to drain.
  // member_id is a space_members PK (globally unique), so keying by it alone is
  // unambiguous across spaces. A row whose type maps to a category the member
  // muted is marked 'skipped' (a terminal status) so it leaves the pending pool
  // instead of being re-scanned every minute. Billing types and unmapped types
  // are never muteable (see notifications-prefs-logic). member_id null (e.g. a
  // future broadcast) has no member to have a preference, so it always sends.
  const memberIds = Array.from(
    new Set((rows ?? []).map(r => r.member_id as string | null).filter((m): m is string => !!m)),
  )
  const prefsByMember = new Map<string, PrefMap>()
  if (memberIds.length > 0) {
    const { data: prefRows, error: prefErr } = await admin
      .from('notification_preferences')
      .select('member_id, category, enabled')
      .in('member_id', memberIds)
    // Fail open: if the prefs lookup errors, send everything rather than risk
    // silently dropping a wanted (e.g. dues-failure) email on a transient blip.
    if (prefErr) console.error('[cron/notifications] prefs lookup failed:', prefErr.message)
    for (const p of prefRows ?? []) {
      const mid = p.member_id as string
      if (!prefsByMember.has(mid)) prefsByMember.set(mid, {})
      prefsByMember.get(mid)![p.category as NotificationCategory] = p.enabled as boolean
    }
  }

  let sent = 0
  let failed = 0
  let retried = 0
  let skipped = 0

  for (const row of rows ?? []) {
    const memberId = row.member_id as string | null
    if (memberId && isMuted(prefsByMember.get(memberId) ?? {}, row.type as string)) {
      // No send, no Resend call, no rate-limit spacing: muted rows are cheap.
      await admin
        .from('notifications')
        .update({ status: 'skipped', last_error: null })
        .eq('id', row.id)
        .eq('status', 'pending')
      skipped++
      continue
    }

    const res = await sendEmail({
      to: row.recipient as string,
      subject: row.subject as string,
      html: row.body_html as string,
      text: row.body_text as string,
      // Per-attempt, NOT row.id alone: Resend dedupes 24h on key+payload and
      // its docs do not guarantee a failed response is excluded from that
      // cache. A stable key would let a cached transient failure permanently
      // suppress every later retry (email silently lost). Tying the key to
      // the attempt number means concurrent runs of the SAME attempt still
      // dedupe, but the next minute's real retry is a fresh send.
      idempotencyKey: `${row.id}:${(row.attempts as number) ?? 0}`,
    })

    // Guard every status write with `status='pending'`: if an overlapping
    // run already advanced this row, the loser's write is a no-op (a row
    // already 'sent' can't be flipped to 'failed', and vice versa).
    if (res.ok) {
      await admin
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id)
        .eq('status', 'pending')
      sent++
    } else {
      const attempts = (row.attempts as number) + 1
      const terminal = !res.retryable || isTerminalAttempt(attempts)
      await admin
        .from('notifications')
        .update({
          status: terminal ? 'failed' : 'pending',
          attempts,
          last_error: res.error,
        })
        .eq('id', row.id)
        .eq('status', 'pending')
      if (terminal) failed++
      else retried++
    }

    if (SPACING_MS) await sleep(SPACING_MS)
  }

  return NextResponse.json({ scanned: rows?.length ?? 0, sent, failed, retried, skipped })
}
