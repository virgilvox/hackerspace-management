// Door epic Phase 5 (migration 054) against real Postgres. Proves the RLS the
// unit tests cannot: api_buttons CRUD is door.manage-only (members have no read,
// since a button's url/headers/secret_ref are operator config), api_call_log is
// immutable from the client (service-only writes), tenant isolation holds, and
// the new apicall.invoke permission is seeded/backfilled for board.
import { describe, it, expect, afterAll } from 'vitest'
import { dbReady, execService, execAsUser, rowsAsUser, rows, seedSpace, seedMember, dropSpace, uuid } from './db'

const d = describe.skipIf(!dbReady)

function seedButton(spaceId: string, requiredPerm = 'apicall.invoke'): string {
  const id = uuid()
  execService(
    `insert into api_buttons (id, space_id, label, base_url, pinned_host, required_permission)
     values ('${id}','${spaceId}','itest btn','https://device.lan/','device.lan','${requiredPerm}');`,
  )
  return id
}

d('api buttons (054)', () => {
  const spaces: string[] = []
  function space(): string {
    const { spaceId } = seedSpace()
    spaces.push(spaceId)
    return spaceId
  }
  afterAll(() => spaces.forEach(dropSpace))

  it('seeds apicall.invoke for board on a new space', () => {
    const sid = space()
    const board = seedMember(sid, { role: 'board' })
    const has = rows<{ ok: boolean }>(
      `select public.user_has_permission('${board.userId}','${sid}','apicall.invoke') as ok`,
    )
    expect(has[0].ok).toBe(true)
  })

  it('door.manage can insert + read buttons; a plain member cannot read', () => {
    const sid = space()
    const admin = seedMember(sid, { role: 'admin' })
    const member = seedMember(sid, { role: 'member' })

    const ins = execAsUser(
      admin.userId,
      `insert into api_buttons (space_id, label, base_url, pinned_host) values ('${sid}','front door','https://d.lan/','d.lan');`,
    )
    expect(ins.ok).toBe(true)

    const adminSees = rowsAsUser(admin.userId, `select id from api_buttons where space_id='${sid}'`)
    expect(adminSees.length).toBe(1)

    // Members have no RLS read on definitions (they get a curated list via the
    // service-client action instead).
    const memberSees = rowsAsUser(member.userId, `select id from api_buttons where space_id='${sid}'`)
    expect(memberSees).toHaveLength(0)
  })

  it('a plain member cannot insert a button; an admin cannot write into another space', () => {
    const sidA = space()
    const adminA = seedMember(sidA, { role: 'admin' })
    const member = seedMember(sidA, { role: 'member' })
    const sidB = space()

    const memberWrite = execAsUser(
      member.userId,
      `insert into api_buttons (space_id, label, base_url, pinned_host) values ('${sidA}','x','https://d/','d');`,
    )
    expect(memberWrite.ok).toBe(false)

    const crossWrite = execAsUser(
      adminA.userId,
      `insert into api_buttons (space_id, label, base_url, pinned_host) values ('${sidB}','x','https://d/','d');`,
    )
    expect(crossWrite.ok).toBe(false)
  })

  it('keeps api_call_log immutable from the client (no INSERT policy)', () => {
    const sid = space()
    const admin = seedMember(sid, { role: 'admin' })
    const btn = seedButton(sid)
    const r = execAsUser(
      admin.userId,
      `insert into api_call_log (space_id, button_id, action, success) values ('${sid}','${btn}','invoke',true);`,
    )
    expect(r.ok).toBe(false)
  })

  it('lets door.manage read the api_call_log; a plain member cannot', () => {
    const sid = space()
    const admin = seedMember(sid, { role: 'admin' })
    const member = seedMember(sid, { role: 'member' })
    const btn = seedButton(sid)
    execService(
      `insert into api_call_log (space_id, button_id, action, success) values ('${sid}','${btn}','invoke',true);`,
    )
    expect(rowsAsUser(admin.userId, `select id from api_call_log where space_id='${sid}'`).length).toBe(1)
    expect(rowsAsUser(member.userId, `select id from api_call_log where space_id='${sid}'`)).toHaveLength(0)
  })

  it('enforces the method CHECK constraint', () => {
    const sid = space()
    const bad = execService(
      `insert into api_buttons (space_id, label, base_url, pinned_host, method) values ('${sid}','x','https://d/','d','TRACE');`,
    )
    expect(bad.ok).toBe(false)
  })
})
