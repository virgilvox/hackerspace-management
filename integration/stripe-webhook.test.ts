// End-to-end integration of the Stripe webhook ROUTE HANDLER — the biggest
// untested orchestration (the harness's other files cover its DB-layer and
// pure-logic pieces; this exercises the WIRING where the Phase-3 P0s and the
// deeper-audit D5 bug actually lived): real signature verification, per-space
// secret/config resolution from the vault, the stripe_webhook_events
// idempotency, applySubscription, the D5 out-of-order monotonic guard, and
// the status-update path. Uses customer.subscription.updated so there is no
// Stripe API network call and no payments/enum dependency.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import Stripe from 'stripe'
import { NextRequest } from 'next/server'
import { dbReady, execService, rows, seedSpace, seedMember, dropSpace, uuid } from './db'

const WHSEC = 'whsec_itest_secret'
const signer = new Stripe('sk_test_dummy')

// Local Supabase REST creds so the route's createAdminClient hits the local
// stack. Parsed from `supabase status -o env`; skip the suite if unavailable.
function loadSupabaseEnv(): boolean {
  try {
    const out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' })
    const get = (k: string) =>
      out.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1).replace(/^"|"$/g, '')
    const url = get('API_URL')
    const key = get('SERVICE_ROLE_KEY')
    if (!url || !key) return false
    process.env.NEXT_PUBLIC_SUPABASE_URL = url
    process.env.SUPABASE_SERVICE_ROLE_KEY = key
    return true
  } catch {
    return false
  }
}
const envOk = loadSupabaseEnv()
const d = describe.skipIf(!dbReady || !envOk)

function subEvent(opts: {
  eventId?: string
  memberId: string
  spaceId: string
  status?: string
  periodEndDaysFromNow?: number
}) {
  const periodEnd =
    Math.floor(Date.now() / 1000) + (opts.periodEndDaysFromNow ?? 30) * 86400
  return {
    id: opts.eventId ?? `evt_${uuid()}`,
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: `sub_${uuid()}`,
        status: opts.status ?? 'active',
        customer: `cus_${uuid()}`,
        metadata: { member_id: opts.memberId, space_id: opts.spaceId },
        items: { data: [{ current_period_end: periodEnd }] },
      },
    },
  }
}

async function postEvent(spaceId: string, event: object, opts: { badSig?: boolean; noSig?: boolean } = {}) {
  // POST is imported lazily AFTER env is set so createAdminClient binds local.
  const { POST } = await import('@/app/api/stripe/webhook/[space]/route')
  const raw = JSON.stringify(event)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (!opts.noSig) {
    headers['stripe-signature'] = opts.badSig
      ? 't=1,v1=deadbeef'
      : signer.webhooks.generateTestHeaderString({ payload: raw, secret: WHSEC })
  }
  const req = new NextRequest(`http://itest/api/stripe/webhook/${spaceId}`, {
    method: 'POST',
    body: raw,
    headers,
  })
  const res = await POST(req, { params: Promise.resolve({ space: spaceId }) })
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

d('Stripe webhook route handler (end-to-end)', () => {
  let spaceId: string
  let memberId: string

  beforeAll(() => {
    spaceId = seedSpace().spaceId
    memberId = seedMember(spaceId, { status: 'current' }).memberId
    const keyRef = uuid()
    const whRef = uuid()
    execService(
      `insert into secrets (id, space_id, label, value) values ('${keyRef}','${spaceId}','stripe key','sk_test_dummy');
       insert into secrets (id, space_id, label, value) values ('${whRef}','${spaceId}','stripe whsec','${WHSEC}');
       insert into integrations (space_id, platform, config)
       values ('${spaceId}','stripe','{"secret_key_ref":"${keyRef}","webhook_secret_ref":"${whRef}"}'::jsonb);`,
    )
  })
  afterAll(() => dropSpace(spaceId))

  it('missing signature -> 400', async () => {
    const r = await postEvent(spaceId, subEvent({ memberId, spaceId }), { noSig: true })
    expect(r.status).toBe(400)
  })

  it('bad signature -> 400 with generic message (E3)', async () => {
    const r = await postEvent(spaceId, subEvent({ memberId, spaceId }), { badSig: true })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('Invalid signature')
  })

  it('valid subscription.updated -> billing upserted + member current + event recorded', async () => {
    const evt = subEvent({ memberId, spaceId, status: 'active', periodEndDaysFromNow: 30 })
    const r = await postEvent(spaceId, evt)
    expect(r.status).toBe(200)
    const ev = rows<{ n: number }>(
      `select count(*)::int n from stripe_webhook_events where event_id='${evt.id}'`,
    )
    expect(ev[0].n).toBe(1)
    const mb = rows<{ subscription_status: string; cpe: string }>(
      `select subscription_status, current_period_end cpe from member_billing where space_id='${spaceId}' and member_id='${memberId}'`,
    )
    expect(mb).toHaveLength(1)
    expect(mb[0].subscription_status).toBe('active')
    expect(new Date(mb[0].cpe).getTime()).toBeGreaterThan(Date.now())
    const sm = rows<{ status: string; lpa: string | null }>(
      `select status, last_paid_at lpa from space_members where id='${memberId}'`,
    )
    expect(sm[0].status).toBe('current')
    expect(sm[0].lpa).not.toBeNull()
  })

  it('replay of the same event id -> 200 duplicate, no second processing', async () => {
    const evt = subEvent({ memberId, spaceId })
    const first = await postEvent(spaceId, evt)
    expect(first.status).toBe(200)
    const replay = await postEvent(spaceId, evt) // identical event.id
    expect(replay.status).toBe(200)
    expect(replay.body.duplicate).toBe(true)
    const cnt = rows<{ n: number }>(
      `select count(*)::int n from stripe_webhook_events where event_id='${evt.id}'`,
    )
    expect(cnt[0].n).toBe(1)
  })

  it('D5: a stale out-of-order event must NOT rewind current_period_end', async () => {
    const m2 = seedMember(spaceId, { status: 'current' }).memberId
    await postEvent(spaceId, subEvent({ memberId: m2, spaceId, periodEndDaysFromNow: 60 }))
    const after1 = rows<{ cpe: string }>(
      `select current_period_end cpe from member_billing where member_id='${m2}'`,
    )[0].cpe
    // A late/stale event carrying an OLDER period (distinct event id).
    await postEvent(spaceId, subEvent({ memberId: m2, spaceId, periodEndDaysFromNow: 10 }))
    const after2 = rows<{ cpe: string }>(
      `select current_period_end cpe from member_billing where member_id='${m2}'`,
    )[0].cpe
    expect(new Date(after2).getTime()).toBe(new Date(after1).getTime()) // not rewound
  })
})
