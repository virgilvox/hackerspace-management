// Dependency-free Postgres harness: drives the real DB through `psql` (no new
// npm dep). Models the app's two access paths:
//   - service path  (createAdminClient): superuser/no JWT -> RLS + the
//     auth.uid()-gated trigger are bypassed, exactly like the service client.
//   - user path      (RLS client): role `authenticated` + a request.jwt.claims
//     `sub`, so auth.uid() resolves and RLS/triggers apply, exactly like a
//     logged-in member. This is the standard Supabase RLS test technique.
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

export const DB_URL =
  process.env.INTEGRATION_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

function run(args: string[], input?: string): { ok: boolean; out: string; err: string } {
  try {
    const out = execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', ...args], {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { ok: true, out, err: '' }
  } catch (e: unknown) {
    const x = e as { stdout?: string; stderr?: string }
    return { ok: false, out: x.stdout ?? '', err: (x.stderr ?? String(e)).trim() }
  }
}

export const dbReady: boolean = run(['-tAc', 'select 1']).ok

export const uuid = randomUUID

// Run statements as the SERVICE path (no JWT -> trigger/RLS bypass).
export function execService(sql: string): { ok: boolean; err: string } {
  const r = run(['-c', sql])
  return { ok: r.ok, err: r.err }
}

// Run statements as a logged-in member (auth.uid() = uid, RLS active).
export function execAsUser(uid: string, sql: string): { ok: boolean; err: string } {
  const claims = JSON.stringify({ sub: uid }).replace(/'/g, "''")
  const wrapped =
    `set local role authenticated;` +
    `set local "request.jwt.claims" = '${claims}';` +
    sql
  const r = run(['-c', `begin; ${wrapped}; commit;`])
  return { ok: r.ok, err: r.err }
}

// Query helper -> array of row objects (service path). Matches the JSON shape
// supabase-js .rpc()/.select() returns, so assertions here also validate the
// shape the server actions destructure.
export function rows<T = Record<string, unknown>>(selectSql: string): T[] {
  const r = run(['-tAc', `select coalesce(json_agg(t),'[]'::json)::text from (${selectSql}) t`])
  if (!r.ok) throw new Error(r.err)
  return JSON.parse(r.out.trim() || '[]') as T[]
}

export function rowsAsUser<T = Record<string, unknown>>(uid: string, selectSql: string): T[] {
  const claims = JSON.stringify({ sub: uid }).replace(/'/g, "''")
  // The SELECT must be the LAST statement: psql -c with several statements
  // only prints the final command's result, so a trailing `commit` would
  // swallow the SELECT output. Use session-level `set` (the one-shot psql
  // connection exits afterward) and end on the SELECT.
  const r = run([
    '-tAc',
    `set role authenticated; set "request.jwt.claims" = '${claims}'; ` +
      `select coalesce(json_agg(t),'[]'::json)::text from (${selectSql}) t;`,
  ])
  if (!r.ok) throw new Error(r.err)
  // json_agg(coalesce(...,'[]')) yields a line starting with '['; pick it and
  // ignore any psql command tags (SET) that may print around it.
  const line =
    r.out
      .trim()
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('['))
      .pop() ?? '[]'
  return JSON.parse(line) as T[]
}

// Minimal seed helpers. They THROW on failure so a seeding problem surfaces
// immediately instead of cascading into confusing FK errors downstream. All
// ids are random so parallel test files never collide.
function must(sql: string): void {
  const r = execService(sql)
  if (!r.ok) throw new Error(`seed failed: ${r.err}\nSQL: ${sql.slice(0, 200)}`)
}

export function seedSpace(): { spaceId: string } {
  const spaceId = uuid()
  must(`insert into spaces (id, name, slug) values ('${spaceId}','itest','itest-${spaceId.slice(0, 8)}');`)
  return { spaceId }
}

// space_members.user_id FKs auth.users(id), so an auth user must exist first
// (auth.users only requires id; we add an email for readability/cleanup).
export function seedMember(
  spaceId: string,
  opts: { role?: string; status?: string } = {},
): { memberId: string; userId: string } {
  const memberId = uuid()
  const userId = uuid()
  must(`insert into auth.users (id, email) values ('${userId}','it-${userId}@itest.local');`)
  must(
    `insert into space_members (id, space_id, user_id, role, status, display_name)
     values ('${memberId}','${spaceId}','${userId}','${opts.role ?? 'member'}','${opts.status ?? 'current'}','itest member');`,
  )
  return { memberId, userId }
}

export function seedClassSession(
  spaceId: string,
  capacity: number | null,
): { classId: string; sessionId: string } {
  const classId = uuid()
  const sessionId = uuid()
  must(`insert into classes (id, space_id, title) values ('${classId}','${spaceId}','itest class');`)
  must(
    `insert into class_sessions (id, class_id, space_id, starts_at, capacity)
     values ('${sessionId}','${classId}','${spaceId}', now() + interval '7 days', ${capacity == null ? 'null' : capacity});`,
  )
  return { classId, sessionId }
}

export function seedEquipment(spaceId: string): { equipmentId: string } {
  const equipmentId = uuid()
  must(`insert into equipment (id, space_id, name) values ('${equipmentId}','${spaceId}','itest rig');`)
  return { equipmentId }
}

// Cleanup: remove the space's auth.users first (FK from space_members), then
// the space (cascades members/classes/equipment/reservations). Space-scoped
// so it is safe under parallel test files.
export function dropSpace(spaceId: string): void {
  execService(
    `delete from auth.users where id in (select user_id from space_members where space_id='${spaceId}' and user_id is not null);
     delete from spaces where id='${spaceId}';`,
  )
}
