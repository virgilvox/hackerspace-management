The platform is organized into twelve modules, each covering one area of running a space. This page lists every module, what it does, and the primary route where you use it. The same twelve are shown on the [landing page](/) under "What it does."

## Module list

| # | Module | What it does | Primary route |
|---|--------|--------------|---------------|
| 01 | Members | The member roster with dues status and contact info. Membership tiers, custom roles, and the per-space permissions matrix are configured at `/customize`. | `/members` |
| 02 | Tasks and chores | One-off and recurring work with assignments, due dates, and area tags. | `/tasks` |
| 03 | Projects | A board of what the space is building, with progress, areas, and who is on it. | `/projects` |
| 04 | Payments | Import from PayPal, Venmo, or Zeffy and reconcile transactions to members. | `/payments` |
| 05 | Ops and knowledge | Markdown procedures and knowledge base, area leads, and an encrypted secrets vault. | `/ops` |
| 06 | Governance | Proposals with quorum and voting, incident reports, a versioned policy library, and a member forum. | `/proposals` |
| 07 | Forms and waivers | A builder for any form or signable waiver, with immutable per-submission snapshots. | `/my-forms` |
| 08 | Certifications | Define certifications and let instructors award or revoke them, with expiry tracking. | `/certifications` |
| 09 | Classes | Schedule sessions, take signups with waitlists, mark attendance, and grant certifications. | `/classes` |
| 10 | Equipment | A tool registry with reservations, optionally gated behind a required certification. | `/equipment` |
| 11 | Access control | Associate member cards, connect a door controller, and keep an immutable access log. | `/doors` |
| 12 | Onboarding and invites | A configurable onboarding flow and role-granting invite links with usage caps. | `/customize` |

## Where each module lives

Several modules span more than one screen. The primary route above is the main entry point; the routes below are the related management and detail screens.

### Members

- `/members`, the member roster, dues statuses, and contact info.
- `/customize`, where membership tiers, custom roles, and the permissions matrix are configured (admin only; board can open `/customize` but these panels are read-only for board).
- `/contacts`, non-member contacts.
- `/me`, a member's own membership record ("My membership").
- `/recruitment`, prospective-member pipeline (admin only).

### Tasks, projects, and ops

- `/tasks`, tasks and chores.
- `/projects`, the project board.
- `/ops`, ops and facilities docs, area leads, and the secrets vault. Individual docs open at `/ops/[id]`.

### Payments and finance

- `/payments`, transaction import and reconciliation.
- `/financials`, financial reporting.
- `/import`, import and sync (admin only).

See [Connect payments](/docs/how-to/connect-payments) and [Import members](/docs/how-to/import-members).

### Governance

- `/proposals`, proposals, with detail at `/proposals/[id]` and creation at `/proposals/new`.
- `/incidents`, incident reports (`/incidents/new`, `/incidents/[id]`).
- `/policies`, the policy library (`/policies/new`, `/policies/[slug]`).
- `/forum`, the member forum (`/forum/new`, `/forum/[id]`).

See [Run a proposal](/docs/how-to/run-a-proposal).

### Forms and waivers

- `/my-forms`, forms available to you to fill out and sign.
- `/forms`, the form and waiver builder (`/forms/new`, `/forms/[id]`), gated by the `forms.manage` permission.

See [Build a form](/docs/how-to/build-a-form).

### Classes, certifications, and equipment

- `/classes`, the class schedule; `/classes/manage` for scheduling and rosters.
- `/certifications`, certification records, gated by `certifications.manage`.
- `/equipment`, the tool registry and reservations; `/equipment/manage` for the registry.
- `/attendance`, attendance records.

See [Your first class](/docs/tutorials/first-class) and [Equipment reservations](/docs/how-to/equipment-reservations).

### Access control

- `/doors`, the member-facing door and card view.
- `/door/manage`, door connections, cards, and the access log (`door.manage`).
- `/door/buttons`, API buttons for door actions.

See [Connect a door](/docs/how-to/connect-a-door).

### Onboarding and invites

- `/customize`, the onboarding flow builder and invite-link management (admin only).
- `/settings`, space settings (admin only).

See [Configure onboarding](/docs/how-to/configure-onboarding) and [Invite links](/docs/how-to/invite-links).

## Communication

Alongside the twelve modules, `/comms` provides in-app messaging, and `/dashboard` is the landing screen after sign-in. Both appear in the sidebar's Workspace section.

## Admin-only modules

Some routes are visible only to the `admin` and `board` roles, or to members granted the matching `*.manage` permission:

| Route | Requires |
|-------|----------|
| `/customize`, `/settings`, `/import`, `/recruitment` | admin or board |
| `/forms` | `forms.manage` |
| `/certifications` | `certifications.manage` |
| `/classes/manage` | `classes.manage` |
| `/equipment/manage` | `equipment.manage` |
| `/door/manage`, `/door/buttons` | `door.manage` |

Members without the role or permission do not see these links in the sidebar.
