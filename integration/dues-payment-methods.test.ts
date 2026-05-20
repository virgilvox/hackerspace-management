// RLS for dues_payment_methods (migration 049): admin-configured external dues
// links are member-readable but admin/board-writable, and scoped per space.
// Proven against real Postgres via the role-simulation harness (set role
// authenticated + request.jwt.claims sub), the same technique as
// privilege-status-gate.test.ts.
import { describe, it, expect, afterAll } from 'vitest'
import {
  dbReady,
  execService,
  execAsUser,
  rowsAsUser,
  seedSpace,
  seedMember,
  dropSpace,
} from './db'

const d = describe.skipIf(!dbReady)

d('dues_payment_methods RLS', () => {
  const spaces: string[] = []
  function space(): string {
    const { spaceId } = seedSpace()
    spaces.push(spaceId)
    return spaceId
  }
  afterAll(() => spaces.forEach(dropSpace))

  it('admin can insert, any member can read, a non-admin member cannot write', () => {
    const sid = space()
    const admin = seedMember(sid, { role: 'admin' })
    const member = seedMember(sid, { role: 'member' })

    const ins = execAsUser(
      admin.userId,
      `insert into dues_payment_methods (space_id, platform, url) values ('${sid}','paypal','https://paypal.me/itest');`,
    )
    expect(ins.ok).toBe(true)

    const seen = rowsAsUser<{ platform: string; url: string }>(
      member.userId,
      `select platform, url from dues_payment_methods where space_id='${sid}'`,
    )
    expect(seen).toHaveLength(1)
    expect(seen[0].platform).toBe('paypal')

    const memberWrite = execAsUser(
      member.userId,
      `insert into dues_payment_methods (space_id, platform, url) values ('${sid}','venmo','https://venmo.com/itest');`,
    )
    expect(memberWrite.ok).toBe(false)
  })

  it('a member of another space cannot read these methods', () => {
    const sidA = space()
    seedMember(sidA, { role: 'admin' })
    execService(
      `insert into dues_payment_methods (space_id, platform, url) values ('${sidA}','zeffy','https://www.zeffy.com/itest');`,
    )

    const sidB = space()
    const memberB = seedMember(sidB, { role: 'member' })
    const seen = rowsAsUser(
      memberB.userId,
      `select platform from dues_payment_methods where space_id='${sidA}'`,
    )
    expect(seen).toHaveLength(0)
  })

  it('an admin cannot write a method into another space (WITH CHECK pins space)', () => {
    const sidA = space()
    const adminA = seedMember(sidA, { role: 'admin' })
    const sidB = space()

    const r = execAsUser(
      adminA.userId,
      `insert into dues_payment_methods (space_id, platform, url) values ('${sidB}','paypal','https://paypal.me/cross');`,
    )
    expect(r.ok).toBe(false)
  })

  it('the url CHECK rejects non-https schemes even via the service path (050)', () => {
    const sid = space()
    // service path bypasses RLS + the app Zod check, so the DB CHECK is the
    // last line of defense against a stored javascript:/http: href.
    const jsUrl = execService(
      `insert into dues_payment_methods (space_id, platform, url) values ('${sid}','paypal','javascript:alert(1)');`,
    )
    expect(jsUrl.ok).toBe(false)
    const httpUrl = execService(
      `insert into dues_payment_methods (space_id, platform, url) values ('${sid}','venmo','http://insecure');`,
    )
    expect(httpUrl.ok).toBe(false)
    const httpsUrl = execService(
      `insert into dues_payment_methods (space_id, platform, url) values ('${sid}','zeffy','https://ok.example');`,
    )
    expect(httpsUrl.ok).toBe(true)
  })

  it('an unverified member cannot write even with admin role (046 status gate)', () => {
    const sid = space()
    const pending = seedMember(sid, { role: 'admin', status: 'unverified' })
    const r = execAsUser(
      pending.userId,
      `insert into dues_payment_methods (space_id, platform, url) values ('${sid}','paypal','https://paypal.me/x');`,
    )
    expect(r.ok).toBe(false)
  })
})
