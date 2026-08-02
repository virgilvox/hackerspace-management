import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Real server-action authorization + tenant-scoping tests.
 *
 * The previous version of this file asserted on string literals it defined
 * itself (e.g. `expect(".eq('space_id', ...)").toContain('space_id')`) and
 * never invoked a single action — it stayed green no matter what the code did.
 * These tests drive the ACTUAL actions through a recording mock Supabase client
 * and assert the authz gate and the `.eq('space_id', …)` scoping that stop
 * cross-tenant (IDOR) writes. Remove the scope or the role gate in a real
 * action and one of these fails.
 */

// ─── Recording mock Supabase client ──────────────────────────────────────────
type QueueItem = { data?: unknown; error?: unknown }

function makeClient(opts: { user?: { id: string; email?: string } | null; queue?: QueueItem[] }) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const queue = [...(opts.queue ?? [])]
  const next = (): QueueItem => (queue.length ? queue.shift()! : { data: null, error: null })

  // A single chainable/awaitable recorder shared across every query on this
  // client. Chain methods record their args and return the builder; terminal
  // `.single()/.maybeSingle()` and awaiting the chain pull the next queued
  // result, so a test scripts results in call order.
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
  // Permissive stand-in; the tests below avoid code paths that use it.
  createAdminClient: () => makeClient({ user: null, queue: [] }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { updateMember, removeMember } from '@/lib/actions/members'
import { logCashPayment } from '@/lib/actions/payments'

const UUID = '11111111-1111-1111-1111-111111111111'
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

/** Find recorded `.eq(col, val)` calls. */
const eqCalls = (c: ReturnType<typeof makeClient>) =>
  c._calls.filter(x => x.method === 'eq').map(x => x.args)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('server-action authorization', () => {
  it('rejects an unauthenticated caller and performs no write', async () => {
    currentClient = makeClient({ user: null, queue: [] })
    const res = await updateMember(UUID, { display_name: 'x' })
    expect(res).toHaveProperty('error')
    // No space_members UPDATE reached the client (only the auth lookup, if any).
    expect(eqCalls(currentClient).some(a => a[0] === 'space_id')).toBe(false)
  })

  it('rejects a non-privileged member from updating members', async () => {
    currentClient = makeClient({ user, queue: [{ data: memberRow('member') }] })
    const res = await updateMember(UUID, { display_name: 'x' })
    expect(res).toHaveProperty('error')
    expect((res as { error: string }).error).toMatch(/admin/i)
    expect(eqCalls(currentClient).some(a => a[0] === 'space_id')).toBe(false)
  })

  it('rejects a board member from REMOVING a member (admin-only)', async () => {
    currentClient = makeClient({ user, queue: [{ data: memberRow('board') }] })
    const res = await removeMember(UUID)
    expect(res).toHaveProperty('error')
    expect(eqCalls(currentClient).some(a => a[0] === 'space_id')).toBe(false)
  })

  it('rejects a plain member from logging a cash payment (treasurer-gated)', async () => {
    currentClient = makeClient({ user, queue: [{ data: memberRow('member') }] })
    const res = await logCashPayment({ amount: 10, from_note: 'cash' })
    expect(res).toHaveProperty('error')
  })
})

describe('server-action tenant scoping (IDOR guard)', () => {
  it('scopes an admin updateMember to the caller’s space_id', async () => {
    currentClient = makeClient({
      user,
      queue: [{ data: memberRow('admin', 'space-A') }, { error: null }],
    })
    // Attacker-style call: a valid member id that might belong to another space.
    const res = await updateMember(UUID, { display_name: 'x' })
    expect(res).not.toHaveProperty('error')
    // The UPDATE must be pinned to the caller's own space, so a row in another
    // space can never be touched.
    expect(eqCalls(currentClient)).toContainEqual(['space_id', 'space-A'])
    expect(eqCalls(currentClient)).toContainEqual(['id', UUID])
  })

  it('scopes an admin removeMember to the caller’s space_id', async () => {
    currentClient = makeClient({
      user,
      queue: [{ data: memberRow('admin', 'space-A') }, { error: null }],
    })
    const res = await removeMember(UUID)
    expect(res).not.toHaveProperty('error')
    expect(eqCalls(currentClient)).toContainEqual(['space_id', 'space-A'])
  })

  it('stamps a treasurer cash payment with the caller’s space_id', async () => {
    currentClient = makeClient({
      user,
      queue: [
        { data: memberRow('treasurer', 'space-A') }, // requireMember
        { data: { id: 'pay-1' } }, // payments insert().select().single()
        { error: null }, // activity_log insert
      ],
    })
    const res = await logCashPayment({ amount: 25, from_note: 'dues' })
    expect(res).not.toHaveProperty('error')
    const inserts = currentClient._calls.filter(x => x.method === 'insert').map(x => x.args[0])
    const paymentInsert = inserts.find(
      (o): o is Record<string, unknown> => !!o && typeof o === 'object' && 'platform' in o,
    )
    expect(paymentInsert?.space_id).toBe('space-A')
    expect(paymentInsert?.platform).toBe('cash')
  })
})
