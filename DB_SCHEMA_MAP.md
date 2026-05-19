# DB Schema Map — Quick Reference

> **Last Updated**: 2026-05-15  
> **Full Documentation**: See [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) for complete reference  
> **Source of Truth**: `scripts/schema.sql` (canonical, idempotent)

---

## ENUMS — exact live values (queried 2026-03-10)

| Enum | Live Values |
|------|-------------|
| `member_role` | `admin`, `board`, `treasurer`, `member`, `associate` |
| `member_tier` | `plus`, `basic`, `associate` |
| `member_status` | `current`, `late`, `inactive`, `unverified` — **NOT** `active` or `pending` |
| `task_type` | `chore`, `task` — DB column is **`task_type`** (enum name and column name match) |
| `task_status` | `open`, `claimed`, `in_progress`, `overdue`, `due_today`, `completed`, `done`, `blocked` |
| `recurrence_type` | `daily`, `weekly`, `biweekly`, `monthly`, `none` — NO `quarterly` |
| `project_status` | `backlog`, `in_progress`, `review`, `done`, `blocked` |
| `kb_visibility` | `all_members`, `board`, `admin_only` — **NOT** `admins_only` |
| `contact_type` | `vendor`, `supplier`, `partner`, `landlord`, `city` — NO `contractor` |
| `area_lead_status` | `active`, `vacant`, `handoff` |
| `payment_platform` | `paypal`, `zeffy`, `venmo`, `cash` |
| `payment_link_status` | `linked`, `unlinked` |
| `channel_type` | `general`, `area`, `ops`, `project` — NO `board` |
| `contact_type` | `vendor`, `supplier`, `partner`, `landlord`, `city` |
| `payment_platform` | `paypal`, `zeffy`, `venmo`, `cash` |
| `payment_link_status` | `linked`, `unlinked` |
| `channel_type` | `general`, `area`, `ops`, `project` |

---

## TABLES — Every column, exact names

### `spaces`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text NOT NULL | |
| `slug` | text UNIQUE NOT NULL | |
| `city` | text | nullable |
| `require_approval` | boolean | default true |
| `public_member_directory` | boolean | default false |
| `invite_code` | text UNIQUE NOT NULL | |
| `webhook_secret` | text | nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Does NOT have:** `description`, `logo`, `timezone`

---

### `space_members`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `user_id` | uuid FK → auth.users | **NULLABLE** — offline members have no user_id |
| `role` | text | default `'member'` |
| `tier` | text | default `'basic'` |
| `display_name` | text NOT NULL | |
| `email` | text | nullable |
| `handle` | text | nullable |
| `phone` | text | nullable |
| `status` | member_status enum (`current`,`late`,`inactive`,`unverified`) | default `'unverified'`; "active" = `current`/`unverified`/`late` |
| `payment_status` | text | nullable |
| `payment_note` | text | nullable |
| `joined_at` | timestamptz | |
| `last_payment_at` | timestamptz | nullable — legacy, **also has `last_paid_at`** |
| `last_paid_at` | timestamptz | nullable — added script 013; used by importMembers / linkPaymentToMember |
| `has_card_access` | boolean | default false |
| `approved` | boolean | default **true** (fixed script 008) |
| UNIQUE | `(space_id, user_id)` | |
| UNIQUE | `(space_id, email)` | added script 009 |

**Does NOT have:** `last_payment_at` (has both `last_payment_at` and `last_paid_at`), `approved_at`, `bio`, `avatar_url`

---

### `tasks`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `title` | text NOT NULL | |
| `description` | text | nullable |
| `task_type` | task_type | default `'task'` — column is **`task_type`**, matching the enum name |
| `status` | task_status | default `'open'` — use `'completed'` not `'done'` |
| `area` | text | nullable |
| `recurrence` | recurrence_type | default `'none'` |
| `due_date` | timestamptz | nullable |
| `assigned_to` | uuid FK → auth.users | nullable |
| `assigned_to_name` | text | nullable |
| `claimed_by` | uuid FK → auth.users | nullable |
| `claimed_by_name` | text | nullable |
| `requested_by` | uuid FK → auth.users | nullable |
| `requested_by_name` | text | nullable |
| `subtask_total` | integer | default 0 |
| `subtask_completed` | integer | default 0 |
| `last_done_at` | timestamptz | nullable |
| `completed_at` | timestamptz | nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Does NOT have:** `type` (use `task_type`), `progress`, `blocked`, `priority`

---

### `projects`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `title` | text NOT NULL | |
| `description` | text | nullable |
| `status` | project_status | default `'backlog'` |
| `area` | text | nullable |
| `tags` | text[] | nullable |
| `assignee_names` | text[] | nullable |
| `task_count` | integer | default 0 |
| `tasks_completed` | integer | default 0 |
| `due_date` | timestamptz | nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Does NOT have:** `progress`, `blocked`, `priority`, `owner_id`

---

### `knowledge_base`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `title` | text NOT NULL | |
| `content` | text | nullable |
| `icon` | text | nullable |
| `visibility` | kb_visibility | default `'all_members'` |
| `area` | text | nullable |
| `tags` | text[] | nullable |
| `is_pinned` | boolean | default false — column is **`is_pinned`**, NOT `pinned` |
| `updated_by_id` | uuid FK → auth.users | nullable |
| `updated_by_name` | text | nullable — **NOT** `updated_by` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Does NOT have:** `description`, `pinned`, `updated_by`, `summary`

---

### `secrets`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `title` | text NOT NULL | |
| `icon` | text | nullable |
| `description` | text | nullable |
| `value` | text NOT NULL | |
| `area` | text | nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### `area_leads`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `area_name` | text NOT NULL | |
| `area_code` | text NOT NULL | |
| `lead_id` | uuid FK → auth.users | nullable |
| `lead_handle` | text | nullable |
| `status` | area_lead_status | default `'active'` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| UNIQUE | `(space_id, area_code)` | added script 007 |

---

### `contacts`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `name` | text NOT NULL | |
| `code` | text NOT NULL | auto-generated 3-char prefix + random 3 digits |
| `contact_type` | contact_type NOT NULL | |
| `email` | text | nullable |
| `phone` | text | nullable |
| `details` | text | nullable |
| `note` | text | nullable — added script 007 |
| `group_label` | text | nullable — added script 007 |
| `tags` | text[] | nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### `payments`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `platform` | payment_platform NOT NULL | |
| `amount` | numeric(10,2) NOT NULL | |
| `from_identifier` | text | nullable |
| `from_note` | text | nullable |
| `member_id` | uuid FK → space_members | nullable |
| `member_name` | text | nullable |
| `link_status` | payment_link_status | default `'unlinked'` |
| `transaction_date` | timestamptz NOT NULL | |
| `created_at` | timestamptz | |

**Does NOT have:** `description`, `reference`, `currency`

---

### `comms_channels`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `name` | text NOT NULL | |
| `icon` | text | nullable |
| `channel_type` | channel_type | default `'general'` |
| `area_reference` | text | nullable |
| `project_id` | uuid FK → projects | nullable, cascade delete |
| `member_count` | integer | default 0 |
| `created_at` | timestamptz | |

**Does NOT have:** `description`, `topic`, `unread_count`, `is_archived`

Default channels created by trigger on space INSERT: `general`, `announcements`, `random`, `facilities`

---

### `comms_messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `channel_id` | uuid FK → comms_channels | NOT NULL, cascade delete |
| `space_id` | uuid FK → spaces | NOT NULL |
| `user_id` | uuid FK → auth.users | nullable — **NOT** `sender_id` |
| `display_name` | text NOT NULL | |
| `handle` | text | nullable |
| `content` | text NOT NULL | **NOT** `message`, **NOT** `body` |
| `created_at` | timestamptz | |

**Does NOT have:** `message`, `body`, `sender_id`, `edited_at`, `reactions`

---

### `integrations`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `name` | text NOT NULL | |
| `platform` | text NOT NULL | |
| `description` | text | nullable |
| `is_connected` | boolean | default false |
| `config` | jsonb | nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| UNIQUE | `(space_id, platform)` | added script 007 |

---

### `activity_log`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `user_id` | uuid FK → auth.users | nullable |
| `display_name` | text | nullable |
| `action` | text NOT NULL | |
| `entity_type` | text | nullable |
| `entity_id` | uuid | nullable |
| `details` | text | nullable |
| `created_at` | timestamptz | |

---

## USER FLOWS

### Sign Up → Create Space
1. `/signup` form → `signUp()` → Supabase auth.signUp
2. After email confirm / immediate: `createSpace({ spaceName, spaceSlug, displayName })` (admin client, bypasses RLS)
3. Inserts `spaces` → trigger fires → inserts 4 default `comms_channels`
4. Inserts `space_members` as role=`admin`, tier=`plus`, status=`active`, approved=`true`
5. Redirect → `/dashboard`

### Sign Up → Join Space
1. `/signup` form → `signUp()`
2. `joinSpace({ inviteCode, displayName })` (admin client)
3. Looks up `spaces.invite_code` → inserts `space_members` with role=`member`, status=`active` (or `pending` if `require_approval=true`), approved=`true`
4. Redirect → `/dashboard`

### Login
1. `/login` → `signIn(email, password)` → Supabase auth
2. Middleware checks session cookie
3. App layout RSC resolves the member → queries `space_members` WHERE `user_id = auth.uid()` AND `status IN ('current','unverified','late')` (the `ACTIVE_STATUSES` set in `lib/permissions.ts`)
4. If no membership found → redirect `/signup`

### Dashboard
- RSC queries: tasks (open/in_progress), projects (in_progress), recent payments, activity_log, all scoped to `space_id`

### Tasks
- List: `tasks` WHERE `space_id = ?` ORDER BY `created_at DESC`
- Create: `createTask()` → status=`open`, type=`task|chore`
- Claim: `claimTask()` → status=`claimed`
- Complete: `completeTask()` → status=`completed` (NOT `done`)
- Delete: `deleteTask()`

### Projects
- Kanban columns: `backlog` | `in_progress` | `review` | `done`
- Create: `createProject()` → status=`backlog`
- Move: `updateProjectStatus(id, status)` where status ∈ project_status enum

### Members (admin/board write)
- List: all `space_members` for space
- Add: `addMember()` (RLS: user_has_role_in_space admin/board)
- Edit: `updateMember()`
- Approve: `approveMember()` → status=`active`, approved=`true`
- Remove: `removeMember()` (admin only)
- CSV: `importMembers()` → upsert on `(space_id, email)`

### Payments (treasurer/admin/board)
- List: `payments` JOIN `space_members` for display_name
- Log cash: `logCashPayment()` → platform=`cash`
- Link: `linkPaymentToMember()` → updates `member_id`, `link_status=linked`, member `last_paid_at`
- CSV: `importPaymentsCsv()`

### Ops / Knowledge Base
- List: `knowledge_base` ordered by `is_pinned DESC`, `created_at DESC`
- Create: `createKbEntry()` → columns: title, content, area, visibility, is_pinned, tags, icon, updated_by_id, updated_by_name
- Update: `updateKbEntry()` → same columns
- Secrets: `createSecret()`, `deleteSecret()` — admin/board only via RLS
- Area leads: `upsertAreaLead()` on conflict `(space_id, area_code)`

### Comms
- Channels: RSC fetches `comms_channels` WHERE `space_id = ?`
- Messages: client fetches `comms_messages` WHERE `channel_id = ?` ORDER BY `created_at`
- Realtime: Supabase channel subscription on `comms_messages` for `channel_id=eq.{id}`
- Send: INSERT `comms_messages` (channel_id, space_id, **user_id**, display_name, handle, **content**)

### Settings (admin)
- Space: `updateSpaceSettings()`
- Integrations: `saveIntegration()` upsert on `(space_id, platform)`, `disconnectIntegration()`
- Webhook: `rotateWebhookSecret()`

---

## RLS SUMMARY

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `spaces` | own space members | admin client only (bootstrap) | admin | — |
| `space_members` | own space | self OR admin/board | self OR admin | admin |
| `tasks` | members | members | members | members |
| `projects` | members | members | members | members |
| `knowledge_base` | members (visibility-scoped) | members | members | board/admin |
| `secrets` | admin/board/treasurer | admin | admin | admin |
| `area_leads` | members | board/admin | board/admin | board/admin |
| `contacts` | members | members | members | members |
| `payments` | treasurer/board/admin | treasurer/admin | treasurer/admin | treasurer/admin |
| `comms_channels` | members | board/admin | board/admin | board/admin |
| `comms_messages` | members | members (user_id=auth.uid()) | — | — |
| `integrations` | admin | admin | admin | admin |
| `activity_log` | members | members | — | — |

---

## MIGRATIONS APPLIED

| Script | Change |
|--------|--------|
| 001 | Full schema creation |
| 002 | Schema fixes + create_default_channels trigger (original — had bug) |
| 003 | Signup trigger |
| 004 | Admin helper functions |
| 005 | Additional fixes |
| 006 | Comprehensive RLS rewrite |
| 007 | Added task_status `done`; contacts `note`/`group_label`; unique on integrations(space_id,platform) and area_leads(space_id,area_code) |
| 008 | space_members.approved default=true; backfilled NULLs — fixed login loop |
| 009 | space_members INSERT RLS: allow admin/board inserts; added UNIQUE(space_id,email) |
| 010 | Fixed create_default_channels trigger — removed non-existent `description` column |
| 011 | Renamed tasks `type` column to `task_type` (canonical enum column name) |
| 012 | Canonical sync — task_type enum, cleaned duplicate columns |
| 013 | Added `space_members.last_paid_at` timestamptz — required by importMembers and linkPaymentToMember |
| 014-025 | See `docs/DATABASE_SCHEMA.md` migrations table (governance kernel, areas, forum/tiers/roles/invites, onboarding, permissions/ACLs, self-change hardening, incidents_insert re-assert) |
| 026 | `forms`, `form_submissions` + `forms.manage` permission (additive, default-deny RLS; submissions immutable + service-client-only) |
| 027 | `space_onboarding_steps.step_type` CHECK adds `'form'` (onboarding can embed a form/waiver; form id in step `config.form_id`) |
| 028 | Form slug unique PER SPACE (`UNIQUE(space_id, slug)`, drops global `UNIQUE(slug)`); public URL `/f/[space]/[slug]` |
| 029 | `space_invites.role` (member_role enum, default `member`); invites can grant a role; admin-granting invites are admin-only (app-enforced) |
| 030 | `certifications`, `member_certifications` + `certifications.manage` / `certifications.grant` permissions (the latter = Instructor). Additive default-deny RLS; grants soft-revoked + immutable (no DELETE policy); expiry snapshotted at grant; no anonymous path |
| 031 | `secrets_select` additively also honors `ops.secrets.read` (previously admin/board OR per-secret `ops_acl` only). Reveal/list gates let RLS decide; writes unchanged. Access-neutral unless the permission is granted |
| 032 | `classes`, `class_sessions`, `class_signups` + `classes.manage` / `classes.instruct` permissions. Additive default-deny RLS; signup/cancel via validated service-client action (no INSERT/DELETE policy); one non-cancelled signup per member+session; optional cert-on-completion via the normal certifications path |
| 033 | `equipment`, `equipment_reservations` + `equipment.manage` permission. Additive default-deny RLS; reserve/cancel via validated service-client action (no INSERT/DELETE policy) enforcing status + no-overlap + required-cert with manager override |
| 034 | `member_cards` + `door.manage` / `door.operate` permissions. Card UID is a credential: door.manage-only RLS, no member SELECT; masked (count+last4) self-view via server action. Door epic phase 1, no controller calls |
| 035 | `door_connections`, `door_access_log` (Door epic P2). Password via secrets vault (secret_ref), `pinned_host` SSRF pin, hardened executor. Connections CRUD = door.manage; log SELECT = door.manage/operate, service-client-only writes |
| 036 | `door_card_slots` (Door epic P3). Per-connection integer-slot allocation map (HeatSync keys cards by slot 0-200). UNIQUE(connection_id,slot) + UNIQUE(connection_id,card_id); lowest-free policy in pure logic. SELECT = door.manage/operate, service-client-only writes |
| 037 | `classes.required_form_id` nullable FK -> forms(id) ON DELETE SET NULL. Optional per-class form gate (waiver-on-file): signup requires a completed form_submissions row; classes.manage override + on-behalf. App-enforced; no RLS change |
| 038 | `space_visits` (presence/attendance) + `spaces.host_requires_card` bool default true. One open visit per member (partial unique); SELECT = any space member; service-client-only writes (self-resolved, immutable). No new permission code |
| 039 | DATA backfill only: link `form_submissions.member_id` (NULL) to earliest matching member by `(space_id, lower email = lower submitter_email)`. Idempotent; not in schema.sql |
| 040 | Stripe dues P1: `payment_platform` += `stripe`; `member_billing` (member↔Stripe customer/sub/status; SELECT admin/board/treasurer, service-client-only writes); `stripe_webhook_events` (idempotency, PK=event id, service-only). Per-space own keys (vault + integrations.config) |
| 041 | Notifications P2: `notifications` outbox (type, recipient, subject, body_html/text, status, attempts, dedupe_key). UNIQUE(space_id,dedupe_key) = idempotent webhook enqueue; partial idx (created_at) WHERE status='pending'. SELECT admin/board/treasurer, service-client-only writes (webhook enqueue + dispatcher cron); member self-view via validated action |
| 042 | Equipment double-booking P0 fix: `btree_gist` extension + `equipment_reservations_no_overlap` GiST EXCLUDE (equipment_id =, tstzrange(starts_at,ends_at,'[)') &&) WHERE status='reserved'. DB is the concurrency arbiter; reserveEquipment maps 23P01 to a friendly message. No new table/column |

---

## Tables added by migrations 016-041 (quick map)

| Table | Key columns | Purpose |
|-------|-------------|---------|
| `proposals` / `proposal_votes` | space_id, status, quorum_*, voting_*; member_id, position | Async governance voting |
| `incidents` / `incident_updates` | space_id, status, sla_*; visibility | Incident reports + log |
| `policies` | space_id, slug, version, status, body_* | Versioned policy library |
| `space_areas` | space_id, code, name, sort_order, is_archived | Per-space configurable areas |
| `forum_threads` | space_id, author_id, title, category, pinned, locked, comment_count | Forum |
| `comments` | space_id, entity_type, entity_id, author_id, parent_id, body | Polymorphic comments (forum/proposal/incident/policy) |
| `space_tiers` | space_id, slug, name, monthly_price_cents, billing_cadence, is_system | Custom membership tiers (`space_members.tier_id` FK) |
| `space_role_labels` | space_id, role, display_name, color | Rename/recolor built-in roles |
| `space_custom_roles` / `space_member_custom_roles` | space_id, slug, name, color / member_id, custom_role_id | Custom non-privileged roles + assignment |
| `space_invites` | space_id, code, label, expires_at, max_uses, uses_count, is_enabled, role | Multi-code invites; `role` (member_role, default member) is the role the invite grants on join |
| `space_onboarding_steps` | space_id, step_key, step_type, title, body, config, is_enabled, is_required | Configurable member onboarding |
| `space_role_permissions` | space_id, subject, permission | Role/custom-role permission grants |
| `ops_acl` | space_id, entity_type, entity_id, role | Per-item Ops access list (secret/kb/process/area_lead) |
| `forms` | space_id, slug (UNIQUE per space_id), kind (form/waiver), visibility (public_anon/public_auth/members), status (draft/published/closed), schema jsonb, legal_text, version | Custom forms + waivers. Write-gated by `forms.manage`; public page `/f/[space]/[slug]` served via service-client server action (no anon grant) |
| `form_submissions` | form_id, space_id, member_id, submitter_email, answers jsonb, form_snapshot jsonb, legal_text_snapshot, form_version, ip, user_agent | Append-only submissions. Per-row snapshot = immutable waiver record. SELECT = `forms.manage`; NO write policy (service-client only; immutable) |
| `certifications` | space_id, name (UNIQUE per space, case-insensitive), description, validity_months (null = never expires), is_active | Per-space certification types. SELECT = any space member; write-gated by `certifications.manage` |
| `member_certifications` | space_id, member_id, certification_id, granted_by, granted_at, expires_at (snapshotted at grant), revoked_at, revoked_by, revoked_reason, note | Per-member grants. Partial UNIQUE = one active grant per member+cert. SELECT = `certifications.manage`/`certifications.grant` (all) or member (own); INSERT/UPDATE = `certifications.grant`; NO DELETE policy (immutable history) |
| `classes` | space_id, title, description, payment_link (http(s) only), capacity, is_active, grants_certification_id -> certifications, required_form_id -> forms | Class offering. SELECT = `classes.manage` (all) or member (`is_active`); writes = `classes.manage`. Optional `required_form_id` hard-gates signup (waiver-on-file, app-enforced) |
| `class_sessions` | class_id, space_id, starts_at, ends_at, location, capacity, status (scheduled/cancelled/completed), notes | Scheduled occurrence. SELECT = any space member; writes = `classes.manage` |
| `class_signups` | session_id, space_id, member_id, status (registered/waitlisted/cancelled), attended, signed_up_at | Member signup. Partial UNIQUE = one non-cancelled signup per member+session. SELECT = manage/instruct (all) or member (own); UPDATE = `classes.instruct`; NO INSERT/DELETE policy (signup/cancel via validated service-client action) |
| `equipment` | space_id, name, description, location, status (available/maintenance/retired), required_certification_id -> certifications, asset_tag, is_active | Tool/equipment registry. SELECT = `equipment.manage` (all) or member (`is_active`); writes = `equipment.manage` |
| `equipment_reservations` | equipment_id, space_id, member_id, starts_at, ends_at, status (reserved/cancelled/completed), notes | Time-window reservation. SELECT = `equipment.manage` (all) or member (own); UPDATE = `equipment.manage`; NO INSERT/DELETE policy (reserve/cancel via validated service-client action; no-overlap + required-cert enforced there) |
| `member_cards` | space_id, member_id, card_uid (credential), card_type rfid/nfc, label, is_active | RFID/NFC card association. SELECT/writes = `door.manage` only; member self-view is masked (server action, never raw UID) |
| `door_connections` | space_id, name, adapter (native_heatsync/generic_http), base_url, pinned_host (SSRF pin), auth_mode, secret_ref -> secrets, verbs jsonb, allow_member_self_entry, is_enabled | Door controller integration. CRUD = `door.manage`. Password lives in the encrypted secrets vault, never here |
| `door_access_log` | space_id, connection_id, actor_member_id, target_member_id, action, success, detail (redacted), occurred_at | Append-only door audit. SELECT = `door.manage`/`door.operate`; NO write policy (validated service-client executor only; immutable) |
| `door_card_slots` | space_id, connection_id -> door_connections, card_id -> member_cards, slot int, created_by | Per-connection integer-slot allocation map. UNIQUE(connection_id,slot) + UNIQUE(connection_id,card_id). SELECT = `door.manage`/`door.operate`; NO write policy (service-client executor only, in lockstep with the controller) |
| `space_visits` | space_id, member_id, checked_in_at, checked_out_at, is_host, check_in_note, check_out_note | Presence/attendance. Open (checked_out_at NULL) = present; partial UNIQUE one-open-per-member. SELECT = any space member; NO write policy (self-resolved service-client actions only; immutable). Org-wide attendance view = all members |
| `member_billing` | space_id, member_id (UNIQUE per space), stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end | Stripe dues link. SELECT = admin/board/treasurer; NO client write policy (webhook/service-client only). Member self-view via a validated action |
| `stripe_webhook_events` | event_id PK, space_id, type, received_at | Webhook idempotency ledger (dedupe on Stripe's stable event id). Service-client only; no RLS policy |
| `notifications` | space_id, member_id, type, channel, recipient, subject, body_html, body_text, status, attempts, last_error, dedupe_key (UNIQUE per space), sent_at | Transactional email outbox. Webhook enqueues (idempotent via the unique key); dispatcher cron sends via Resend with row id as Idempotency-Key. SELECT = admin/board/treasurer; NO client write policy (service-client only). Member self-view via a validated action |

Column additions: `space_members.tier_id`, `onboarding_completed_at`, `onboarding_progress`; `secrets.encrypted_value`, `encryption_version`; `knowledge_base.render_markdown`, `is_meeting_minutes`, `meeting_date`; `classes.required_form_id`; `spaces.host_requires_card`. New enum `comment_entity_type`.

Helper functions: `user_effective_roles(uid,sid)`, `user_has_permission(uid,sid,perm)` (both SECURITY DEFINER, search_path=public), plus governance quorum/tally/SLA functions.
