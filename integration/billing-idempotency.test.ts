// Validates the DB-level idempotency invariants the money + notification
// paths rely on (currently only asserted via app code / manual audit):
//  - stripe_webhook_events PK = Stripe replay protection (a retried event id
//    can't be processed twice).
//  - member_billing UNIQUE(space_id,member_id) = the webhook's
//    onConflict(space_id,member_id) upsert never duplicates a member's row.
//  - notifications UNIQUE(space_id,dedupe_key) = the webhook enqueue's
//    ignoreDuplicates (ON CONFLICT DO NOTHING) collapses a replayed event to
//    one outbox row (Phase 2 / D-series correctness).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { dbReady, execService, rows, seedSpace, seedMember, dropSpace, uuid } from './db'

const d = describe.skipIf(!dbReady)

d('billing + notification idempotency invariants', () => {
  let spaceId: string
  let memberId: string

  beforeAll(() => {
    spaceId = seedSpace().spaceId
    memberId = seedMember(spaceId).memberId
  })
  afterAll(() => dropSpace(spaceId))

  it('stripe_webhook_events: a replayed event id is rejected (PK) — replay protection', () => {
    const evt = `evt_${uuid()}`
    expect(
      execService(
        `insert into stripe_webhook_events (event_id, space_id, type) values ('${evt}','${spaceId}','invoice.paid');`,
      ).ok,
    ).toBe(true)
    const dup = execService(
      `insert into stripe_webhook_events (event_id, space_id, type) values ('${evt}','${spaceId}','invoice.paid');`,
    )
    expect(dup.ok).toBe(false)
    expect(dup.err).toMatch(/duplicate key|unique|23505/i)
  })

  it('member_billing: UNIQUE(space_id,member_id) — onConflict upsert stays one row', () => {
    expect(
      execService(
        `insert into member_billing (space_id, member_id, subscription_status, current_period_end)
         values ('${spaceId}','${memberId}','active', now() + interval '30 days');`,
      ).ok,
    ).toBe(true)
    // plain duplicate insert is rejected
    const dup = execService(
      `insert into member_billing (space_id, member_id, subscription_status) values ('${spaceId}','${memberId}','past_due');`,
    )
    expect(dup.ok).toBe(false)
    expect(dup.err).toMatch(/duplicate key|unique|23505/i)
    // the webhook's onConflict(space_id,member_id) upsert updates in place
    expect(
      execService(
        `insert into member_billing (space_id, member_id, subscription_status) values ('${spaceId}','${memberId}','canceled')
         on conflict (space_id, member_id) do update set subscription_status = excluded.subscription_status;`,
      ).ok,
    ).toBe(true)
    const r = rows<{ n: number; s: string }>(
      `select count(*)::int n, max(subscription_status) s from member_billing where space_id='${spaceId}' and member_id='${memberId}'`,
    )
    expect(r[0].n).toBe(1)
    expect(r[0].s).toBe('canceled')
  })

  it('notifications: UNIQUE(space_id,dedupe_key) + ON CONFLICT DO NOTHING — replayed enqueue is one row', () => {
    const key = `stripe:inv:${uuid()}:paid`
    const ins = (onConflict: boolean) =>
      execService(
        `insert into notifications (space_id, member_id, type, recipient, subject, body_html, body_text, dedupe_key)
         values ('${spaceId}','${memberId}','dues_renewed','a@b.test','s','<p>h</p>','t','${key}')
         ${onConflict ? 'on conflict (space_id, dedupe_key) do nothing' : ''};`,
      )
    expect(ins(false).ok).toBe(true)
    // raw duplicate rejected
    expect(ins(false).ok).toBe(false)
    // the webhook's ignoreDuplicates path is a clean no-op
    expect(ins(true).ok).toBe(true)
    const r = rows<{ n: number }>(
      `select count(*)::int n from notifications where space_id='${spaceId}' and dedupe_key='${key}'`,
    )
    expect(r[0].n).toBe(1) // replay collapsed to exactly one outbox row
  })
})
