Every space controls who can do what through two layers: a fixed set of five built-in roles that drive database-level access, and an additive per-space permission matrix that grants named capabilities to roles. This page catalogs both, plus the status gate that decides when a role or permission actually takes effect.

## Built-in roles

There are exactly five roles, defined by the `member_role` enum and listed here in privilege order. Every member holds exactly one built-in role. Roles cannot be added or removed, but a space can rename any of them and change its color in [Customize](/customize) (see [Customize your space](/docs/how-to/customize-space)); the rename is display-only and does not change access.

| Role | Default label | Notes |
|------|---------------|-------|
| `admin` | Admin | Implicitly holds every permission and can never be locked out |
| `board` | Board | Broad operational access; default holder of most permissions |
| `treasurer` | Treasurer | Finance-focused |
| `member` | Member | Standard member |
| `associate` | Associate | Limited access |

Two role groups are used throughout the app: `ADMIN_ROLES` (`admin`, `board`) gate most administrative writes, and `TREASURER_ROLES` (`admin`, `board`, `treasurer`) gate financial sign-off.

## Status and privilege eligibility

Holding a role is not enough to use it. A member's `member_status` must be privilege-eligible before any role or permission resolves. This is enforced at both the app layer and the RLS layer (`user_has_role_in_space` and `user_has_permission` both require it).

| Status | Can act in app | Privilege-eligible |
|--------|:-:|:-:|
| `current` | Yes | Yes |
| `late` | Yes | Yes |
| `unverified` | Yes (own `/me` and onboarding only) | No |
| `inactive` | No | No |

`unverified` is deliberately excluded: in a space that requires approval, a new member stays `unverified` until an admin approves them and must hold no privileged capability in that window, even if they redeemed a role-bearing [invite code](/docs/how-to/invite-links). A dues lapse moves a member `current` → `late`; that is a grace state, not an authorization downgrade, so `late` keeps its role.

## Permission catalog

Permissions are app-owned capability codes (the set is fixed by the product). Which roles hold which permissions is stored per space in `space_role_permissions`. The table below lists every code with its group and the built-in roles that hold it in a newly seeded space. `admin` holds all of them implicitly and is never stored.

| Code | Group | Capability | Default holders |
|------|-------|------------|-----------------|
| `ops.kb.read` | Ops | Read knowledge base | board, treasurer, member, associate |
| `ops.kb.write` | Ops | Write knowledge base | board |
| `ops.process.read` | Ops | Read processes | board, treasurer, member |
| `ops.process.write` | Ops | Write processes | board |
| `ops.secrets.read` | Ops | Reveal secrets | board |
| `ops.secrets.write` | Ops | Manage secrets | board |
| `ops.arealeads.manage` | Ops | Manage area leads | board |
| `members.manage` | People | Manage members | board |
| `payments.manage` | Finance | Manage payments | board, treasurer |
| `governance.manage` | Governance | Manage proposals, incidents, policies | board |
| `forum.moderate` | Community | Moderate forum and comments | board |
| `forms.manage` | Community | Manage forms and waivers | board |
| `certifications.manage` | Certifications | Manage certification types | board |
| `certifications.grant` | Certifications | Award and revoke certifications | board |
| `classes.manage` | Classes | Manage classes and schedule sessions | board |
| `classes.instruct` | Classes | Run classes: attendance, completion, attendees | board |
| `equipment.manage` | Equipment | Manage equipment and reservations | board |
| `door.manage` | Access | Configure door integrations, buttons, and member cards | board |
| `door.operate` | Access | Operate doors: open/lock, push/revoke cards | board |
| `apicall.invoke` | Access | Use API-call buttons (non-door automations) | board |
| `customize.manage` | Admin | Customize roles, tiers, areas, invites, onboarding | board |
| `settings.manage` | Admin | Space settings, integrations, webhooks | board |

## Custom roles

A space can also create custom roles (in the Roles section of [Customize](/customize)). A custom role has a slug, name, description, and color. On its own it is display-only: creating one adds a label for committees, mentors, or area leads and grants nothing. However, a custom role's slug appears as a subject in the Permissions matrix, so an admin can grant it any capability from the catalog. Custom roles are created and edited by `admin`/`board`; only `admin` can delete one.

## How permissions resolve

`user_effective_roles(uid, sid)` returns a member's built-in role, the slugs of any custom roles assigned to them, and an `area_lead:<id>` marker for each area they lead. `user_has_permission(uid, sid, perm)` then answers true when the member is privilege-eligible and either holds the `admin` role (implicit-all shortcut) or one of their effective roles has the permission granted in `space_role_permissions`.

This layer is strictly additive. A grant can only widen what a role can do through the surfaces that consult permissions; it never overrides the row-level security that isolates one space's data from another. The Permissions matrix is editable by `admin` and `board` — both the `setRolePermissions` server action and the `space_role_permissions` RLS policies authorize the two roles. The Customize UI, however, currently exposes the matrix as view-only to `board` and enables editing for `admin` only; a board member can still change permissions through the server action directly.

See also: [Modules reference](/docs/reference/modules) and [Customize your space](/docs/how-to/customize-space).
