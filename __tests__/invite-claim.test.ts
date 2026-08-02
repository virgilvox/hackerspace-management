import { describe, it, expect } from 'vitest'
import { claimInviteUse } from '@/lib/invite-claim'

/**
 * Builds a mock admin client whose `space_invites` UPDATE ... .eq('uses_count', n)
 * behaves like a real compare-and-swap: it only "affects a row" when the guarded
 * `uses_count` equals the row's current value, incrementing it on success. This
 * lets us simulate concurrent redemptions deterministically.
 */
function makeAdmin(initial: { uses_count: number; max_uses: number | null }) {
  const row = { ...initial }
  const client = {
    from(_table: string) {
      return {
        // UPDATE path: .update(patch).eq('id',..).eq('uses_count',guard).select('id')
        update(patch: { uses_count: number }) {
          let guard: number | null = null
          const builder: Record<string, unknown> = {
            eq(col: string, val: number) {
              if (col === 'uses_count') guard = val
              return builder
            },
            select() {
              // CAS: apply only if the guard matches the live value.
              if (guard === row.uses_count) {
                row.uses_count = patch.uses_count
                return Promise.resolve({ data: [{ id: 'inv-1' }] })
              }
              return Promise.resolve({ data: [] })
            },
          }
          return builder
        },
        // SELECT path: .select('uses_count').eq('id',..).maybeSingle()
        select() {
          const builder: Record<string, unknown> = {
            eq() {
              return builder
            },
            maybeSingle() {
              return Promise.resolve({ data: { uses_count: row.uses_count } })
            },
          }
          return builder
        },
      }
    },
    _row: row,
  }
  return client as unknown as Parameters<typeof claimInviteUse>[0] & { _row: typeof row }
}

describe('claimInviteUse (invite max_uses TOCTOU fix)', () => {
  it('claims a use when under the cap and returns the new count', async () => {
    const admin = makeAdmin({ uses_count: 0, max_uses: 1 })
    const result = await claimInviteUse(admin, 'inv-1', 0, 1)
    expect(result).toBe(1)
    expect(admin._row.uses_count).toBe(1)
  })

  it('rejects a single-use invite already at cap (no over-issue)', async () => {
    const admin = makeAdmin({ uses_count: 1, max_uses: 1 })
    // Second redeemer read uses_count=0 stale, but the row is already at 1.
    const result = await claimInviteUse(admin, 'inv-1', 0, 1)
    expect(result).toBeNull()
    expect(admin._row.uses_count).toBe(1) // unchanged — not incremented past cap
  })

  it('lets the loser of a race retry into remaining multi-use capacity', async () => {
    // max_uses=5, another redeemer already bumped it to 1 after our stale read of 0.
    const admin = makeAdmin({ uses_count: 1, max_uses: 5 })
    const result = await claimInviteUse(admin, 'inv-1', 0, 5)
    expect(result).toBe(2) // re-read to 1, then CAS-claimed to 2
    expect(admin._row.uses_count).toBe(2)
  })

  it('treats an unlimited invite (max_uses null) as always claimable', async () => {
    const admin = makeAdmin({ uses_count: 99, max_uses: null })
    const result = await claimInviteUse(admin, 'inv-1', 99, null)
    expect(result).toBe(100)
  })

  it('gives up (null) if it cannot win the CAS within the attempt budget', async () => {
    // Caller's known count (0) is behind the live row (3), so the first CAS
    // guard misses; with a 1-attempt budget it re-reads and then gives up
    // rather than looping — proving the retry is bounded, not infinite.
    const admin = makeAdmin({ uses_count: 3, max_uses: 10 })
    const result = await claimInviteUse(admin, 'inv-1', 0, 10, 1)
    expect(result).toBeNull()
    expect(admin._row.uses_count).toBe(3) // untouched
  })
})
