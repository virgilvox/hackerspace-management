# Hackerspace.sh - Architecture Documentation

> **Last Updated**: 2026-05-21  
> **Version**: 1.0.0  
> **Status**: In production (serving live traffic)
>
> Note: Sections 7 and 13 and the project tree describe an earlier layout.
> Server actions are split per-domain under `lib/actions/*.ts` (re-exported
> from `lib/actions/index.ts`); there is no monolithic `lib/actions.ts`. The
> per-module behavior is current; the module-feature sections later in this
> document (Certifications, Classes, Equipment, Door, Presence, etc.) are the
> authoritative reference.

---

## 1. System Overview

Hackerspace.sh is a comprehensive member management platform designed for hackerspaces, makerspaces, and community workshops. It provides tools for:

- **Member Management**: Registration, approval workflows, role assignment, payment tracking
- **Task & Chore System**: Recurring tasks, assignment, claiming, completion tracking
- **Project Management**: Kanban-style project tracking with area assignments
- **Financial Operations**: Payment reconciliation, multi-platform integration (PayPal, Zeffy, Venmo)
- **Communications**: Real-time chat via Supabase Realtime
- **Knowledge Base**: Documentation, secrets vault, area lead management
- **Contacts Management**: Vendor, supplier, and partner directory

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.x | React framework with App Router |
| React | 19.2 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | Latest | Component library |
| Lucide React | Latest | Icons |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Supabase | Latest | PostgreSQL database, Auth, Realtime |
| Next.js Server Actions | - | Server-side mutations |
| Row Level Security (RLS) | - | Database-level authorization |

### Infrastructure
| Service | Purpose |
|---------|---------|
| DigitalOcean Droplet | Self-hosted runtime (Docker, systemd, Caddy with Let's Encrypt) |
| Self-hosted Supabase | Postgres, GoTrue (auth), PostgREST, Realtime, Studio |
| Resend | Transactional email (SMTP) |

---

## 3. Project Structure

```
/
├── app/                          # Next.js App Router
│   ├── (app)/                    # Protected app routes (require auth)
│   │   ├── comms/               # Real-time chat
│   │   ├── contacts/            # Vendor/supplier directory
│   │   ├── dashboard/           # Main dashboard
│   │   ├── import/              # CSV/database import
│   │   ├── members/             # Member management
│   │   ├── ops/                 # Knowledge base, secrets, area leads
│   │   ├── payments/            # Payment reconciliation
│   │   ├── projects/            # Project kanban
│   │   ├── settings/            # Space settings, integrations
│   │   ├── tasks/               # Tasks & chores
│   │   └── layout.tsx           # App shell with sidebar
│   ├── auth/                    # Auth callback routes
│   ├── login/                   # Login page
│   ├── signup/                  # Signup flow (create/join space)
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Landing page (redirect)
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── app-shell.tsx            # App wrapper
│   ├── app-sidebar.tsx          # Navigation sidebar
│   ├── task-claim-button.tsx    # Task claiming component
│   └── theme-provider.tsx       # Dark/light theme
├── lib/
│   ├── supabase/
│   │   ├── admin.ts             # Service role client (bypasses RLS)
│   │   ├── client.ts            # Browser client
│   │   ├── proxy.ts             # Middleware session refresh
│   │   └── server.ts            # Server Component client
│   ├── actions/                 # Server actions, one module per domain
│   │   ├── index.ts             # Barrel (re-exports every domain module)
│   │   ├── tasks.ts projects.ts members.ts payments.ts …
│   │   └── classes.ts equipment.ts door.ts presence.ts …
│   ├── *-logic.ts               # Pure, unit-tested decision logic
│   ├── *-guard.ts               # Per-feature server-component guards
│   ├── auth-helpers.ts          # requireMember / permission gates
│   └── utils.ts                 # Utility functions (cn)
├── scripts/                     # SQL
│   ├── schema.sql               # Canonical, idempotent (source of truth)
│   ├── 0NN_*.sql                # Numbered incremental migrations (→ 038)
│   └── seed.sql                 # Optional seed data
├── middleware.ts                # Auth middleware
├── docs/                        # This documentation
└── [config files]               # next.config, tsconfig, etc.
```

---

## 4. Authentication Flow

### 4.1 Sign Up (New User)

```
[User] → /signup
    │
    ├─→ Step 1: Account info (name, email, password)
    ├─→ Step 2: Choose Create or Join space
    │
    ├─→ [Create Space Flow]
    │   └─→ supabase.auth.signUp() with metadata:
    │       {
    │         space_action: 'create',
    │         space_name, space_slug, space_city, invite_code
    │       }
    │       └─→ DB Trigger: handle_space_signup()
    │           └─→ INSERT spaces → INSERT space_members (admin)
    │
    └─→ [Join Space Flow]
        └─→ supabase.auth.signUp() with metadata:
            {
              space_action: 'join',
              join_invite_code
            }
            └─→ DB Trigger: handle_space_signup()
                └─→ INSERT space_members (member, status based on require_approval)
```

### 4.2 Sign In

```
[User] → /login
    │
    └─→ supabase.auth.signInWithPassword()
        └─→ Middleware refreshes session
            └─→ App layout checks space_members
                └─→ Has membership? → /dashboard
                └─→ No membership? → /signup
```

### 4.3 Returning User (Authenticated, No Space)

```
[User] → /signup (with active session)
    │
    └─→ Detects user via supabase.auth.getUser()
        └─→ Shows space selection (create/join) only
            └─→ Calls server action: createSpace() or joinSpace()
                └─→ Uses admin client (bypasses RLS)
```

---

## 5. Database Schema

### 5.1 Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `spaces` | Hackerspace instances | id, name, slug, invite_code, require_approval |
| `space_members` | User membership records | user_id, space_id, role, tier, status, approved |
| `tasks` | Tasks and chores | type, status, area, claimed_by, recurrence |
| `projects` | Project tracking | status (kanban), area, tags, due_date |
| `knowledge_base` | Documentation | visibility, is_pinned, area |
| `secrets` | Encrypted credentials | value, area (admin only) |
| `area_leads` | Area leadership | area_code, lead_id, status |
| `contacts` | Vendor directory | contact_type, group_label |
| `payments` | Payment records | platform, amount, member_id, link_status |
| `comms_channels` | Chat channels | channel_type, area_reference |
| `comms_messages` | Chat messages | channel_id, user_id, content |
| `integrations` | Platform connections | platform, is_connected, config |
| `activity_log` | Audit trail | action, entity_type, entity_id |

### 5.2 Enums (Exact Values)

| Enum | Values |
|------|--------|
| `member_role` | admin, board, treasurer, member, associate |
| `member_tier` | plus, basic, associate |
| `member_status` | current, late, inactive, unverified |
| `task_type` | chore, task |
| `task_status` | open, claimed, in_progress, overdue, due_today, completed, done, blocked |
| `recurrence_type` | none, daily, weekly, biweekly, monthly |
| `project_status` | backlog, in_progress, review, done, blocked |
| `kb_visibility` | all_members, board, admin_only |
| `contact_type` | vendor, supplier, partner, landlord, city |
| `payment_platform` | paypal, zeffy, venmo, cash |
| `payment_link_status` | linked, unlinked |
| `channel_type` | general, area, ops, project |

---

## 6. Authorization Model

### 6.1 Role Hierarchy

```
Admin (full access)
  │
  ├─ Board (members, payments, projects, board-level secrets)
  │   │
  │   ├─ Treasurer (payments, financial data)
  │   │
  │   └─ Member (tasks, projects, comms, public KB)
  │       │
  │       └─ Associate (read-only, can claim chores)
```

### 6.2 RLS Policies Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `spaces` | Own space | Admin client | Admin | - |
| `space_members` | Same space | Self/Admin | Self/Admin | Admin |
| `tasks` | Members | Members | Members | Members |
| `projects` | Members | Members | Members | Members |
| `knowledge_base` | Members (visibility-scoped) | Members | Members | Board/Admin |
| `secrets` | Admin/Board | Admin | Admin | Admin |
| `payments` | Treasurer/Board/Admin | Treasurer/Admin | Treasurer/Admin | Treasurer/Admin |
| `comms_*` | Members | Members | - | Board/Admin |

**Privilege-eligible status (migration 046).** `user_has_role_in_space`
and `user_has_permission` additionally require the caller's
`space_members.status` to be `current` or `late` (mirrors
`lib/permissions` `PRIVILEGE_STATUSES`). An `unverified` member of a
`require_approval` space (or an `inactive` one) cannot exercise a role
or permission at the RLS layer even via direct PostgREST, complementing
the same gate at the app layer in `requireMemberWithRole`. Deliberately
NOT applied to `get_user_space_ids` / `user_effective_roles`: gating
SELECT-policy reads would break an unverified member's own `/me` and
onboarding, which IS the legitimate require_approval flow.

---

## 7. Server Actions Reference

### 7.1 Authentication (`lib/auth-actions.ts`)

| Action | Parameters | Role Required | Description |
|--------|------------|---------------|-------------|
| `signIn` | email, password | None | Authenticate user |
| `signUp` | email, password, fullName, action, ... | None | Create account |
| `signOut` | - | Authenticated | End session |
| `getUser` | - | Authenticated | Get current user |
| `getCurrentMembership` | - | Authenticated | Get member + space |
| `createSpace` | spaceName, spaceSlug, spaceCity, displayName | Authenticated | Create new space |
| `joinSpace` | inviteCode, displayName | Authenticated | Join existing space |

### 7.2 Tasks (`lib/actions/tasks.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createTask` | title, description?, type, area?, recurrence?, due_date? | Member |
| `claimTask` | taskId | Member |
| `completeTask` | taskId | Claimant |
| `deleteTask` | taskId | Member |

### 7.3 Projects (`lib/actions/projects.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createProject` | title, description?, area?, tags?, due_date? | Member |
| `updateProjectStatus` | projectId, status | Member |
| `deleteProject` | projectId | Member |

### 7.4 Members (`lib/actions/members.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `addMember` | display_name, email, phone?, handle?, tier, role, ... | Admin/Board |
| `updateMember` | memberId, updates | Admin/Board |
| `approveMember` | memberId | Admin/Board |
| `removeMember` | memberId | Admin |
| `importMembers` | rows[] | Admin/Board |

### 7.5 Payments (`lib/actions/payments.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `logCashPayment` | amount, from_note, member_id?, transaction_date? | Treasurer/Admin |
| `linkPaymentToMember` | paymentId, memberId | Treasurer/Admin |
| `importPaymentsCsv` | rows[] | Treasurer/Admin |

### 7.6 Knowledge Base & Secrets (`lib/actions/knowledge-base.ts`, `lib/actions/secrets.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createKbEntry` | title, content, area?, visibility?, is_pinned?, tags? | Member |
| `updateKbEntry` | entryId, updates | Member |
| `deleteKbEntry` | entryId | Board/Admin |
| `createSecret` | title, value, description?, area? | Admin/Board |
| `deleteSecret` | secretId | Admin |
| `upsertAreaLead` | area_code, area_name, lead_id?, lead_handle?, status? | Admin/Board |

### 7.7 Contacts (`lib/actions/contacts.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createContact` | name, contact_type, email?, phone?, ... | Member |
| `updateContact` | contactId, updates | Member |
| `deleteContact` | contactId | Member |

### 7.8 Settings (`lib/actions/settings.ts`)

> Note: `/settings` is admin-only and intentionally loads the space's own
> `webhook_secret` and integration `config` so an admin can view/rotate
> them. That is by-design same-space admin secret management, not a leak;
> the page redirects non-admins before any of it is fetched.

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `updateSpaceSettings` | name?, slug?, city?, require_approval?, public_member_directory? | Admin |
| `saveIntegration` | platform, config | Admin |
| `disconnectIntegration` | platform | Admin |
| `rotateWebhookSecret` | - | Admin |

---

## 8. Real-time Features

### 8.1 Comms (Chat)

The comms feature uses Supabase Realtime for live messaging:

```typescript
// Client-side subscription
const subscription = supabase
  .channel(`channel:${channelId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'comms_messages',
    filter: `channel_id=eq.${channelId}`
  }, payload => {
    setMessages(prev => [...prev, payload.new])
  })
  .subscribe()
```

### 8.2 Default Channels

Created automatically via DB trigger when a space is created:
- `general` - General discussion
- `announcements` - Official announcements
- `random` - Off-topic
- `facilities` - Building/equipment issues

---

## 9. File Structure Details

### 9.1 Page Components Pattern

Each feature follows a consistent pattern:

```
feature/
├── page.tsx          # Server Component - fetches data
└── feature-client.tsx # Client Component - UI + interactivity
```

**Example: Tasks**
- `page.tsx`: Fetches tasks, members, passes to client
- `tasks-client.tsx`: Renders tabs, modals, handles CRUD actions

### 9.2 Supabase Client Usage

| Location | Client | Use Case |
|----------|--------|----------|
| Server Components | `lib/supabase/server.ts` | Data fetching with RLS |
| Client Components | `lib/supabase/client.ts` | Realtime, client mutations |
| Server Actions | `lib/supabase/server.ts` | Protected mutations |
| Admin Operations | `lib/supabase/admin.ts` | Bypasses RLS (signup) |
| Middleware | `lib/supabase/proxy.ts` | Session refresh |

---

## 10. Security Considerations

### 10.1 RLS (Row Level Security)

All tables have RLS enabled. Policies enforce:
- Users can only see data from their space
- Role-based write permissions
- Admin client used only for initial space/member creation

### 10.2 Admin Client Safety

The admin client (`SUPABASE_SERVICE_ROLE_KEY`) is used ONLY for:
1. Creating spaces during signup (trigger handles member creation)
2. Adding first member to space
3. Operations where RLS would create circular dependencies

**Never expose to client-side code.**

### 10.3 Secrets Storage

Integration credentials:
- Secret-named fields (`client_secret`, `*_secret`, `api_key`, `secret_key`) are encrypted at rest in the AES-256-GCM secrets vault (`lib/secrets/vault.ts`, same vault Stripe + door use); only a `<field>_ref` id is kept in `integrations.config`. Server-side decrypt only, never returned to the client.
- Non-secret fields stored in `integrations.config` (JSONB) with `_set` indicators; UI shows connected state via the flags, never the value.
- Legacy plaintext secrets (pre-vault) are auto-migrated into the vault on the next `saveIntegration`.

---

## 11. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin operations |
| `SECRETS_ENCRYPTION_KEY` | Yes | AES-256-GCM key for the secrets vault |
| `NEXT_PUBLIC_OAUTH_GITHUB` / `NEXT_PUBLIC_OAUTH_GOOGLE` | No | Enable social sign-in buttons |

`.env.example` and `docs/DEPLOYMENT.md` are the authoritative env list. (`SUPABASE_JWT_SECRET` is not used by the app and was removed from this table.)

---

## 12. Migration History

| Script | Description |
|--------|-------------|
| 001 | Initial schema (13 tables, all enums) |
| 002 | Schema fixes, create_default_channels trigger |
| 003 | Signup trigger (handle_space_signup) |
| 004 | RLS helper functions |
| 005 | Additional RLS fixes |
| 006 | Comprehensive RLS rewrite |
| 007 | Added task_status 'done', contacts note/group_label |
| 008 | space_members.approved default=true |
| 009 | Member INSERT RLS, UNIQUE(space_id,email) |
| 010 | Fixed channel trigger (removed description column) |
| 011 | Fixed enum values (active→current, pending→unverified) |

Migrations 012-030 are tracked authoritatively in `docs/DATABASE_SCHEMA.md`
(governance kernel, areas, forum/tiers/roles/invites, configurable onboarding,
customizable permissions + Ops ACLs, self-change hardening, `026`-`029` custom
forms + waivers + onboarding form step + per-space form slug + invite roles,
`030` certifications + Instructor capability, `031` secrets SELECT honors
`ops.secrets.read`, `032` classes + sessions + signups, `033` equipment +
reservations, `034` member access cards + door permissions, `035` door
connections + access log, `036` door card slots; later migrations through
`054` add classes/equipment/Stripe-dues/notifications and the door epic's
inbound access-log ingest (`053`) + universal API-call buttons (`054`) — see
docs/DATABASE_SCHEMA.md for the full, authoritative migration history).

### Forms & waivers (migrations 026-029; complete Phases 1-5)

`forms` and `form_submissions` back a custom form/waiver builder. The feature
is complete (Phases 1-5): schema + RLS; server actions in
`lib/actions/forms.ts`; the builder UI under `/forms` (with starter
templates) + the public `/f/[space]/[slug]` page + a member-facing
`/my-forms` list; onboarding `form` step type with required-waiver
enforcement + auto-satisfy (migration 027); per-space form slug (028);
verified-email retro-link of anonymous submissions
(`claimMyAnonymousSubmissions`, hooked from `joinSpace` and
`finishOnboarding`; admin manual-link for unverified/admin-added members).
Invite codes can grant a role with usage caps (029; `/join/[space]`).
Security shape:
all submissions (anonymous, public-authenticated, or members) are written by a
single validated server action using the service client AFTER server-side
schema validation and snapshotting (same pattern as `finishOnboarding`); the
`form_submissions` table has no INSERT/UPDATE/DELETE policy, so RLS hard-denies
every non-service client; submissions are immutable to clients but a
`forms.manage` holder can permanently delete an individual submission
(`deleteSubmission`) or a whole form (`deleteForm`, which FK-cascades all its
submissions including signed waivers) through validated service-client actions
behind destructive UI confirms (`deleteForm` also requires an explicit
`confirm:true`). The public fill page is served by a service-client server
action, so the `anon` Postgres role gets no grant on `forms`. Form management
is gated by the new additive `forms.manage` permission via
`user_has_permission`.

Email-match association (migration 039 + app, owner-chosen 2026-05): a
submission is linked to a member whenever `submitter_email` matches a member
in the space — at submit time, on member add/email-change
(`linkSubmissionsByEmail`), via self-claim at join/onboarding, and a one-time
backfill. This intentionally includes raw anonymous submissions (attribution
only, no access); the tradeoff is documented inline in `submitForm` so it is
not mistaken for a bug. `forms.manage` holders see a member's submissions on
the `/members` per-member panel (`listMemberSubmissions`, RLS-honoring,
metadata only).

### Certifications & Instructor (migration 030)

`certifications` (per-space cert types; optional `validity_months`;
`is_active` archive) and `member_certifications` (per-member grants) back a
certification tracker. Pure decision logic is isolated in
`lib/certifications-logic.ts` (`computeExpiry` with month/leap-year clamping;
`certificationStatus` = revoked > expired > expiring_soon > active),
unit-tested. Server actions in `lib/actions/certifications.ts`. Two new
additive permissions: `certifications.manage` (cert types, gates
`/certifications` admin pages via `lib/certifications-guard.ts`) and
`certifications.grant` (award/revoke = the Instructor capability, assignable
to any role/area-lead through the existing `space_role_permissions` model, NOT
a new built-in role). The per-member award/revoke/renew panel is reachable
from a "Certs" column on `/members` shown to any `certifications.grant` holder
(independent of admin/board). Members see their own grants + effective
permissions read-only at `/me`. RLS is additive and default-deny: cert types
readable by any space member; grants readable by managers/granters (all) or
the member (own); `member_certifications` has no DELETE policy so grant/revoke
history is immutable (revoke is a soft `revoked_at` UPDATE). Expiry is
snapshotted at grant time so later edits to the cert type never retroactively
change an existing grant. There is no anonymous path.

### Classes (migrations 032, 037)

`classes` (offering), `class_sessions` (scheduled occurrence), and
`class_signups` (member signup) back a class scheduler. Pure logic in
`lib/classes-logic.ts` (`effectiveCapacity`, `computeSignupStatus`,
`canSignUp`, `signupFormEligibility`, `pickPromotion`), unit-tested. Server actions in
`lib/actions/classes.ts`. Two additive permissions: `classes.manage`
(class/session CRUD, gates `/classes/manage` via `lib/classes-guard.ts`)
and `classes.instruct` (attendance, completion, attendee list). Member
signup needs only membership. `/classes` is the member calendar (sign up /
waitlist / cancel); the member's own signups also appear on `/me`. RLS is
additive and default-deny: classes readable by managers (all) or members
(active only), sessions by any space member, signups by managers/instructors
(all) or the member (own) with instructor-only UPDATE and **no INSERT/DELETE
policy** so signup/cancel funnels through one validated service-client
action that enforces capacity/waitlist/dedupe and promotes the earliest
waitlisted member when a seat frees. A class may optionally set
`required_form_id` (migration 037): signup is then hard-gated on the member
having a `form_submissions` row for that form on file (waiver model),
checked via the service client since a class manager need not hold
`forms.manage`; a `classes.manage` holder gets the override and may also
sign a member up on their behalf (mirrors the equipment required-cert
gate). The member calendar shows the requirement and links to the public
form; the per-session signup roster is reused on `/classes/manage` behind a
toggle for staff (members never see who else signed up). Completing a
session can award the class's certification, but only through the normal
`grantCertification`
path, so it still requires the acting instructor to hold
`certifications.grant`; otherwise completion succeeds and the result
reports the certificates were skipped (no service-role bypass of the
guarded certifications surface). No anonymous path. Concurrent
signup/cancel is serialized per session by SECURITY DEFINER functions
`class_signup_tx` / `class_cancel_tx` (migration 045) holding
`pg_advisory_xact_lock(hashtext(session_id))`, so two simultaneous
signups at the capacity boundary cannot over-enroll and two simultaneous
cancels cannot double-promote a waitlister. The pure logic is the
documented rule; the RPC is the runtime authority.

### Equipment (migration 033)

`equipment` (registry; status available/maintenance/retired; optional
`required_certification_id`; `is_active` archive) and
`equipment_reservations` (member time-window reservation) back a tool
reservation system. Pure logic in `lib/equipment-logic.ts`
(`intervalsOverlap`, `hasConflict`, `reservationEligibility`), unit-tested.
Server actions in `lib/actions/equipment.ts`. One additive permission,
`equipment.manage` (registry CRUD + adjust/cancel any reservation, gates
`/equipment/manage` via `lib/equipment-guard.ts`). Members reserve with
only membership. `/equipment` is the member catalog (reserve), `/me` lists
the member's own reservations. RLS is additive and default-deny: equipment
readable by managers (all) or members (active only), reservations by
managers (all) or the member (own) with manager-only UPDATE and **no
INSERT/DELETE policy** so reserve/cancel funnels through one validated
service-client action that enforces the equipment status, the no-overlap
rule, and the required-certification gate (checked against the normal
`member_certifications` data; an `equipment.manage` holder gets the
override and may book on a member's behalf). The app-side check is a
fast pre-check; the database is the concurrency arbiter via a GiST
`EXCLUDE (equipment_id =, tstzrange(starts_at,ends_at,'[)') &&) WHERE
status='reserved'` constraint (migration 042 + `btree_gist`), so two
simultaneous requests for the same window cannot both insert. No
anonymous path.

### Door / access control (migrations 034-036, 053-054; epic complete, P1-P5)

Phased and complete: P1-P5 built + deployed, including member self-entry (reviewed at the locked checkpoint, then built). `member_cards` (034) associates RFID/NFC UIDs to
members; the UID is a credential (`door.manage`-only RLS, no member SELECT;
masked count+last4 self-view via a service-client action). `door.manage` /
`door.operate` permissions (group Access). `door_connections` (035) is a
per-space controller integration: the shared password is NOT stored on the
row — `secret_ref` points at the existing AES-256-GCM `secrets` vault and is
decrypted server-side only. `pinned_host` is the SSRF pin. Pure logic in
`lib/door-logic.ts` (SSRF `validateDoorTarget`, always-blocked metadata/
link-local, native HeatSync encoders with the firmware-verified fixed-width
zero-padding, generic template substitution, secret redaction) is heavily
unit-tested. `lib/door/executor.ts` is the single hardened egress: it
re-validates the target against the pin, refuses redirects, caps time and
body, and redacts secrets before any audit write. `door_access_log` is an
append-only, secrets-redacted audit with no client write policy (validated
service-client executor only). `/door/manage` (door.manage) configures
connections, picks a vault secret, and runs a safe `status`-only test.
Phase 3 (036) adds the live actions, all `door.operate`, rate-limited, each
writing one redacted `door_access_log` row, reading through the service
client after the permission check (operators have no RLS read on
`door_connections`/`member_cards`). `door_card_slots` is the per-connection
integer-slot allocation map for controllers that key cards by slot
(HeatSync 0-200); the lowest-free policy is pure unit-tested logic
(`lib/door-slots-logic.ts`), `UNIQUE (connection_id, slot)` lets the DB
arbitrate concurrent grants, `UNIQUE (connection_id, card_id)` makes
re-grant idempotent. `grantCard` reserves the slot in the DB first, calls
the controller, and rolls the reservation back if the call fails;
`revokeCard` is idempotent and frees the slot only on confirmed controller
success so the app map never diverges from the device; `doorControl`
(open/unlock/lock) touches no slot. `/door/manage` surfaces these to
`door.operate` holders. Member self-entry (`selfEntry`) is built: any
active member with at least one active card on file may trigger a momentary
OPEN on a connection that is enabled and has `allow_member_self_entry` on
(opt-in, off by default; the locked eligibility rule is "any active card",
no `door_card_slots` row required). Membership/cards are resolved
server-side, strict per-member rate limit, one redacted `self_entry` audit
row; surfaced as a "Door access" panel on the dashboard and on the
member `/doors` page (self-entry + masked own cards via `getMyCards` +
the member's own recent activity via `listMyDoorActivity`, a service-client
read after `requireMember` filtered to that member), hidden entirely for
ineligible members. Phase 4 (053) adds inbound access-log ingest: real
entry/denied events are pulled INTO `door_access_log` and matched to a
member, via two transports that share one ingest core
(`lib/door/ingest.ts`). Poll: `POST /api/cron/door-ingest` (constant-time
`CRON_SECRET`, `proxy.ts`-whitelisted, once-a-minute crontab) reads each
`inbound_enabled` native-HeatSync connection's `?z` log through the same
hardened executor (`fullBody`, capped) and parses it with the pure,
firmware-characterized `lib/door-log-logic.ts` (`<pre>` ring-buffer dump,
G+g/D+d card-number reconstruction with the 32767 divisor, best-effort
H:M:E). Webhook: `POST /api/door/inbound/[connection]` (also
`proxy.ts`-whitelisted, session-exempt) accepts pushed event JSON from any
controller/relay, authenticated by a per-connection bearer secret
(`inbound_secret_ref`, a distinct vault secret from the outbound password,
constant-time compared); body-size guarded, rate-limited, Zod-validated
(≤100 events). Both resolve a presented card to a member via the HeatSync
hex-uid model (`cardMatchesEvent`: a stored hex `card_uid` matches when
`hexInt(uid)` equals the reported decimal number, or a webhook uid matches
exactly) and dedupe-insert through the
service client: `door_access_log.dedupe_key` + the partial-unique
`(connection_id, dedupe_key)` index make a re-poll or webhook retry a
no-op, while NULL-keyed action rows stay unconstrained. The poll is
inherently best-effort (the HeatSync ring buffer has no per-entry sequence
id); the webhook (explicit event ids) is the reliable transport. The audit
log stays no-client-write/immutable; a webhook-supplied `occurred_at` is
clamped to not-in-the-future so a relay cannot reorder the operator's log.
Phase 5 (054) is the universal API-call UI builder: admins (door.manage,
which the catalog already scopes to "buttons") define `api_buttons` (label,
group, method GET/POST/PUT/PATCH/DELETE, base_url, pinned_host, url_template,
headers, body_template, auth_mode/auth_param, vault `secret_ref`, confirm,
and a per-button `required_permission`). A member presses only buttons whose
`required_permission` they hold (one new generic code `apicall.invoke`, the
default; a door-flavored button can require `door.operate`). `listInvokable
Buttons` is a service-client read returning only presentational fields (never
url/headers/secret); `invokeApiButton` is rate-limited-first, loads the
definition service-side scoped to the member's space, checks the per-row
permission (denials audited), decrypts the secret server-side and fires
through `callApi`. The egress is now shared: the SSRF+resolve+connect-by-IP+
no-redirect+caps+redact core is factored into one internal `egress`, with
`callDoor` (GET, query secret) and `callApi` (full verbs + headers + body +
secret injected per auth_mode, host header forced to the pin) on top; pure
request assembly + secret placement is unit-tested in `lib/api-call-logic.ts`
(`buildApiRequest`). The metadata/link-local block is absolute even for an
admin-configured button. `api_call_log` is the append-only, redacted,
service-client-only press audit (SELECT = door.manage). The builder lives at
`/door/buttons` (with a door-template preset); members press from `/doors`.
No anonymous path. The executor is the
single hardened egress: it resolves the controller host once via
`dns.lookup`, rejects if any resolved IP is loopback / unspecified /
link-local / metadata (IPv4-mapped IPv6 normalized; RFC1918 / LAN / ULA
allowed since controllers live there), then connects to the validated
IP literal so `fetch` performs no second resolution, closing the
DNS-rebind TOCTOU. Redirects are refused (`redirect: 'manual'`).
Controller errors never bubble the upstream reason to the client (a
generic message; the redacted detail goes only to `door_access_log`);
the redaction is auth-param-aware so a generic-adapter custom param
value is scrubbed regardless of its name.

---

### Presence & attendance (migration 038)

`space_visits` records one row per visit (check-in/out, `is_host`, in/out
notes); an open row (`checked_out_at IS NULL`) means the member is here. A
partial unique index keeps at most one open visit per member. Pure logic in
`lib/presence-logic.ts` (`presenceStatus`, `hostEligibility`,
`summarizePresence`), unit-tested. Server actions in
`lib/actions/presence.ts` are self-only (member resolved server-side) and
funnel through the service client; `space_visits` has SELECT for any space
member (presence is social) and **no client write policy**. There is no new
permission code: current presence is visible to all members, the org-wide
`/attendance` history is all-members by product decision, and every member
sees their own history on `/me`. Forgotten check-outs are handled without a
cron: an open visit older than `PRESENCE_MAX_OPEN_HOURS` (18h) is treated as
not-present in pure logic and auto-closed on the member's next check-in.
Checking in as a host is gated by `spaces.host_requires_card` (default
true): when set, the member needs an active `member_card` on file
(reuses the access-card model); a space may relax it to let anyone
self-mark host. Surfaced as the dashboard "Who's here" panel, the
`/attendance` page, and "My recent visits" on `/me`. No anonymous path.

---

### Stripe recurring dues (migration 040; product spine Phase 1)

Per-space OWN Stripe account (NOT Connect): the secret key + webhook
signing secret live encrypted in the AES-256-GCM secrets vault (the door
secret pattern), referenced by id from `integrations.config` which also
holds the mode, publishable key, tier→Price map and grace days. Pure
mapping logic in `lib/stripe-logic.ts` (pinned API version,
`duesMemberStatus`, `graceExceeded`) is unit-tested; `lib/stripe/client.ts`
builds a per-request `Stripe` client (never global, never client-exposed);
`lib/stripe/config.ts` holds the vault/config helpers (plain server module,
not `'use server'`, since they take the admin client). Members pay via a
hosted Checkout Session (`subscription` mode) and self-serve via the hosted
Billing Portal — card data never touches the app (SAQ A). The per-space
webhook `POST /api/stripe/webhook/[space]` verifies the signature with that
space's signing secret, is idempotent on Stripe's event id
(`stripe_webhook_events`), and maps the subscription lifecycle onto
`member_billing` + a `stripe` `payments` row + `space_members.status`
(grace → `late`, **never** auto-inactive, never auto-approves `unverified`).
`member_billing` SELECT = admin/board/treasurer with **no client write
policy** (webhook/service-client only); the member self-view is a validated
action. No new permission code. The webhook is hardened against three
classes of real-world Stripe behavior: replay (Stripe retries reuse the
event id, the unique `stripe_webhook_events` PK collapses them); out-of-
order delivery (a stale `customer.subscription.updated` carrying an
older period must NOT rewind `current_period_end` and false-lapse a
paid member, so `laterPeriodEnd` keeps the monotonic max); and
zero-decimal currencies (JPY/KRW/VND/etc. are NOT rescaled `/100`, via
`isZeroDecimalCurrency`). Error responses to the caller are generic;
the real cause is logged server-side. Phases 2-3 (transactional
notifications, broader self-serve) build on this.

### Alternate dues payment methods (migration 049)

Not every space uses Stripe. An admin can configure external pay-here links
per platform (`dues_payment_methods`, one row per `(space_id, payment_platform)`
for PayPal / Zeffy / Venmo) under `/settings`; members see the active ones as
click-out buttons in the `/me` dues card and pay off-platform; a treasurer
reconciles the resulting payment manually through the existing payments flow.
The row carries the `payment_platform` tag precisely so that manual reconcile
is pre-typed. This is link configuration only: there is NO automated payment
record on click, no webhook, no money handled in-app. Pure logic in
`lib/dues-payments-logic.ts` (the url-based platform subset + labels +
`isSafeDuesUrl`, which requires an absolute `https:` URL so an admin-entered
value cannot become an XSS or plaintext-downgrade vector; the Zod schema reuses
it) is unit-tested. RLS: SELECT = any space member (they render the buttons),
INSERT/UPDATE/DELETE = admin/board (`user_has_role_in_space`); the member-read
and admin-write server actions are in `lib/actions/dues-payments.ts`. Links are
rendered with `target="_blank" rel="noopener noreferrer"`.

The `/me` dues card (`components/billing/dues-card.tsx`) gates the Stripe
"Pay dues with card" button on whether the space actually has Stripe configured
(`getMyBilling` now returns a `configured` flag from `isStripeConfigured`), so a
space with no Stripe shows only its external links (or, if neither is set up, a
"contact an admin" note) instead of a dead Checkout button.

### Transactional notifications (migration 041; product spine Phase 2)

Outbox + dispatcher, not inline send. The Stripe webhook only writes a
`notifications` row (`invoice.paid` → `dues_renewed`, `invoice.payment_failed`
→ `dues_payment_failed`, lapse-to-`late` → `dues_lapsed`); it never calls the
mail provider, so the money path stays fast and retry-safe. The
`(space_id, dedupe_key)` unique index makes a Stripe event replay a no-op
(`ignoreDuplicates`). Pure render + dedupe logic in
`lib/notifications-logic.ts` is unit-tested (HTML-escaped, brand-neutral
copy). `lib/email/send.ts` is a one-function transport seam over Resend's
HTTP API (no SDK; `fetch`) returning a `retryable` flag; a self-hosted
deploy can swap it for SMTP without touching callers, and an unset
`RESEND_API_KEY` is a clean non-retryable no-op. The dispatcher
`POST /api/cron/notifications` (constant-time `CRON_SECRET` bearer, no
session — `proxy.ts` whitelists `/api/cron`) drains ≤20 pending rows per
run, passing each row id as Resend's `Idempotency-Key` so an overlapping
run cannot double-send; transient failures stay `pending` until the attempt
budget is spent, permanent ones go `failed`. `notifications` SELECT =
admin/board/treasurer, no client write policy; the member self-view
(`getMyNotifications`, surfaced on `/me`) is a validated action. The
droplet's crontab POSTs once a minute. The drain is fair across spaces:
oldest-first candidates are bucketed per `space_id` and round-robined,
so one tenant's billing burst cannot head-of-line-block another space's
mail; a lone-tenant deployment still drains the full batch. Resend's
`Idempotency-Key` is per-attempt (`<row.id>:<attempts>`) so a
cross-minute retry is a deliberately fresh send, not a cached prior
response. The status write is guarded with `.eq('status','pending')`
so two overlapping dispatcher runs cannot flip a row another already
marked sent. No new permission code.

### Notification breadth: bookings, classes, forms (product spine Phase 4)

Phase 2 (dues lifecycle) shipped the outbox + dispatcher. Phase 4 extends
event coverage to bookings, class signups, and form submissions, reusing
the same machinery unchanged (no new table, no dispatcher change, no new
env var). The `notifications.type` column is `text`, so adding event types
costs no migration.

A shared `lib/notifications/enqueue.ts` helper centralizes member-contact
lookup and the idempotent best-effort upsert; the Stripe webhook and every
new call site now go through it instead of inlining the same pattern.

New event types and their triggers:

- **Equipment** (`lib/actions/equipment.ts`)
    - `booking_confirmed` on `reserveEquipment` (always; a manager booking
      on behalf still emails the target member).
    - `booking_cancelled` on `cancelReservation` **only when the actor is
      not the affected member** (self-cancels stay silent; the actor
      already saw the UI confirm).
- **Classes** (`lib/actions/classes.ts`)
    - `class_signup_registered` / `class_signup_waitlisted` on
      `signUpForClass`, picked from the RPC's returned signup status.
    - `class_signup_promoted` on `cancelMySignup` when
      `class_cancel_tx` returns a `promoted_id` (the bumped waitlist
      member).
    - `class_session_cancelled` on `updateSession` when status flips to
      `cancelled`. Fans out one row per still-active signup (registered or
      waitlisted), dedupe by `(session, member)` so a re-cancel is a no-op.
- **Forms** (`lib/actions/forms.ts`, `submitForm`)
    - `form_submission_received` **only when the submitter is
      authenticated** (members or `public_auth`). Recipient is the
      verified Supabase auth email, never the typed `body.email`. Pure
      anonymous public submissions skip this confirmation (typed emails
      could belong to anyone; confirming to them would be a victim-spam
      vector).
    - `form_submission_admin` fans out to every member who holds
      `forms.manage`, dedupe by `(submission, admin)`. The admin link
      goes to `/forms/<id>/results`. Finding the recipient set efficiently
      is what migration 047 (`members_with_permission(sid, perm)`)
      exists for: an inverted, set-returning form of `user_has_permission`
      that respects the same current/late status gate (046) and the same
      admin shortcut + space-role-permissions / effective-roles fallback.
      Additive; existing `user_has_permission` callers unchanged.

Dedupe-key scheme (all keyed under `(space_id, dedupe_key)`):
`booking_*:<reservation_id>`; signup-keyed class events
`class_signup_*:<signup_id>` (stable across promotion);
`class_session_cancelled:<session_id>:<member_id>`;
`form_submission_received:<submission_id>`;
`form_submission_admin:<submission_id>:<admin_id>`.

Every enqueue is best-effort and wrapped: a notifications-table or
permission-lookup failure can never throw into the calling action, so the
underlying domain mutation always finalizes.

### Member notification preferences (migration 048; product spine Phase 5)

Per-member opt-out of muteable notification categories. The 11 event types map
to five categories in pure logic (`lib/notifications-prefs-logic.ts`,
unit-tested): `billing` (the three dues types), `bookings`, `classes`, `forms`
(submitter receipts), and `admin_alerts` (the `form_submission_admin` fan-out).
`billing` is deliberately NOT muteable: dues renewed / payment-failed / lapsed
are membership-critical (a muted lapse notice would let a member silently lose
access for non-payment), so they always send and never render a toggle. The
other four are muteable, default-on (opt-out model: a member who never touches
the toggles keeps today's behavior). Adding a new event type only needs a line
in `TYPE_CATEGORY` and a renderer; the storage and dispatcher do not change.

The preference is enforced at **dispatch time**, not enqueue time: the domain
actions and the Stripe webhook are unchanged and still enqueue every row. The
dispatcher batch-loads the preferences for the members in the drain set (keyed
by `member_id`, a globally-unique `space_members` PK) and, via the pure
`isMuted(prefs, type)`, marks a muted row `skipped` (a terminal status that
leaves the pending pool) instead of calling the mail provider. No send, no
Resend call, no rate-limit spacing for a muted row. The prefs lookup fails open
(send everything) on error, so a transient blip can never silently drop a
wanted email. Billing and unmapped types are never muted regardless of stored
prefs (defense-in-depth, tested). This governs emails sent and inbox noise (the
real cost and the volume governor for the Phase 4 fan-outs), not table rows.

`notification_preferences` (PK `(space_id, member_id, category)`) has RLS
enabled and **no client policy** (default-deny), the same convention as
`notifications` / `member_billing`: the member self-view
(`getMyNotificationPreferences`) and the toggle write
(`setMyNotificationPreference`, Zod-validated to the muteable categories only,
upsert scoped to the caller's own member row) both go through validated
service-client actions, and the dispatcher reads via the service client. The
toggles render on the `/me` Activity tab; a `skipped` row shows as "Muted" in
the member's own notification history. No new permission code.

### Member self-serve portal (`/me`; product spine Phase 3)

`/me` is a 3-tab portal (Profile / Membership / Activity). The server page does all data fetching and passes plain data to a single client portal component (`me-portal-client.tsx`) that owns tab state and rendering; the read-only sections were moved verbatim from the prior flat page (no behavior change in the shell). Profile editing and inline cancels reuse existing server actions (`updateMyProfile`, `discloseAffiliations`, `cancelMySignup`, `cancelReservation`) — no new mutation surface, server-side ownership/space scoping unchanged. `getMyPayments` follows the established service-client self-view convention (treasurer-scoped RLS, strictly scoped to the caller). Self-service email change goes through Supabase Auth (`updateUser` + `/auth/confirm` `verifyOtp`); the denormalized `space_members.email` is synced only post-verification. The email-change flow depends on Supabase project config (template + redirect allowlist; see DEPLOYMENT) and is inert until that is set. No new permission code, no schema change.

---

## 13. Known Limitations

1. **Test suite** - Extensive Vitest unit coverage of pure logic (`__tests__/`, run with `pnpm test`, hermetic), Playwright smoke e2e (`e2e/`), and a DB-backed integration suite (`integration/`, run with `pnpm test:integration` against a real Postgres; self-skips without one) that drives the shipped SQL through `psql` and the route handlers through their actual exports: the advisory-lock signup/cancel RPCs (045), the equipment exclusion constraint (042), the self-change trigger + `members_update` WITH CHECK (043/044), the billing/notification idempotency invariants, the Stripe webhook end to end (real signed events, vault secret resolution, replay, out-of-order period guard), and the RLS-layer privilege-status gate (046). Remaining gap: server-action orchestration beyond those critical paths still has no integration coverage, and e2e is mostly page-render checks.
2. **Payment integrations** - Stripe recurring dues IS integrated (product spine Phase 1: per-space keys, hosted Checkout/Portal, the per-space signed webhook). A PayPal sync endpoint exists (`app/api/paypal/sync/route.ts`). Manual import/CSV reconciliation remains the path for ad-hoc/other-platform payments; Zeffy/Venmo live APIs are not integrated.
3. **Social auth** - GitHub/Google sign-in is wired, gated by the `NEXT_PUBLIC_OAUTH_GITHUB`/`NEXT_PUBLIC_OAUTH_GOOGLE` env flags.
4. **Webhooks** - The HMAC signing contract and secret rotation exist; per-event delivery is not implemented (see `docs/WEBHOOKS.md`).
5. **Email notifications** - Dues-lifecycle (Phase 2; migration 041) plus booking, class signup, and form-submission events (Phase 4; migration 047) all reuse the same outbox + dispatcher. Member notification preferences (Phase 5; migration 048) let a member opt out of the muteable categories (bookings, classes, forms, admin alerts); billing is always-on. Enforced at dispatch time (muted rows are marked `skipped`, never sent). The in-app notification center (Phase 5; migration 051) gives `/me` an inbox with read/unread state (`notifications.read_at`) and is the always-on channel: a notification whose email was muted still appears in-app. The single member self-service page is `/me` (the former `/profile` was consolidated into it).

> **Schema gotcha (migration 052, learned from a production outage):** the auth layout resolves membership with `space_members.select('*, spaces(*)')`. Do NOT create a table with foreign keys to BOTH `space_members` and `spaces` -- PostgREST reads it as a junction and makes that embed ambiguous (`PGRST201`), which nulls every logged-in member and redirects them to `/signup`. `notification_preferences` keeps only its `member_id -> space_members` FK for this reason; `space_id` is a plain column. `integration/auth-embed.test.ts` guards the embed.
6. **Search** - Client-side filtering only, no server-side full-text search.
7. **Single space per user** - The auth resolver assumes one active membership per user; a user in 2+ spaces is not supported (no space switcher). Fails closed.
