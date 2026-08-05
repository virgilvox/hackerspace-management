import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Cross-tenant guard for reserveEquipment's manager "book on behalf" path.
 *
 * When a manager passes a target `memberId`, the action must verify that member
 * belongs to the caller's space (mirroring signUpForClass) BEFORE inserting a
 * reservation stamped with the target's membership. Without the guard a manager
 * could pass a member id from another space and create a reservation there.
 *
 * These drive the ACTUAL action through recording mock Supabase clients: one
 * RLS client (createClient) whose results are scripted in call order, and a
 * separate admin client (createAdminClient) for the space_members lookup.
 */

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
    // rpc returns the (thenable) builder, so `await rpc(...)` pulls the next
    // queued result — used for the user_has_permission manager check.
    rpc: (...args: unknown[]) => {
      calls.push({ method: 'rpc', args })
      return builder
    },
    _calls: calls,
  }
  return client
}

let currentClient: ReturnType<typeof makeClient>
let currentAdmin: ReturnType<typeof makeClient>

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(currentClient),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => currentAdmin,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { reserveEquipment } from '@/lib/actions/equipment'

const user = { id: 'user-A', email: 'a@example.com' }
const managerRow = {
  id: 'member-A',
  space_id: 'space-A',
  user_id: user.id,
  role: 'manager',
  status: 'current',
  display_name: 'Manager A',
  handle: 'manager-a',
}
const equipRow = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Laser Cutter',
  location: 'Lab',
  space_id: 'space-A',
  status: 'available',
  is_active: true,
  required_certification_id: null,
}
const FOREIGN_MEMBER = '33333333-3333-3333-3333-333333333333'
const baseInput = {
  equipmentId: equipRow.id,
  starts_at: '2026-09-01T10:00:00Z',
  ends_at: '2026-09-01T11:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reserveEquipment cross-space target guard', () => {
  it('rejects a manager booking for a member from another space', async () => {
    currentClient = makeClient({
      user,
      queue: [
        { data: managerRow }, // requireMember (space_members .single)
        { data: true }, // user_has_permission rpc -> manager
        { data: equipRow }, // equipment .maybeSingle
      ],
    })
    // Admin client's space_members lookup finds nothing: the target belongs to
    // another space (or does not exist).
    currentAdmin = makeClient({ user: null, queue: [{ data: null }] })

    const res = await reserveEquipment({ ...baseInput, memberId: FOREIGN_MEMBER })

    expect(res).toEqual({ error: 'That member was not found in this space.' })
    // The guard ran: a space_members lookup pinned to the caller's space.
    const eqArgs = currentAdmin._calls.filter(c => c.method === 'eq').map(c => c.args)
    expect(eqArgs).toContainEqual(['id', FOREIGN_MEMBER])
    expect(eqArgs).toContainEqual(['space_id', 'space-A'])
    // No reservation was inserted.
    expect(currentAdmin._calls.some(c => c.method === 'insert')).toBe(false)
  })
})
