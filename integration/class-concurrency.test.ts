// Validates migration 045 (class_signup_tx / class_cancel_tx) against a real
// Postgres: the capacity/waitlist/dedupe logic, the per-session advisory lock
// under genuine concurrency, AND the RETURNS TABLE -> array shape the server
// actions destructure (`Array.isArray(rpc) ? rpc[0] : rpc`). This is the
// concrete prod risk flagged in the assessment: signup/cancel was shipped
// with zero functional coverage.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import {
  dbReady,
  DB_URL,
  rows,
  execService,
  seedSpace,
  seedMember,
  seedClassSession,
  dropSpace,
} from './db'

const execFileP = promisify(execFile)

type SignupRet = { signup_id: string | null; signup_status: string | null; err: string | null }
type CancelRet = { cancelled_id: string | null; promoted_id: string | null; err: string | null }

const d = describe.skipIf(!dbReady)

d('class_signup_tx / class_cancel_tx (migration 045)', () => {
  let spaceId: string
  let sessionId: string
  let m1: string, m2: string, m3: string

  beforeAll(() => {
    spaceId = seedSpace().spaceId
    sessionId = seedClassSession(spaceId, 1).sessionId // capacity = 1
    m1 = seedMember(spaceId).memberId
    m2 = seedMember(spaceId).memberId
    m3 = seedMember(spaceId).memberId
  })
  afterAll(() => dropSpace(spaceId))

  function signup(member: string) {
    return rows<SignupRet>(`select * from class_signup_tx('${sessionId}','${spaceId}','${member}')`)
  }

  it('returns a single-row array (the shape the action destructures)', () => {
    const r = signup(m1)
    expect(Array.isArray(r)).toBe(true)
    expect(r).toHaveLength(1)
    expect(r[0]).toHaveProperty('signup_id')
    expect(r[0]).toHaveProperty('signup_status')
    expect(r[0]).toHaveProperty('err')
  })

  it('first within capacity -> registered; over capacity -> waitlisted', () => {
    // m1 took the only seat above. m2 must waitlist.
    const r2 = signup(m2)
    expect(r2[0].err).toBeNull()
    expect(r2[0].signup_status).toBe('waitlisted')
    expect(r2[0].signup_id).toBeTruthy()
  })

  it('duplicate signup -> err "already", no row inserted', () => {
    const r = signup(m1)
    expect(r[0].err).toBe('already')
    expect(r[0].signup_id).toBeNull()
    const cnt = rows<{ n: number }>(
      `select count(*)::int n from class_signups where session_id='${sessionId}' and member_id='${m1}'`,
    )
    expect(cnt[0].n).toBe(1)
  })

  it('unknown session -> err "no_session"', () => {
    const bogus = '00000000-0000-0000-0000-000000000000'
    const r = rows<SignupRet>(`select * from class_signup_tx('${bogus}','${spaceId}','${m3}')`)
    expect(r[0].err).toBe('no_session')
  })

  it('cancel of the registered member promotes the earliest waitlisted', () => {
    const c = rows<CancelRet>(`select * from class_cancel_tx('${sessionId}','${spaceId}','${m1}')`)
    expect(c[0].err).toBeNull()
    expect(c[0].cancelled_id).toBeTruthy()
    expect(c[0].promoted_id).toBeTruthy()
    // m2 (was waitlisted) is now registered; never exceeds capacity.
    const reg = rows<{ status: string }>(
      `select status from class_signups where session_id='${sessionId}' and member_id='${m2}' and status<>'cancelled'`,
    )
    expect(reg[0].status).toBe('registered')
    const overCap = rows<{ n: number }>(
      `select count(*)::int n from class_signups where session_id='${sessionId}' and status='registered'`,
    )
    expect(overCap[0].n).toBeLessThanOrEqual(1)
  })

  it('cancel when not signed up -> err "not_signed_up"', () => {
    const c = rows<CancelRet>(`select * from class_cancel_tx('${sessionId}','${spaceId}','${m3}')`)
    expect(c[0].err).toBe('not_signed_up')
  })

  it('advisory lock: two CONCURRENT signups at capacity 1 -> exactly one registered', async () => {
    const sess2 = seedClassSession(spaceId, 1).sessionId
    const a = seedMember(spaceId).memberId
    const b = seedMember(spaceId).memberId
    const call = (mid: string) =>
      execFileP('psql', [
        DB_URL,
        '-tAc',
        `select signup_status from class_signup_tx('${sess2}','${spaceId}','${mid}')`,
      ])
    // Fire both before either resolves: the per-session advisory xact lock
    // must serialize them so capacity is never exceeded.
    const [ra, rb] = await Promise.all([call(a), call(b)])
    const results = [ra.stdout.trim(), rb.stdout.trim()].sort()
    expect(results).toEqual(['registered', 'waitlisted'])
    const reg = rows<{ n: number }>(
      `select count(*)::int n from class_signups where session_id='${sess2}' and status='registered'`,
    )
    expect(reg[0].n).toBe(1) // never 2 — the lock held
  })

  it('unlimited capacity (null) -> always registered', () => {
    const openSess = seedClassSession(spaceId, null).sessionId
    for (let i = 0; i < 3; i++) {
      const mid = seedMember(spaceId).memberId
      const r = rows<SignupRet>(`select * from class_signup_tx('${openSess}','${spaceId}','${mid}')`)
      expect(r[0].signup_status).toBe('registered')
    }
  })
})
