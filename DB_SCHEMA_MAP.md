# DB Schema Map — Quick Reference

> **Last Updated**: 2026-03-10  
> **Full Documentation**: See [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) for complete reference  
> **Source of Truth**: Live database schema

---

## ENUMS — exact live values (queried 2026-03-10)

| Enum | Live Values |
|------|-------------|
| `member_role` | `admin`, `board`, `treasurer`, `member`, `associate` |
| `member_tier` | `plus`, `basic`, `associate` |
| `member_status` | `current`, `late`, `inactive`, `unverified` — **NOT** `active` or `pending` |
| `task_type` | `chore`, `task` — column is named **`type`**, NOT `task_type`. NO `ongoing` |
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
| `status` | text | default `'active'` |
| `payment_status` | text | nullable |
| `payment_note` | text | nullable |
| `joined_at` | timestamptz | |
| `last_paid_at` | timestamptz | nullable — **NOT** `last_payment_at` |
| `has_card_access` | boolean | default false |
| `approved` | boolean | default **true** (fixed script 008) |
| UNIQUE | `(space_id, user_id)` | |
| UNIQUE | `(space_id, email)` | added script 009 |

**Does NOT have:** `last_payment_at`, `approved_at`, `bio`, `avatar_url`

---

### `tasks`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `space_id` | uuid FK → spaces | NOT NULL |
| `title` | text NOT NULL | |
| `description` | text | nullable |
| `type` | task_type | default `'task'` — column is **`type`**, NOT `task_type` |
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

**Does NOT have:** `task_type`, `progress`, `blocked`, `priority`

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
3. App layout RSC calls `getCurrentMembership()` → queries `space_members` WHERE `user_id = auth.uid()` AND `status IN ('active', 'pending')`
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
