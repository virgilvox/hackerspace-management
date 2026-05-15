# Permissions, Ops ACLs, and Area-Lead Roles — Design

Status: designed, not yet implemented. This is the plan for the next focused
pass. It is security-sensitive (it rewrites RLS on `secrets` and
`knowledge_base`), so it ships on its own, with its own tests, not bundled
with unrelated UI work.

## Goals (from the user)

1. Customizable permissions, not just role labels.
2. Per-secret access: choose which roles (multiple) can see each secret.
3. Same per-item access control across all Ops and Facilities content
   (knowledge base, processes, secrets, area leads).
4. Area-lead roles: an admin can create them. Each shows as "vacant" until a
   member is assigned, either from a dedicated picker or by clicking a member
   in the directory. Being the lead of an area grants the permissions attached
   wherever that area-lead role is referenced.

## Model

Three layers, smallest blast radius first.

### A. Permission catalog + role grants

- `permissions` is a fixed code list in app code (not a table): e.g.
  `ops.kb.read`, `ops.kb.write`, `ops.secrets.read`, `ops.secrets.write`,
  `members.manage`, `payments.manage`, `governance.manage`, etc.
- New table `space_role_permissions (space_id, role_or_custom, permission)`
  where `role_or_custom` is either a built-in `member_role` value or a
  `space_custom_roles.slug`. Admin always has all permissions implicitly
  (never lockable out — guard in code and RLS).
- A SQL helper `user_has_permission(uid, sid, perm text) returns boolean`
  (SECURITY DEFINER, fixed search_path) used by RLS and a TS mirror
  `hasPermission()` used in server actions for early rejection + UI gating.

### B. Per-item ACLs for Ops content

- New table `ops_acl (id, space_id, entity_type, entity_id, role text)`
  where `entity_type in ('secret','kb','process','area_lead')` and `role`
  is a built-in role, a custom-role slug, or the sentinel
  `area_lead:<area_code>`.
- An item with zero ACL rows falls back to its existing visibility column
  (`knowledge_base.visibility`, the board/admin default for `secrets`), so
  this is additive and backward compatible.
- RLS SELECT on `secrets` / `knowledge_base` becomes: existing rule OR an
  `EXISTS` against `ops_acl` joined to the caller's effective roles
  (built-in role + assigned custom roles + area-lead memberships). Write
  stays admin/board (plus `ops.*.write` permission once layer A lands).

### C. Area-lead roles

- Reuse `space_custom_roles` with a flag `is_area_lead boolean` and an
  `area_code` link, OR add `space_area_lead_roles (id, space_id, area_code,
  name, color)`. Prefer the dedicated table: it is the thing that renders
  "vacant".
- `area_lead_assignments (space_id, area_lead_role_id, member_id)`. Absence
  of a row => the role renders "Vacant". Assignment is created from a picker
  in `/customize` -> Areas or from a "Make area lead" action on a member row
  in the directory.
- Effective-roles resolution (used by `ops_acl` SELECT and
  `user_has_permission`) treats a member who holds an area-lead assignment as
  also holding `area_lead:<area_code>`, so any Ops item whose ACL includes
  that sentinel becomes visible to them, and any permission granted to that
  area-lead role applies.

## UI surfaces

- `/customize` -> new "Permissions" panel: a role x permission matrix.
- `/customize` -> Areas: per-area "Lead role" with a member picker; shows
  "Vacant" when unassigned.
- `/ops` create/edit modals (KB, process, secret): a multi-select of roles +
  area-lead roles that may access this item.
- `/members`: row action "Assign as area lead" -> area picker.

## Migration plan

`scripts/023_permissions.sql` + `schema.sql` Section 15:
- `space_role_permissions`, `ops_acl`, `space_area_lead_roles`,
  `area_lead_assignments`. All with full RLS (SELECT for space members,
  write for admin/board, delete admin).
- Helper functions `user_effective_roles(uid, sid)` and
  `user_has_permission(uid, sid, perm)`.
- Rewrite `secrets` and `knowledge_base` SELECT policies to add the ACL
  branch. Keep the old branch so nothing that works today breaks.
- Seed sensible default `space_role_permissions` per space (admin: all;
  board: ops + members + governance; treasurer: payments; member: kb.read).
- Backfill: none required (empty ACL == current behavior).
- Refresh `types/database.ts`, `DB_SCHEMA_MAP.md`, `DATABASE_SCHEMA.md`,
  `API_REFERENCE.md`.

## Risks / why this is its own pass

- RLS on `secrets`/`knowledge_base` is the highest-risk surface in the app.
  A wrong policy either leaks a credential cross-role or locks admins out.
  Needs dedicated RLS tests (the `__tests__` governance/RLS pattern) before
  it goes near production.
- Permission resolution must never let a member escalate themselves (the
  migration-015 trigger pattern). The `user_has_permission` helper must be
  SECURITY DEFINER with a pinned search_path, same as the existing helpers.
- Ship behind the additive fallback so existing spaces are unaffected until
  an admin opts in by setting ACLs/permissions.
