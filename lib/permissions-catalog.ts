// Fixed catalog of permission codes. This is app-owned data, not a table:
// the set of capabilities is part of the product, while which roles hold
// which permissions is per-space (space_role_permissions).
//
// Important: this layer is ADDITIVE. Existing role-based RLS and server-action
// role checks stay in force. A permission grant can only widen what a role can
// do through the surfaces that consult it (the Ops ACL and the Customize
// permissions UI); it never overrides the database RLS that protects tenant
// isolation. `admin` implicitly holds every permission and can never be
// locked out.

export const PERMISSIONS = [
  { code: 'ops.kb.read',        group: 'Ops', label: 'Read knowledge base' },
  { code: 'ops.kb.write',       group: 'Ops', label: 'Write knowledge base' },
  { code: 'ops.process.read',   group: 'Ops', label: 'Read processes' },
  { code: 'ops.process.write',  group: 'Ops', label: 'Write processes' },
  { code: 'ops.secrets.read',   group: 'Ops', label: 'Reveal secrets' },
  { code: 'ops.secrets.write',  group: 'Ops', label: 'Manage secrets' },
  { code: 'ops.arealeads.manage', group: 'Ops', label: 'Manage area leads' },
  { code: 'members.manage',     group: 'People', label: 'Manage members' },
  { code: 'payments.manage',    group: 'Finance', label: 'Manage payments' },
  { code: 'governance.manage',  group: 'Governance', label: 'Manage proposals, incidents, policies' },
  { code: 'forum.moderate',     group: 'Community', label: 'Moderate forum and comments' },
  { code: 'forms.manage',       group: 'Community', label: 'Manage forms and waivers' },
  { code: 'certifications.manage', group: 'Certifications', label: 'Manage certification types' },
  { code: 'certifications.grant',  group: 'Certifications', label: 'Award and revoke certifications (Instructor)' },
  { code: 'classes.manage',     group: 'Classes', label: 'Manage classes and schedule sessions' },
  { code: 'classes.instruct',   group: 'Classes', label: 'Run classes: attendance, completion, attendees' },
  { code: 'customize.manage',   group: 'Admin', label: 'Customize roles, tiers, areas, invites, onboarding' },
  { code: 'settings.manage',    group: 'Admin', label: 'Space settings, integrations, webhooks' },
] as const

export type PermissionCode = (typeof PERMISSIONS)[number]['code']

export const PERMISSION_CODES: readonly string[] = PERMISSIONS.map(p => p.code)

export const PERMISSION_GROUPS: string[] = Array.from(new Set(PERMISSIONS.map(p => p.group)))

// Built-in role defaults seeded per space. `admin` is intentionally absent:
// it holds everything implicitly and is never stored, so it cannot be
// accidentally revoked.
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  board: [
    'ops.kb.read', 'ops.kb.write', 'ops.process.read', 'ops.process.write',
    'ops.secrets.read', 'ops.secrets.write', 'ops.arealeads.manage',
    'members.manage', 'payments.manage', 'governance.manage',
    'forum.moderate', 'forms.manage',
    'certifications.manage', 'certifications.grant',
    'classes.manage', 'classes.instruct',
    'customize.manage', 'settings.manage',
  ],
  treasurer: ['payments.manage', 'ops.kb.read', 'ops.process.read'],
  member: ['ops.kb.read', 'ops.process.read'],
  associate: ['ops.kb.read'],
}

export function isValidPermission(code: string): code is PermissionCode {
  return PERMISSION_CODES.includes(code)
}
