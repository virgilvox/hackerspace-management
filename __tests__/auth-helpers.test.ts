import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  parseInput,
  getAuthMember,
  requireMember,
  requireMemberWithRole,
  type ServerSupabase,
} from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'

/**
 * Minimal mock of the query the auth helpers issue:
 *   supabase.auth.getUser()
 *   supabase.from('space_members').select(...).eq(...).in(...).single()
 */
function mockClient(opts: {
  user?: { id: string } | null
  member?: Record<string, unknown> | null
}): ServerSupabase {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    single: () => Promise.resolve({ data: opts.member ?? null }),
  }
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: opts.user ?? null } }) },
    from: () => chain,
  } as unknown as ServerSupabase
}

const activeMember = (role: string, status = 'current') => ({
  id: 'm1',
  space_id: 'space-A',
  user_id: 'u1',
  role,
  status,
  display_name: 'M',
  handle: 'm',
})

describe('parseInput', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required').max(10, 'Name is too long'),
    age: z.number().int().nonnegative(),
  })

  it('returns parsed data on success', () => {
    const r = parseInput(schema, { name: 'Alice', age: 30 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data).toEqual({ name: 'Alice', age: 30 })
    }
  })

  it('returns the first validation message on failure', () => {
    const r = parseInput(schema, { name: '', age: 30 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBe('Name is required')
    }
  })

  it('returns an error for completely invalid input', () => {
    const r = parseInput(schema, null)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBeDefined()
    }
  })

  it('returns a fallback message when zod has no error message', () => {
    const minimal = z.string()
    const r = parseInput(minimal, 42)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBeDefined()
    }
  })
})

describe('getAuthMember', () => {
  it('returns null when there is no authenticated user', async () => {
    expect(await getAuthMember(mockClient({ user: null }))).toBeNull()
  })

  it('returns null when the user has no active membership', async () => {
    expect(await getAuthMember(mockClient({ user: { id: 'u1' }, member: null }))).toBeNull()
  })

  it('returns the active member for an authenticated user', async () => {
    const m = await getAuthMember(mockClient({ user: { id: 'u1' }, member: activeMember('member') }))
    expect(m?.space_id).toBe('space-A')
    expect(m?.role).toBe('member')
  })
})

describe('requireMember', () => {
  it('errors when unauthenticated', async () => {
    const r = await requireMember(mockClient({ user: null }))
    expect(r.ok).toBe(false)
  })

  it('ok for an active member', async () => {
    const r = await requireMember(mockClient({ user: { id: 'u1' }, member: activeMember('member') }))
    expect(r.ok).toBe(true)
  })
})

describe('requireMemberWithRole', () => {
  it('rejects an unverified member even with an admin role (require_approval gate)', async () => {
    const r = await requireMemberWithRole(
      mockClient({ user: { id: 'u1' }, member: activeMember('admin', 'unverified') }),
      ADMIN_ROLES,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/pending approval/i)
  })

  it('rejects a current member whose role is not allowed', async () => {
    const r = await requireMemberWithRole(
      mockClient({ user: { id: 'u1' }, member: activeMember('member') }),
      ADMIN_ROLES,
    )
    expect(r.ok).toBe(false)
  })

  it('allows a current admin', async () => {
    const r = await requireMemberWithRole(
      mockClient({ user: { id: 'u1' }, member: activeMember('admin') }),
      ADMIN_ROLES,
    )
    expect(r.ok).toBe(true)
  })

  it('allows a late member to keep their privileged role (dues lapse is not an authz downgrade)', async () => {
    const r = await requireMemberWithRole(
      mockClient({ user: { id: 'u1' }, member: activeMember('board', 'late') }),
      ADMIN_ROLES,
    )
    expect(r.ok).toBe(true)
  })
})
