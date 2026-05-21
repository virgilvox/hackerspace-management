// Door epic Phase 4 (migration 053) against real Postgres. Proves the inbound
// ingest invariants the unit tests cannot: the partial-unique dedup index, the
// fact that action rows (NULL dedupe_key) stay unconstrained, that
// door_access_log remains immutable from the client (service-only writes), and
// that inbound config is door.manage-gated through RLS. Same role-simulation
// harness as the other integration tests.
import { describe, it, expect, afterAll } from 'vitest'
import { dbReady, execService, execAsUser, rowsAsUser, seedSpace, seedMember, dropSpace, uuid } from './db'

const d = describe.skipIf(!dbReady)

function seedConnection(spaceId: string): string {
  const id = uuid()
  execService(
    `insert into door_connections (id, space_id, name, adapter, base_url, pinned_host)
     values ('${id}','${spaceId}','itest door','native_heatsync','http://10.0.0.9/','10.0.0.9');`,
  )
  return id
}

d('door inbound ingest (053)', () => {
  const spaces: string[] = []
  function space(): string {
    const { spaceId } = seedSpace()
    spaces.push(spaceId)
    return spaceId
  }
  afterAll(() => spaces.forEach(dropSpace))

  it('dedupes ingested rows on (connection_id, dedupe_key)', () => {
    const sid = space()
    const conn = seedConnection(sid)
    const first = execService(
      `insert into door_access_log (space_id, connection_id, action, success, dedupe_key)
       values ('${sid}','${conn}','entry',true,'hs:5:G:12345:');`,
    )
    expect(first.ok).toBe(true)
    // Same connection + same dedupe_key: the partial unique index rejects it,
    // which is what makes a re-poll / webhook retry a safe no-op.
    const dup = execService(
      `insert into door_access_log (space_id, connection_id, action, success, dedupe_key)
       values ('${sid}','${conn}','entry',true,'hs:5:G:12345:');`,
    )
    expect(dup.ok).toBe(false)
  })

  it('leaves action rows (NULL dedupe_key) unconstrained', () => {
    const sid = space()
    const conn = seedConnection(sid)
    // Two app-action rows with NULL dedupe_key on the same connection must both
    // insert (NULLs are distinct in the unique index), so existing grant/open/
    // self_entry auditing is unaffected by the dedup index.
    const a = execService(
      `insert into door_access_log (space_id, connection_id, action, success) values ('${sid}','${conn}','open',true);`,
    )
    const b = execService(
      `insert into door_access_log (space_id, connection_id, action, success) values ('${sid}','${conn}','open',true);`,
    )
    expect(a.ok && b.ok).toBe(true)
  })

  it('keeps door_access_log immutable from the client (no INSERT policy)', () => {
    const sid = space()
    const conn = seedConnection(sid)
    const admin = seedMember(sid, { role: 'admin' })
    // Even an admin (door.manage via the role shortcut) cannot write the audit
    // log directly; only the service-client ingest paths insert.
    const r = execAsUser(
      admin.userId,
      `insert into door_access_log (space_id, connection_id, action, success, dedupe_key)
       values ('${sid}','${conn}','entry',true,'wh:forged');`,
    )
    expect(r.ok).toBe(false)
  })

  it('lets door.manage read the log and configure inbound; a plain member cannot', () => {
    const sid = space()
    const adminUser = seedMember(sid, { role: 'admin' })
    const member = seedMember(sid, { role: 'member' })
    const conn = seedConnection(sid)
    execService(
      `insert into door_access_log (space_id, connection_id, action, success, dedupe_key)
       values ('${sid}','${conn}','entry',true,'hs:1:G:7:');`,
    )

    const adminSees = rowsAsUser<{ action: string }>(
      adminUser.userId,
      `select action from door_access_log where space_id='${sid}'`,
    )
    expect(adminSees.length).toBeGreaterThanOrEqual(1)

    const memberSees = rowsAsUser(member.userId, `select action from door_access_log where space_id='${sid}'`)
    expect(memberSees).toHaveLength(0)

    // door.manage (admin shortcut) can flip inbound_enabled; a plain member's
    // UPDATE is filtered out by RLS (zero rows affected, no error raised).
    const adminUpd = execAsUser(
      adminUser.userId,
      `update door_connections set inbound_enabled=true where id='${conn}';`,
    )
    expect(adminUpd.ok).toBe(true)
    expect(rowsAsUser<{ inbound_enabled: boolean }>(adminUser.userId, `select inbound_enabled from door_connections where id='${conn}'`)[0].inbound_enabled).toBe(true)

    execAsUser(member.userId, `update door_connections set inbound_enabled=false where id='${conn}';`)
    expect(rowsAsUser<{ inbound_enabled: boolean }>(adminUser.userId, `select inbound_enabled from door_connections where id='${conn}'`)[0].inbound_enabled).toBe(true)
  })
})
