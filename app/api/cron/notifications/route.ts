// Notification dispatcher. Drains a bounded batch of pending outbox rows and
// sends them via the email transport. Designed to be hit once a minute by the
// droplet's crontab (see docs/DEPLOYMENT.md). Unauthenticated by session
// (cron has none) so proxy.ts whitelists /api/cron; trust is the CRON_SECRET
// shared-secret header, compared in constant time.
//
// Re-entrancy: a row is updated immediately after its own send, and sendEmail
// passes the row id as Resend's Idempotency-Key, so an overlapping run cannot
// double-send. Transient failures (retryable) stay pending for the next
// minute until the attempt budget is exhausted; permanent ones go to 'failed'.
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { isTerminalAttempt, MAX_NOTIFICATION_ATTEMPTS } from '@/lib/notifications-logic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BATCH = 20
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
  const { data: rows, error } = await admin
    .from('notifications')
    .select('id, recipient, subject, body_html, body_text, attempts')
    .eq('status', 'pending')
    .eq('channel', 'email')
    .lt('attempts', MAX_NOTIFICATION_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  let failed = 0
  let retried = 0

  for (const row of rows ?? []) {
    const res = await sendEmail({
      to: row.recipient as string,
      subject: row.subject as string,
      html: row.body_html as string,
      text: row.body_text as string,
      idempotencyKey: row.id as string,
    })

    if (res.ok) {
      await admin
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id)
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
      if (terminal) failed++
      else retried++
    }

    if (SPACING_MS) await sleep(SPACING_MS)
  }

  return NextResponse.json({ scanned: rows?.length ?? 0, sent, failed, retried })
}
