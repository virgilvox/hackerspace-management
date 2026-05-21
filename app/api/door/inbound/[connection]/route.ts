// Per-connection inbound door-event webhook. A controller or a relay (e.g. a
// small agent on the space's LAN that reads a non-HeatSync controller, or any
// system that can POST) pushes normalized access events here. Unauthenticated
// by session (the caller has none); proxy.ts whitelists the /api/door/inbound
// prefix and trust is the per-connection bearer secret in the AES vault,
// compared in constant time. Every DB write is post-auth.
//
// This is the reliable inbound transport: each event carries a caller-supplied
// stable id, so retries are idempotent (dedupe_key) and there is none of the
// ring-buffer ambiguity of the HeatSync `?z` poll. Events are resolved to
// members and inserted through the same shared ingest core as the poll.
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDoorSecret } from '@/lib/door/secret'
import { ingestEvents } from '@/lib/door/ingest'
import { normalizeWebhookEvents } from '@/lib/door-log-logic'
import { doorWebhookPayloadSchema } from '@/lib/validations'
import { checkRateLimit } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bearerMatches(req: NextRequest, expected: string): boolean {
  const header = req.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : header
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connection: string }> },
) {
  const { connection: connectionId } = await params
  // Generic 404 for a malformed id so the endpoint does not double as a
  // uuid-shape oracle.
  if (!UUID_RE.test(connectionId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('door_connections')
    .select('id, space_id, inbound_enabled, inbound_secret_ref')
    .eq('id', connectionId)
    .maybeSingle()

  // Do not reveal whether the connection exists vs. has inbound disabled vs.
  // has no secret: an unauthenticated caller gets the same 401 for all of
  // "can't authenticate this request".
  const secret = conn && conn.inbound_enabled
    ? await resolveDoorSecret(admin, conn.space_id as string, (conn.inbound_secret_ref as string | null) ?? null)
    : null
  if (!secret || !bearerMatches(req, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = checkRateLimit(`door-inbound:${connectionId}`, 120, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  // Bound the body before parsing it into memory. The schema caps at 100
  // events, but req.json() reads the whole body first, so reject an oversized
  // declared length up front (64KB is far more than 100 small events need).
  const declaredLen = Number(req.headers.get('content-length') ?? '0')
  if (declaredLen > 65536) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = doorWebhookPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const events = normalizeWebhookEvents(parsed.data.events)
  const res = await ingestEvents(admin, conn!.space_id as string, conn!.id as string, events)
  return NextResponse.json({ received: true, ...res })
}
