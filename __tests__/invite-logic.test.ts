import { describe, it, expect } from 'vitest'
import { canAssignInviteRole, isInviteRole, INVITE_ROLES } from '@/lib/invite-logic'

describe('isInviteRole', () => {
  it('accepts exactly the known invite roles', () => {
    for (const r of INVITE_ROLES) expect(isInviteRole(r)).toBe(true)
  })
  it('rejects unknown / mis-cased / padded values', () => {
    expect(isInviteRole('Admin')).toBe(false)
    expect(isInviteRole(' board ')).toBe(false)
    expect(isInviteRole('superuser')).toBe(false)
    expect(isInviteRole('')).toBe(false)
  })
})

describe('canAssignInviteRole', () => {
  it('admin may assign any valid role', () => {
    for (const r of INVITE_ROLES) expect(canAssignInviteRole('admin', r)).toBe(true)
  })
  it('admin cannot assign an invalid target', () => {
    expect(canAssignInviteRole('admin', 'superuser')).toBe(false)
  })
  it('board may assign anything except admin', () => {
    expect(canAssignInviteRole('board', 'admin')).toBe(false)
    expect(canAssignInviteRole('board', 'board')).toBe(true)
    expect(canAssignInviteRole('board', 'treasurer')).toBe(true)
    expect(canAssignInviteRole('board', 'member')).toBe(true)
    expect(canAssignInviteRole('board', 'associate')).toBe(true)
  })
  it('treasurer / member / associate may assign nothing', () => {
    for (const creator of ['treasurer', 'member', 'associate', '']) {
      for (const target of INVITE_ROLES) {
        expect(canAssignInviteRole(creator, target)).toBe(false)
      }
    }
  })
  it('creatorRole match is exact (no case/whitespace escalation)', () => {
    expect(canAssignInviteRole('Admin', 'member')).toBe(false)
    expect(canAssignInviteRole(' admin', 'member')).toBe(false)
    expect(canAssignInviteRole('BOARD', 'member')).toBe(false)
  })
})
