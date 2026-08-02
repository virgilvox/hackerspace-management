import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Authorization + orphan-proposal guard for appealIncident.
 *
 * The incident UPDATE inside appealIncident is RLS-restricted to admin/board.
 * Before the fix the action was gated by requireMember (ANY member): a plain
 * member/reporter would insert a draft proposal, update ZERO incident rows, and
 * still get `{ data: proposal }` back — an orphan proposal the incident never
 * links to. These tests drive the REAL action through a recording mock client
 * and assert (a) a non-admin/board caller is rejected with NO proposal created,
 * and (b) on the admin path the proposal survives only when the incident update
 * actually affects a row, otherwise it is rolled back.
 */

// ─── Recording mock Supabase client (shared style with actions.test.ts) ───────
type QueueItem = { data?: unknown; error?: unknown }

function makeClient(opts: { user?: { id: string; email?: string } | null; queue?: QueueItem[] }) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const queue = [...(opts.queue ?? [])]
  const next = (): QueueItem => (queue.length ? queue.shift()! : { data: null, error: null })

  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: QueueItem) => void) => resolve(next())
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return (...args: unknown[]) => {
            calls.push({ method: prop, args })
            return Promise.resolve(next())
          }
        }
        return (...args: unknown[]) => {
          calls.push({ method: prop, args })
          return builder
        }
      },
    },
  )

  const client = {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: opts.user ?? null } })),
    },
    from: (...args: unknown[]) => {
      calls.push({ method: 'from', args })
      return builder
    },
    _calls: calls,
  }
  return client
}

let currentClient: ReturnType<typeof makeClient>

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(currentClient),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeClient({ user: null, queue: [] }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { appealIncident } from '@/lib/actions/incidents'

const INCIDENT_ID = '22222222-2222-2222-2222-222222222222'
const user = { id: 'user-A', email: 'a@example.com' }
const memberRow = (role: string, space_id = 'space-A') => ({
  id: 'member-A',
  space_id,
  user_id: user.id,
  role,
  status: 'current',
  display_name: 'Admin A',
  handle: 'admin-a',
})

/** Recorded `.from(table)` targets, in order. */
const fromTables = (c: ReturnType<typeof makeClient>) =>
  c._calls.filter(x => x.method === 'from').map(x => x.args[0])

/** Recorded `.insert(payload)` calls into a given table are hard to attribute
 *  to a table directly, so detect the proposal insert by its shape. */
const proposalInserts = (c: ReturnType<typeof makeClient>) =>
  c._calls
    .filter(x => x.method === 'insert')
    .map(x => x.args[0])
    .filter(
      (o): o is Record<string, unknown> =>
        !!o && typeof o === 'object' && (o as Record<string, unknown>).proposal_type === 'membership_vote',
    )

const deleteCalls = (c: ReturnType<typeof makeClient>) =>
  c._calls.filter(x => x.method === 'delete')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('appealIncident authorization', () => {
  it('rejects a plain member with an admin/board message and creates NO proposal', async () => {
    currentClient = makeClient({ user, queue: [{ data: memberRow('member') }] })
    const res = await appealIncident({ incidentId: INCIDENT_ID, title: 'Appeal' })
    expect(res).toHaveProperty('error')
    expect((res as { error: string }).error).toMatch(/admin/i)
    // The action must bail before ever touching incidents or proposals.
    expect(proposalInserts(currentClient)).toHaveLength(0)
    expect(fromTables(currentClient)).not.toContain('proposals')
  })
})

describe('appealIncident orphan-proposal guard', () => {
  it('links the incident and returns the proposal when the update affects a row', async () => {
    currentClient = makeClient({
      user,
      queue: [
        { data: memberRow('admin', 'space-A') }, // requireMember
        { data: { id: INCIDENT_ID, status: 'decided', space_id: 'space-A' } }, // incident lookup
        { data: { id: 'proposal-1' } }, // proposal insert().select().single()
        { data: [{ id: INCIDENT_ID }] }, // incident update().select() → 1 row affected
        { error: null }, // activity_log insert
      ],
    })
    const res = await appealIncident({ incidentId: INCIDENT_ID, title: 'Appeal' })
    expect(res).not.toHaveProperty('error')
    expect((res as { data: { id: string } }).data.id).toBe('proposal-1')
    expect(proposalInserts(currentClient)).toHaveLength(1)
    // A successful update must NOT roll the proposal back.
    expect(deleteCalls(currentClient)).toHaveLength(0)
  })

  it('rolls the draft proposal back (no orphan) when the incident update affects zero rows', async () => {
    currentClient = makeClient({
      user,
      queue: [
        { data: memberRow('admin', 'space-A') }, // requireMember
        { data: { id: INCIDENT_ID, status: 'decided', space_id: 'space-A' } }, // incident lookup
        { data: { id: 'proposal-1' } }, // proposal insert().select().single()
        { data: [], error: null }, // incident update().select() → RLS-silent 0 rows
      ],
    })
    const res = await appealIncident({ incidentId: INCIDENT_ID, title: 'Appeal' })
    expect(res).toHaveProperty('error')
    // The orphan draft proposal must be deleted, not left dangling.
    expect(proposalInserts(currentClient)).toHaveLength(1)
    const deletes = deleteCalls(currentClient)
    expect(deletes.length).toBeGreaterThan(0)
    // And the incident-linking UPDATE must be scoped and asserted via .select().
    const eqCols = currentClient._calls.filter(x => x.method === 'eq').map(x => x.args[0])
    expect(eqCols).toContain('space_id')
    expect(currentClient._calls.some(x => x.method === 'select')).toBe(true)
  })
})
