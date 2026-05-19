import { describe, it, expect } from 'vitest'
import {
  ROLES,
  ADMIN_ROLES,
  TREASURER_ROLES,
  ACTIVE_STATUSES,
  PRIVILEGE_STATUSES,
  isPrivilegeEligible,
  hasRole,
  type Role,
} from '@/lib/permissions'

describe('ROLES', () => {
  it('lists every database role', () => {
    expect([...ROLES].sort()).toEqual(
      ['admin', 'associate', 'board', 'member', 'treasurer'].sort(),
    )
  })
})

describe('ADMIN_ROLES', () => {
  it('is admin + board', () => {
    expect([...ADMIN_ROLES].sort()).toEqual(['admin', 'board'])
  })

  it('does not include member, treasurer, or associate', () => {
    for (const r of ['member', 'treasurer', 'associate'] as Role[]) {
      expect(ADMIN_ROLES.includes(r as never)).toBe(false)
    }
  })
})

describe('TREASURER_ROLES', () => {
  it('is admin + board + treasurer', () => {
    expect([...TREASURER_ROLES].sort()).toEqual(['admin', 'board', 'treasurer'])
  })

  it('does not include plain member', () => {
    expect(TREASURER_ROLES.includes('member' as never)).toBe(false)
  })
})

describe('ACTIVE_STATUSES', () => {
  it('includes current, unverified, late', () => {
    expect([...ACTIVE_STATUSES].sort()).toEqual(
      ['current', 'late', 'unverified'].sort(),
    )
  })

  it('does NOT include inactive', () => {
    expect(ACTIVE_STATUSES.includes('inactive' as never)).toBe(false)
  })
})

describe('isPrivilegeEligible / PRIVILEGE_STATUSES', () => {
  it('only current + late may exercise a role/permission', () => {
    expect([...PRIVILEGE_STATUSES].sort()).toEqual(['current', 'late'].sort())
    expect(isPrivilegeEligible('current')).toBe(true)
    expect(isPrivilegeEligible('late')).toBe(true)
  })
  it('unverified (pending approval) is NOT privilege-eligible', () => {
    expect(isPrivilegeEligible('unverified')).toBe(false)
  })
  it('inactive / null / undefined are NOT privilege-eligible', () => {
    expect(isPrivilegeEligible('inactive')).toBe(false)
    expect(isPrivilegeEligible(null)).toBe(false)
    expect(isPrivilegeEligible(undefined)).toBe(false)
  })
})

describe('hasRole', () => {
  it('returns true when role is in the allowed list', () => {
    expect(hasRole('admin', ADMIN_ROLES)).toBe(true)
    expect(hasRole('board', ADMIN_ROLES)).toBe(true)
    expect(hasRole('treasurer', TREASURER_ROLES)).toBe(true)
  })

  it('returns false when role is not allowed', () => {
    expect(hasRole('member', ADMIN_ROLES)).toBe(false)
    expect(hasRole('treasurer', ADMIN_ROLES)).toBe(false)
    expect(hasRole('associate', TREASURER_ROLES)).toBe(false)
  })

  it('returns false for null or undefined role', () => {
    expect(hasRole(null, ADMIN_ROLES)).toBe(false)
    expect(hasRole(undefined, ADMIN_ROLES)).toBe(false)
  })
})
