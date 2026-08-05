A member is one person's record in your space, stored in the `space_members` table. This page lists every member status and tier, the fields on the member record, and the settings that control who can see the directory. Manage members at [/members](/members); members edit their own record at [/me](/me).

## Statuses

`status` is the `member_status` enum. It defaults to `unverified`. It governs whether a member can act in the app and whether they hold their role's privileges.

| Status | Can use the app | Holds role privileges | Shown on |
| --- | --- | --- | --- |
| `current` | Yes | Yes | All members |
| `late` | Yes | Yes | All members (dues lapsed) |
| `unverified` | Yes | No — pending approval | Pending Approval tab |
| `inactive` | No — blocked from all actions | No | Inactive tab |

Notes:

- The active set is `current`, `unverified`, and `late`. Only these three are loaded as a member's active membership; `inactive` members are blocked from every server action.
- `late` is a dues state, not an authorization downgrade — a late member keeps their role and privileges.
- `unverified` is the approval gate. In a `require_approval` space, a new member stays `unverified` and holds **no** privileged capability until an admin approves them, even if they redeemed a role-bearing invite. Approving sets `status` to `current` and `approved` to `true`.
- The [/members](/members) page tabs are All, Payment Issues, Pending Approval (`unverified`), and Inactive. The All tab hides `inactive` members.

## Tiers

`tier` is the `member_tier` enum. It defaults to `basic` and records the membership level. It is set by an admin when adding or editing a member; it does not by itself grant permissions (roles do that).

| Tier |
| --- |
| `plus` |
| `basic` |
| `associate` |

## Record fields

Key columns on `space_members`. `user_id` is nullable on purpose: admins can add "offline" members who have no auth account.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `space_id` | uuid | Owning space |
| `user_id` | uuid, nullable | Auth account; null for offline members |
| `role` | `member_role` | Default `member`; see roles |
| `tier` | `member_tier` | Default `basic` |
| `tier_id` | uuid, nullable | FK to `space_tiers`; canonical custom-tier reference |
| `status` | `member_status` | Default `unverified` |
| `approved` | boolean | Default `true`; set true on approval |
| `display_name` | text | Self- or admin-editable |
| `handle` | text | Self- or admin-editable |
| `email` | text | Unique per space when present |
| `phone` | text | |
| `bio` | text | Self-editable |
| `avatar_url` | text | |
| `has_card_access` | boolean | Door access flag |
| `payment_status` | text | Non-`current` value drives the Payment Issues tab |
| `payment_note` | text | |
| `last_payment_at` / `last_paid_at` | timestamptz | |
| `dues_paid_until` | timestamptz | Dues coverage end |
| `joined_at` | timestamptz | Sort key on [/members](/members) |
| `stripe_customer_id` | text | |
| `skills` / `interests` / `willing_to` / `affiliations` | text[] | Self-editable profile arrays |
| `coi_last_disclosed_at` | timestamptz | Set when affiliations are disclosed |
| `onboarding_completed_at` | timestamptz, nullable | Set when onboarding is finished or skipped |
| `onboarding_progress` | jsonb | Default `{}`; tracks completed onboarding step IDs |
| `created_at` / `updated_at` | timestamptz | |

Constraints: unique on `(space_id, user_id)`, and a partial unique index on `(space_id, email)` when `email` is present.

### Who edits what

- **Self** (at [/me](/me)): `display_name`, `handle`, `phone`, `bio`, `skills`, `interests`, `willing_to`, and `affiliations`. Changing affiliations re-runs conflict-of-interest disclosure and updates `coi_last_disclosed_at`.
- **Admin** (at [/members](/members)): `email`, `display_name`, `phone`, `handle`, `role`, `tier`, `status`, `has_card_access`, `payment_status`, and `payment_note`. `joined_at` is only set when adding a member; `updateMember` does not accept it.

On the [/members](/members) page, some per-member panels are gated by capability rather than role: the access-cards panel (card UID) requires `door.manage`, the certifications panel requires `certifications.grant`, and the submitted-forms panel requires `forms.manage`.

## Directory visibility

Who can see the member directory is set per space by `member_directory_visibility` (the `directory_visibility` enum) under Member directory visibility in [/settings](/settings). It defaults to `members_visible`.

| Value | Who sees the directory |
| --- | --- |
| `members_visible` | Any authenticated member (default) |
| `public_members_visible` | Any authenticated member; behaves identically to `members_visible` (there is no public, unauthenticated directory route) |
| `board_only` | Elevated roles only (`admin`, `board`, `treasurer`) |
| `member_count_visible` | Elevated roles only; treated identically to `board_only` — non-elevated members get the same restricted notice (no count is shown) |

When a member is not permitted to see the directory, [/members](/members) shows a "restricted in this space" notice instead of the table.
