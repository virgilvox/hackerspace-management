// Pure invite-role policy. No deps so it is unit-testable and shared by the
// server action, the validations, and the panel UI.

export const INVITE_ROLES = ['admin', 'board', 'treasurer', 'member', 'associate'] as const
export type InviteRole = (typeof INVITE_ROLES)[number]

export function isInviteRole(v: string): v is InviteRole {
  return (INVITE_ROLES as readonly string[]).includes(v)
}

/**
 * Whether a member with `creatorRole` may create an invite that grants
 * `target`. Invite creation is already admin/board-gated upstream; this is
 * the privilege-escalation guard on top of that:
 *   - admin may grant any role
 *   - board may grant anything EXCEPT admin (a board member cannot mint
 *     admin access)
 *   - anyone else: no (they never reach invite creation anyway)
 */
export function canAssignInviteRole(creatorRole: string, target: string): boolean {
  if (!isInviteRole(target)) return false
  if (creatorRole === 'admin') return true
  if (creatorRole === 'board') return target !== 'admin'
  return false
}
