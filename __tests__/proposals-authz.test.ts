import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Authorization tests for governance proposal actions.
 *
 * `require_approval` spaces keep a freshly-joined member at status
 * 'unverified' until an admin approves them. requireMember admits
 * 'unverified' (it's an ACTIVE_STATUS), so the proposal actions must add the
 * privilege-eligible gate themselves — otherwise a pending member could
 * create and vote on proposals. These tests drive the real actions through a
 * recording mock Supabase client and assert the gate blocks 'unverified'
 * while a 'current' member is allowed.
 */

// ─── Recording mock Supabase client (mirrors __tests__/actions.test.ts) ──────
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

import { createProposal, castVote } from '@/lib/actions/proposals'

const UUID = '11111111-2222-3333-4444-555555555555'
const user = { id: 'user-A', email: 'a@example.com' }
const memberRow = (status: string, space_id = 'space-A') => ({
  id: 'member-A',
  space_id,
  user_id: user.id,
  role: 'member',
  status,
  display_name: 'Pat Member',
  handle: 'pat',
})

/** True if any recorded insert/upsert wrote to the given table. */
const wroteTo = (c: ReturnType<typeof makeClient>, table: string) =>
  c._calls.some(x => x.method === 'from' && x.args[0] === table)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('proposal actions block unverified (pending-approval) members', () => {
  it('rejects an unverified member from createProposal and performs no insert', async () => {
    currentClient = makeClient({ user, queue: [{ data: memberRow('unverified') }] })
    const res = await createProposal({ title: 'Buy a new laser' })
    expect(res).toHaveProperty('error')
    expect((res as { error: string }).error).toMatch(/pending approval/i)
    // No proposals row was inserted.
    expect(currentClient._calls.some(x => x.method === 'insert')).toBe(false)
  })

  it('rejects an unverified member from castVote and casts no vote', async () => {
    currentClient = makeClient({ user, queue: [{ data: memberRow('unverified') }] })
    const res = await castVote({ proposalId: UUID, position: 'yes' })
    expect(res).toHaveProperty('error')
    expect((res as { error: string }).error).toMatch(/pending approval/i)
    // The gate fires before the proposal lookup / upsert, so nothing is written.
    expect(wroteTo(currentClient, 'proposal_votes')).toBe(false)
  })

  it('allows a current member to createProposal', async () => {
    currentClient = makeClient({
      user,
      queue: [
        { data: memberRow('current') }, // requireMember
        { data: { id: 'prop-1', title: 'Buy a new laser' } }, // insert().select().single()
        { error: null }, // activity_log insert
      ],
    })
    const res = await createProposal({ title: 'Buy a new laser' })
    expect(res).not.toHaveProperty('error')
    expect(wroteTo(currentClient, 'proposals')).toBe(true)
  })

  it('allows a current member to castVote', async () => {
    currentClient = makeClient({
      user,
      queue: [
        { data: memberRow('current') }, // requireMember
        { data: { id: UUID, status: 'open' } }, // proposal lookup maybeSingle
        { error: null }, // proposal_votes upsert
        { error: null }, // activity_log insert
      ],
    })
    const res = await castVote({ proposalId: UUID, position: 'yes' })
    expect(res).not.toHaveProperty('error')
    expect(wroteTo(currentClient, 'proposal_votes')).toBe(true)
  })
})
