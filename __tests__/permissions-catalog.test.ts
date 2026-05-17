import { describe, it, expect } from 'vitest'
import {
  PERMISSIONS,
  PERMISSION_CODES,
  PERMISSION_GROUPS,
  DEFAULT_ROLE_PERMISSIONS,
  isValidPermission,
} from '@/lib/permissions-catalog'

describe('permissions catalog', () => {
  it('has unique permission codes', () => {
    expect(new Set(PERMISSION_CODES).size).toBe(PERMISSION_CODES.length)
  })

  it('every permission has a group present in PERMISSION_GROUPS', () => {
    for (const p of PERMISSIONS) {
      expect(PERMISSION_GROUPS).toContain(p.group)
    }
  })

  it('isValidPermission accepts catalog codes and rejects others', () => {
    expect(isValidPermission('ops.secrets.read')).toBe(true)
    expect(isValidPermission('ops.kb.write')).toBe(true)
    expect(isValidPermission('not.a.permission')).toBe(false)
    expect(isValidPermission('')).toBe(false)
  })

  it('default role grants only reference real permissions', () => {
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      expect(role).not.toBe('admin') // admin is implicit-all, never seeded
      for (const perm of perms) {
        expect(isValidPermission(perm)).toBe(true)
      }
    }
  })

  it('does not grant admin defaults (admin is implicit and cannot be locked out)', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toBeUndefined()
  })

  // Least-privilege guard: a future catalog edit must not silently hand
  // non-board roles a high-risk capability. (treasurer legitimately has
  // payments.manage; member/associate should be read-only.)
  it('keeps high-risk capabilities off non-board default roles', () => {
    const HIGH_RISK = [
      'door.manage', 'door.operate', 'members.manage', 'governance.manage',
      'settings.manage', 'customize.manage', 'forms.manage',
      'certifications.grant', 'ops.secrets.read', 'ops.secrets.write',
      'forum.moderate',
    ]
    for (const role of ['treasurer', 'member', 'associate'] as const) {
      const perms = DEFAULT_ROLE_PERMISSIONS[role] ?? []
      expect(perms.filter(p => HIGH_RISK.includes(p))).toEqual([])
    }
  })

  it('member and associate defaults are read-only', () => {
    for (const role of ['member', 'associate'] as const) {
      for (const p of DEFAULT_ROLE_PERMISSIONS[role] ?? []) {
        expect(p.endsWith('.read')).toBe(true)
      }
    }
  })
})
