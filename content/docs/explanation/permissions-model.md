hackerspace.sh is multi-tenant: every space is an isolated tenant, and almost every row in the database belongs to exactly one space. This page explains how that isolation is enforced, how a member's role becomes a concrete set of things they can do, and why the right to exercise a role depends on the member's dues status.

## Everything is space-scoped

Every tenant table (spaces, members, payments, the knowledge base, secrets, and the rest) carries a `space_id`. Access is decided by one question: *is the current user a member of that space?*

That question is answered in Postgres by a `SECURITY DEFINER` helper, `get_user_space_ids(uid)`, which returns every `space_id` a user belongs to. Row Level Security (RLS) policies on read-heavy tables reduce to a single predicate:

```sql
USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())))
```

RLS is enabled on all tenant tables. A logged-in user's queries are silently filtered to their own space — a member of space A cannot read, update, or delete a row belonging to space B, because that row's `space_id` is never in their set. The helper is `SECURITY DEFINER` with a fixed `search_path`, which both prevents recursive policy evaluation on `space_members` and closes the usual privilege-escalation vectors.

### Two enforcement layers

RLS is the backstop, not the only guard. The RLS-bound `server` and `client` Supabase clients are filtered automatically, but the `admin` (service-role) client bypasses RLS entirely. Any action that uses it must scope every query itself:

```ts
.eq('space_id', member.space_id)
```

So tenant isolation is enforced twice: once by Postgres RLS, and once by explicit `space_id` scoping in every server action. The redundancy is deliberate — the code-side scope is the *only* thing preventing a cross-tenant (IDOR) leak on the service-role path, where RLS will not save you. See [The security model](/docs/explanation/security-model) for the broader picture.

## From role to effective permission

Membership carries a `role` (one of `admin`, `board`, `treasurer`, `member`, `associate`), defined once in `lib/permissions.ts` in privilege order. Roles are the coarse gate; write-guarded server actions check them directly through helpers like `requireMemberWithRole(supabase, ADMIN_ROLES)`.

On top of roles sits a finer, per-space **permission** layer. The set of capabilities is fixed product data (`lib/permissions-catalog.ts` — codes like `ops.secrets.read`, `payments.manage`, `door.operate`, `classes.instruct`). Which subjects hold which permission is per-space, stored in `space_role_permissions` and editable at [/customize](/customize).

A "subject" is broader than a built-in role. `user_effective_roles(uid, sid)` unions three things:

| Subject kind | Source |
|---|---|
| Built-in role | the member's `role` |
| Custom role | slugs from `space_custom_roles` assigned to the member |
| Area lead | `area_lead:<id>` for each area the member leads |

`user_has_permission(uid, sid, perm)` then returns true when the member holds a permission grant whose subject is any of their effective roles. `admin` is the exception: it implicitly holds every permission and is never stored in the grant table, so it can never be accidentally revoked or locked out.

This layer is strictly **additive**. A permission grant can only *widen* what a subject can do through the surfaces that consult it (the Ops ACL, the customize UI). It never overrides RLS, so it cannot cross a tenant boundary.

## Why eligibility depends on status

A member also has a `status`: `current`, `late`, `inactive`, or `unverified`. Holding a privileged role is not enough — the member must be *privilege-eligible*, which means `current` or `late` only:

```ts
export const PRIVILEGE_STATUSES = ['current', 'late']
```

Both the role guard (`requireMemberWithRole` short-circuits when the member is not eligible) and the SQL functions (`user_has_permission`, `user_has_role_in_space`, `members_with_permission` all filter `status IN ('current','late')`) enforce this identically.

Two decisions are encoded here:

- **`unverified` holds nothing.** In a space with `require_approval` on, a new member is `unverified` until an admin approves them — even if they redeemed a role-bearing invite code. Without this gate, redeeming an admin-role invite into an approval-gated space would grant instant admin, silently voiding approval.
- **`late` keeps its role.** A dues lapse is a grace state, not an authorization downgrade. A treasurer who is one day late on dues does not lose the ability to do treasurer work.

## Tradeoffs

- **Single active space per user (today).** `getAuthMember` uses `.single()` and fails closed, so a user acts in exactly one space. True multi-space would need an explicit active-space selector before the isolation model changes.
- **Redundant scoping is verbose but safe.** Requiring `.eq('space_id', …)` on every admin-client query is easy to forget; the project locks it in with action-layer tests rather than trusting RLS alone.
- **Permissions widen, never narrow.** Because the permission layer is additive over role-based RLS, you cannot use it to take a capability *away* from a role that RLS already grants — only to extend a capability to additional subjects.

## Related

- [Roles and permissions reference](/docs/reference/roles-and-permissions)
- [Member statuses](/docs/reference/member-statuses)
- [Customizing roles and permissions](/docs/how-to/customize-permissions)
