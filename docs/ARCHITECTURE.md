# Hackerspace.sh - Architecture Documentation

> **Last Updated**: 2026-03-10  
> **Version**: 1.0.0  
> **Status**: Pre-Production Audit

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
│   ├── actions.ts               # All server actions (CRUD)
│   ├── auth-actions.ts          # Auth-specific actions
│   ├── types.ts                 # TypeScript interfaces
│   └── utils.ts                 # Utility functions (cn)
├── scripts/                     # SQL migrations
│   ├── 000_reset_schema.sql    # Schema reset (dev only)
│   ├── 001_create_schema.sql   # Initial schema
│   ├── 002-011_*.sql           # Incremental fixes
│   └── patch-dashboard.mjs     # Utility script
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

### 7.2 Tasks (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createTask` | title, description?, type, area?, recurrence?, due_date? | Member |
| `claimTask` | taskId | Member |
| `completeTask` | taskId | Claimant |
| `deleteTask` | taskId | Member |

### 7.3 Projects (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createProject` | title, description?, area?, tags?, due_date? | Member |
| `updateProjectStatus` | projectId, status | Member |
| `deleteProject` | projectId | Member |

### 7.4 Members (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `addMember` | display_name, email, phone?, handle?, tier, role, ... | Admin/Board |
| `updateMember` | memberId, updates | Admin/Board |
| `approveMember` | memberId | Admin/Board |
| `removeMember` | memberId | Admin |
| `importMembers` | rows[] | Admin/Board |

### 7.5 Payments (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `logCashPayment` | amount, from_note, member_id?, transaction_date? | Treasurer/Admin |
| `linkPaymentToMember` | paymentId, memberId | Treasurer/Admin |
| `importPaymentsCsv` | rows[] | Treasurer/Admin |

### 7.6 Knowledge Base & Secrets (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createKbEntry` | title, content, area?, visibility?, is_pinned?, tags? | Member |
| `updateKbEntry` | entryId, updates | Member |
| `deleteKbEntry` | entryId | Board/Admin |
| `createSecret` | title, value, description?, area? | Admin/Board |
| `deleteSecret` | secretId | Admin |
| `upsertAreaLead` | area_code, area_name, lead_id?, lead_handle?, status? | Admin/Board |

### 7.7 Contacts (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createContact` | name, contact_type, email?, phone?, ... | Member |
| `updateContact` | contactId, updates | Member |
| `deleteContact` | contactId | Member |

### 7.8 Settings (`lib/actions.ts`)

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

Integration credentials stored in `integrations.config` (JSONB):
- Values stored with `_set` indicators
- UI shows masked values
- Consider encryption at rest for production

---

## 11. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin operations |
| `SUPABASE_JWT_SECRET` | Yes | JWT verification |

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
connections + access log).

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
every non-service client and submissions are immutable. The public fill page is
served by a service-client server action, so the `anon` Postgres role gets no
grant on `forms`. Form management is gated by the new additive `forms.manage`
permission via `user_has_permission`.

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
guarded certifications surface). No anonymous path.

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
override and may book on a member's behalf). No anonymous path.

### Door / access control (migrations 034-036; epic in progress)

Phased; P1-P3 built, including member self-entry (reviewed at the locked checkpoint, then built). `member_cards` (034) associates RFID/NFC UIDs to
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
ineligible members. Phases 4-5 add inbound log ingest and the
universal API-call UI builder. No anonymous path.

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

## 13. Known Limitations

1. **No test suite** - Unit, integration, and E2E tests needed
2. **Payment integrations** - UI only, no actual OAuth/API
3. **Import feature** - UI only, no file processing
4. **Database connector** - UI only, not implemented
5. **Social auth** - GitHub/Google buttons present but not wired
6. **Webhook endpoint** - URL shown but no actual endpoint
7. **Email notifications** - Not implemented
8. **Search** - Client-side only, no full-text search
