import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Regression: a board member must not be able to re-arm an admin-granting
 * invite by updating privilege-affecting fields (is_enabled / max_uses /
 * expires_at) WITHOUT touching `role`. Because updateInviteSchema makes `role`
 * optional, the old role gate ran only when `role` was in the payload, so
 * `updateInvite(adminInviteId, { is_enabled: true, max_uses: 5 })` sailed
 * through and re-distributed admin access the board caller could never mint.
 *
 * These drive the real action through a recording mock Supabase client that
 * scripts the requireMember lookup and the existing-invite load, then assert
 * whether the tenant-scoped UPDATE reached the client.
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

import { updateInvite } from '@/lib/actions/invites'

const INVITE_ID = '22222222-2222-2222-2222-222222222222'
const user = { id: 'user-A', email: 'a@example.com' }

const memberRow = (role: string, space_id = 'space-A') => ({
  id: 'member-A',
  space_id,
  user_id: user.id,
  role,
  status: 'current',
  display_name: 'Caller',
  handle: 'caller',
})

/** An exhausted + disabled admin invite in space-A. */
const adminInvite = {
  role: 'admin',
  is_enabled: false,
  max_uses: 1,
  expires_at: null,
}

const memberInvite = {
  role: 'member',
  is_enabled: false,
  max_uses: 1,
  expires_at: null,
}

const eqCalls = (c: ReturnType<typeof makeClient>) =>
  c._calls.filter(x => x.method === 'eq').map(x => x.args)
const updateReached = (c: ReturnType<typeof makeClient>) =>
  c._calls.some(x => x.method === 'update')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateInvite privilege re-arm guard', () => {
  it('blocks a BOARD member from re-enabling/extending an admin invite with no role field', async () => {
    currentClient = makeClient({
      user,
      queue: [
        { data: memberRow('board') }, // requireMemberWithRole
        { data: adminInvite }, // existing-invite load (maybeSingle)
      ],
    })
    const res = await updateInvite(INVITE_ID, { is_enabled: true, max_uses: 5 })
    expect(res).toHaveProperty('error')
    expect((res as { error: string }).error).toMatch(/admin/i)
    // The re-arming UPDATE must never reach the database.
    expect(updateReached(currentClient)).toBe(false)
  })

  it('allows an ADMIN member to re-enable/extend an admin invite', async () => {
    currentClient = makeClient({
      user,
      queue: [
        { data: memberRow('admin') }, // requireMemberWithRole
        { data: adminInvite }, // existing-invite load
        { error: null }, // update
      ],
    })
    const res = await updateInvite(INVITE_ID, { is_enabled: true, max_uses: 5 })
    expect(res).not.toHaveProperty('error')
    expect(updateReached(currentClient)).toBe(true)
    // Still tenant-scoped.
    expect(eqCalls(currentClient)).toContainEqual(['space_id', 'space-A'])
  })

  it('lets a BOARD member still edit a member-role invite', async () => {
    currentClient = makeClient({
      user,
      queue: [
        { data: memberRow('board') }, // requireMemberWithRole
        { data: memberInvite }, // existing-invite load
        { error: null }, // update
      ],
    })
    const res = await updateInvite(INVITE_ID, { is_enabled: true, max_uses: 5 })
    expect(res).not.toHaveProperty('error')
    expect(updateReached(currentClient)).toBe(true)
    expect(eqCalls(currentClient)).toContainEqual(['space_id', 'space-A'])
  })
})
