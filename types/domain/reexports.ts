/**
 * One-stop re-exports of role/permission and auth-helper types, so feature code
 * can pull domain types and the common auth primitives from a single place.
 */
export type { Role } from '@/lib/permissions'
export {
  ROLES,
  ADMIN_ROLES,
  TREASURER_ROLES,
  ALL_ROLES,
  ACTIVE_STATUSES,
  hasRole,
} from '@/lib/permissions'
export type {
  Member,
  Result,
  MemberResult,
  ServerSupabase,
} from '@/lib/auth-helpers'
