// The additive permission model's integrity rests on one RLS gate: only an
// admin/board may WRITE space_role_permissions. If a plain member could insert
// a grant, they could hand themselves any capability (settings.manage, etc.).
// This locks that gate against real Postgres -- previously untested. Same
// role-simulation harness as the other integration tests.
import { describe, it, expect, afterAll } from 'vitest'
import { dbReady, execAsUser, rowsAsUser, seedSpace, seedMember, dropSpace } from './db'

const d = describe.skipIf(!dbReady)

d('space_role_permissions write RLS (privilege-escalation guard)', () => {
  const spaces: string[] = []
  function space(): string {
    const { spaceId } = seedSpace()
    spaces.push(spaceId)
    return spaceId
  }
  afterAll(() => spaces.forEach(dropSpace))

  it('a plain member cannot grant themselves a permission', () => {
    const sid = space()
    const member = seedMember(sid, { role: 'member' })
    const r = execAsUser(
      member.userId,
      `insert into space_role_permissions (space_id, subject, permission) values ('${sid}','member','settings.manage');`,
    )
    expect(r.ok).toBe(false)
  })

  it('an admin can grant a permission (positive control)', () => {
    const sid = space()
    const admin = seedMember(sid, { role: 'admin' })
    const r = execAsUser(
      admin.userId,
      `insert into space_role_permissions (space_id, subject, permission) values ('${sid}','member','ops.kb.write');`,
    )
    expect(r.ok).toBe(true)
  })

  it("a member's delete of an existing grant is filtered out (the grant survives)", () => {
    const sid = space()
    const admin = seedMember(sid, { role: 'admin' })
    const member = seedMember(sid, { role: 'member' })
    // The space seed already grants 'member' -> 'ops.kb.read'. A member's DELETE
    // is USING-gated to admin/board, so it matches 0 rows (no error, no effect).
    execAsUser(member.userId, `delete from space_role_permissions where space_id='${sid}' and subject='member' and permission='ops.kb.read';`)
    const still = rowsAsUser(
      admin.userId,
      `select 1 from space_role_permissions where space_id='${sid}' and subject='member' and permission='ops.kb.read'`,
    )
    expect(still.length).toBe(1)
  })

  it('an admin cannot write a grant into another space (WITH CHECK pins space)', () => {
    const sidA = space()
    const adminA = seedMember(sidA, { role: 'admin' })
    const sidB = space()
    const r = execAsUser(
      adminA.userId,
      `insert into space_role_permissions (space_id, subject, permission) values ('${sidB}','member','settings.manage');`,
    )
    expect(r.ok).toBe(false)
  })
})
