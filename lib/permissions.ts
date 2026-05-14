import type { Enums } from '@/types/database'

/**
 * Single source of truth for role names and role-based permission sets.
 * Every server action that gates writes should reference one of the named
 * tuples below instead of writing role strings inline.
 */

export type Role = Enums<'member_role'>
export type MemberStatus = Enums<'member_status'>

/** Every defined role, in privilege order. */
export const ROLES = ['admin', 'board', 'treasurer', 'member', 'associate'] as const satisfies readonly Role[]

/** Roles considered "privileged" for write/admin operations. */
export const ADMIN_ROLES = ['admin', 'board'] as const satisfies readonly Role[]

/** Roles that can sign off on financial operations. */
export const TREASURER_ROLES = ['admin', 'board', 'treasurer'] as const satisfies readonly Role[]

/** Roles that can read but not necessarily write. */
export const ALL_ROLES = ROLES

/** Statuses a member may have and still be allowed to act in the app. */
export const ACTIVE_STATUSES = ['current', 'unverified', 'late'] as const satisfies readonly MemberStatus[]

/**
 * Returns true if `role` is one of the `allowed` roles.
 * Use this everywhere instead of `role === 'admin' || role === 'board'` chains.
 */
export function hasRole(role: Role | null | undefined, allowed: readonly Role[]): boolean {
  if (!role) return false
  return allowed.includes(role)
}
