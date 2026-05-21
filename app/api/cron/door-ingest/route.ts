// Door inbound-log poll. Hit once a minute by the droplet's crontab (see
// docs/DEPLOYMENT.md) to pull access events from each native-HeatSync
// connection that has opted into inbound ingest. Unauthenticated by session
// (cron has none); proxy.ts whitelists this exact path and trust is the
// CRON_SECRET shared secret, compared in constant time.
//
// Each connection's `?z` log is read through the SAME hardened executor as the
// outbound actions (SSRF host pin, no redirects, time/body caps, secret
// redaction). Parsed events are resolved to members and idempotently inserted
// (dedupe_key + ON-CONFLICT no-op), so overlapping runs and unchanged re-polls
// are safe. Generic controllers ingest via the per-connection webhook instead;
// only native_heatsync has a characterized log format to parse.
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { pollConnectionLog, ingestEvents, type IngestConn } from '@/lib/door/ingest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Bounded work per run: cap the connections polled so a misconfigured fleet
// cannot make one cron tick run unbounded. A single hackerspace has one or two
// doors, so this is generous.
const MAX_CONNECTIONS = 50

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
  const { data: conns, error } = await admin
    .from('door_connections')
    .select('id, space_id, adapter, base_url, pinned_host, auth_param, secret_ref, verbs, is_enabled')
    .eq('is_enabled', true)
    .eq('inbound_enabled', true)
    .eq('adapter', 'native_heatsync')
    .order('created_at', { ascending: true })
    .limit(MAX_CONNECTIONS)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Poll connections concurrently: each connection is independent, and the
  // executor's per-call timeout means a sequential loop would take the SUM of
  // all timeouts (a slow/unreachable fleet could run minutes and overlap the
  // next tick). allSettled bounds a tick to roughly the slowest single poll;
  // each connection is isolated so one misbehaving controller (untrusted,
  // plaintext HTTP) cannot 500 the run or starve the rest. MAX_CONNECTIONS
  // caps the fan-out.
  const list = (conns ?? []) as unknown as IngestConn[]
  const settled = await Promise.allSettled(
    list.map(async c => {
      const poll = await pollConnectionLog(admin, c)
      if (!poll.ok) {
        console.error(`[door-ingest] connection ${c.id}: ${poll.detail}`)
        return { failed: true, inserted: 0, resolved: 0 }
      }
      const res = await ingestEvents(admin, c.space_id, c.id, poll.events)
      return { failed: false, inserted: res.inserted, resolved: res.resolved }
    }),
  )

  let inserted = 0
  let resolved = 0
  let failed = 0
  for (const r of settled) {
    if (r.status === 'rejected') {
      failed++
      console.error('[door-ingest] connection threw:', r.reason instanceof Error ? r.reason.message : r.reason)
      continue
    }
    if (r.value.failed) failed++
    inserted += r.value.inserted
    resolved += r.value.resolved
  }

  return NextResponse.json({ ok: true, polled: list.length, inserted, resolved, failed })
}
