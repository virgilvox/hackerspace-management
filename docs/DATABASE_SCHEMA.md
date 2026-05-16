# Hackerspace.sh - Database Schema Reference

> **Last Updated**: 2026-05-15  
> **Database**: PostgreSQL via self-hosted Supabase  
> **Tables**: ~30  
> **Source of Truth**: `scripts/schema.sql` (canonical, idempotent); numbered
> migrations `scripts/0NN_*.sql` upgrade existing deployments. The 13-table
> reference below is the original baseline; tables added by migrations
> 014-025 are summarized in the "Migrations 014-025" section at the end.

---

## Table of Contents

1. [Schema Overview](#1-schema-overview)
2. [Enum Types](#2-enum-types)
3. [Table Definitions](#3-table-definitions)
4. [Relationships](#4-relationships)
5. [Row Level Security](#5-row-level-security)
6. [Triggers & Functions](#6-triggers--functions)
7. [Indexes](#7-indexes)
8. [Migration History](#8-migration-history)

---

## 1. Schema Overview

```
┌─────────────────┐     ┌──────────────────┐
│     spaces      │────<│  space_members   │
└─────────────────┘     └──────────────────┘
        │                       │
        │                       │
        ├───────────────────────┼───────────────────┐
        │                       │                   │
        ▼                       ▼                   ▼
┌───────────────┐     ┌──────────────┐     ┌────────────────┐
│    tasks      │     │   projects   │     │   payments     │
└───────────────┘     └──────────────┘     └────────────────┘
        │
        │
┌───────────────┐     ┌──────────────────┐
│   contacts    │     │  knowledge_base  │
└───────────────┘     └──────────────────┘
        │                     │
        │                     │
┌───────────────┐     ┌──────────────┐     ┌────────────────┐
│    secrets    │     │  area_leads  │     │  integrations  │
└───────────────┘     └──────────────┘     └────────────────┘
        │
        │
┌─────────────────┐     ┌──────────────────┐
│ comms_channels  │────<│  comms_messages  │
└─────────────────┘     └──────────────────┘
        │
        │
┌─────────────────┐
│  activity_log   │
└─────────────────┘
```

---

## 2. Enum Types

### `member_role`
```sql
CREATE TYPE member_role AS ENUM ('admin', 'board', 'treasurer', 'member', 'associate');
```
| Value | Description |
|-------|-------------|
| `admin` | Full access to all features |
| `board` | Members, payments, projects, board secrets |
| `treasurer` | Payments and financial data |
| `member` | Standard member access |
| `associate` | Read-only, can claim chores |

### `member_tier`
```sql
CREATE TYPE member_tier AS ENUM ('plus', 'basic', 'associate');
```
| Value | Description |
|-------|-------------|
| `plus` | Full membership |
| `basic` | Standard membership |
| `associate` | Limited membership |

### `member_status`
```sql
CREATE TYPE member_status AS ENUM ('current', 'late', 'inactive', 'unverified');
```
| Value | Description |
|-------|-------------|
| `current` | Active, approved member |
| `late` | Payment overdue |
| `inactive` | No longer active |
| `unverified` | Awaiting approval |

**IMPORTANT**: Values `active` and `pending` do NOT exist. Use `current` and `unverified`.

### `task_type`
```sql
CREATE TYPE task_type AS ENUM ('chore', 'task');
```
| Value | Description |
|-------|-------------|
| `chore` | Recurring maintenance task |
| `task` | One-time task |

### `task_status`
```sql
CREATE TYPE task_status AS ENUM (
  'open', 'claimed', 'in_progress', 'overdue', 
  'due_today', 'completed', 'done', 'blocked'
);
```

### `recurrence_type`
```sql
CREATE TYPE recurrence_type AS ENUM ('none', 'daily', 'weekly', 'biweekly', 'monthly');
```
**NOTE**: No `quarterly` value exists.

### `project_status`
```sql
CREATE TYPE project_status AS ENUM ('backlog', 'in_progress', 'review', 'done', 'blocked');
```

### `kb_visibility`
```sql
CREATE TYPE kb_visibility AS ENUM ('all_members', 'board', 'admin_only');
```
**NOTE**: Value is `admin_only` not `admins_only`.

### `contact_type`
```sql
CREATE TYPE contact_type AS ENUM ('vendor', 'supplier', 'partner', 'landlord', 'city');
```
**NOTE**: No `contractor` value exists.

### `area_lead_status`
```sql
CREATE TYPE area_lead_status AS ENUM ('active', 'vacant', 'handoff');
```

### `payment_platform`
```sql
CREATE TYPE payment_platform AS ENUM ('paypal', 'zeffy', 'venmo', 'cash');
```

### `payment_link_status`
```sql
CREATE TYPE payment_link_status AS ENUM ('linked', 'unlinked');
```

### `channel_type`
```sql
CREATE TYPE channel_type AS ENUM ('general', 'area', 'ops', 'project');
```
**NOTE**: No `board` channel type exists.

---

## 3. Table Definitions

### `spaces`

Primary hackerspace/makerspace entity.

```sql
CREATE TABLE spaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  city            TEXT,
  invite_code     TEXT UNIQUE NOT NULL,
  require_approval BOOLEAN DEFAULT true,
  public_member_directory BOOLEAN DEFAULT false,
  webhook_secret  TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `name` | TEXT | No | - | Display name |
| `slug` | TEXT | No | - | URL-safe identifier |
| `city` | TEXT | Yes | - | Location |
| `invite_code` | TEXT | No | - | Join code (HSL-YYYY-XXXX) |
| `require_approval` | BOOLEAN | No | true | Require admin approval |
| `public_member_directory` | BOOLEAN | No | false | Public visibility |
| `webhook_secret` | TEXT | Yes | - | Webhook verification |
| `created_at` | TIMESTAMPTZ | No | now() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | No | now() | Last update |

**Constraints**:
- `slug` UNIQUE
- `invite_code` UNIQUE

---

### `space_members`

User membership in a space.

```sql
CREATE TABLE space_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id        UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name    TEXT NOT NULL,
  email           TEXT,
  handle          TEXT,
  phone           TEXT,
  role            member_role DEFAULT 'member',
  tier            member_tier DEFAULT 'basic',
  status          member_status DEFAULT 'current',
  approved        BOOLEAN DEFAULT true,
  joined_at       TIMESTAMPTZ DEFAULT now(),
  last_paid_at    TIMESTAMPTZ,
  has_card_access BOOLEAN DEFAULT false,
  payment_status  TEXT,
  payment_note    TEXT,
  UNIQUE(space_id, user_id),
  UNIQUE(space_id, email)
);
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | gen_random_uuid() | Primary key |
| `space_id` | UUID | No | - | FK to spaces |
| `user_id` | UUID | Yes | - | FK to auth.users (nullable for offline members) |
| `display_name` | TEXT | No | - | Full name |
| `email` | TEXT | Yes | - | Email address |
| `handle` | TEXT | Yes | - | Username/handle |
| `phone` | TEXT | Yes | - | Phone number |
| `role` | member_role | No | 'member' | Permission role |
| `tier` | member_tier | No | 'basic' | Membership tier |
| `status` | member_status | No | 'current' | Account status |
| `approved` | BOOLEAN | No | true | Approval status |
| `joined_at` | TIMESTAMPTZ | No | now() | Join date |
| `last_paid_at` | TIMESTAMPTZ | Yes | - | Last payment date |
| `has_card_access` | BOOLEAN | No | false | Physical access card |
| `payment_status` | TEXT | Yes | - | Payment status label |
| `payment_note` | TEXT | Yes | - | Payment notes |

**IMPORTANT**: Column is `last_paid_at` NOT `last_payment_at`.

---

### `tasks`

Tasks and recurring chores.

```sql
CREATE TABLE tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id            UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  type                task_type DEFAULT 'task',
  status              task_status DEFAULT 'open',
  area                TEXT,
  recurrence          recurrence_type DEFAULT 'none',
  due_date            TIMESTAMPTZ,
  assigned_to         UUID REFERENCES auth.users(id),
  assigned_to_name    TEXT,
  claimed_by          UUID REFERENCES auth.users(id),
  claimed_by_name     TEXT,
  requested_by        UUID REFERENCES auth.users(id),
  requested_by_name   TEXT,
  subtask_total       INTEGER DEFAULT 0,
  subtask_completed   INTEGER DEFAULT 0,
  last_done_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

**IMPORTANT**: Column is `type` NOT `task_type`.

---

### `projects`

Project tracking with kanban status.

```sql
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id        UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  status          project_status DEFAULT 'backlog',
  area            TEXT,
  tags            TEXT[],
  assignee_names  TEXT[],
  task_count      INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  due_date        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

**NOTE**: No `progress`, `blocked`, `priority`, or `owner_id` columns.

---

### `knowledge_base`

Documentation and procedures.

```sql
CREATE TABLE knowledge_base (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id        UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT,
  icon            TEXT,
  visibility      kb_visibility DEFAULT 'all_members',
  area            TEXT,
  tags            TEXT[],
  is_pinned       BOOLEAN DEFAULT false,
  updated_by_id   UUID REFERENCES auth.users(id),
  updated_by_name TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

**IMPORTANT**: Column is `is_pinned` NOT `pinned`. Column is `updated_by_name` NOT `updated_by`.

---

### `secrets`

Encrypted credentials (admin/board only).

```sql
CREATE TABLE secrets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  value       TEXT NOT NULL,
  area        TEXT,
  icon        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

---

### `area_leads`

Area leadership assignments.

```sql
CREATE TABLE area_leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  area_name   TEXT NOT NULL,
  area_code   TEXT NOT NULL,
  lead_id     UUID REFERENCES auth.users(id),
  lead_handle TEXT,
  status      area_lead_status DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(space_id, area_code)
);
```

---

### `contacts`

Vendor and partner directory.

```sql
CREATE TABLE contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id     UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  code         TEXT NOT NULL,
  contact_type contact_type NOT NULL,
  email        TEXT,
  phone        TEXT,
  details      TEXT,
  note         TEXT,
  group_label  TEXT,
  tags         TEXT[],
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
```

---

### `payments`

Payment records for dues tracking.

```sql
CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id         UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  platform         payment_platform NOT NULL,
  amount           NUMERIC(10,2) NOT NULL,
  from_identifier  TEXT,
  from_note        TEXT,
  member_id        UUID REFERENCES space_members(id),
  member_name      TEXT,
  link_status      payment_link_status DEFAULT 'unlinked',
  transaction_date TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

---

### `comms_channels`

Chat channels.

```sql
CREATE TABLE comms_channels (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id       UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  icon           TEXT,
  channel_type   channel_type DEFAULT 'general',
  area_reference TEXT,
  project_id     UUID REFERENCES projects(id) ON DELETE CASCADE,
  member_count   INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

**NOTE**: No `description`, `topic`, `unread_count`, or `is_archived` columns.

---

### `comms_messages`

Chat messages.

```sql
CREATE TABLE comms_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID NOT NULL REFERENCES comms_channels(id) ON DELETE CASCADE,
  space_id     UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id),
  display_name TEXT NOT NULL,
  handle       TEXT,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

**IMPORTANT**: Column is `content` NOT `message` or `body`. Column is `user_id` NOT `sender_id`.

---

### `integrations`

External platform connections.

```sql
CREATE TABLE integrations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id     UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  platform     TEXT NOT NULL,
  description  TEXT,
  is_connected BOOLEAN DEFAULT false,
  config       JSONB,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(space_id, platform)
);
```

---

### `activity_log`

Audit trail for all actions.

```sql
CREATE TABLE activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id     UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id),
  display_name TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    UUID,
  details      TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Relationships

### Foreign Keys

| From Table | Column | To Table | Column | On Delete |
|------------|--------|----------|--------|-----------|
| `space_members` | `space_id` | `spaces` | `id` | CASCADE |
| `space_members` | `user_id` | `auth.users` | `id` | SET NULL |
| `tasks` | `space_id` | `spaces` | `id` | CASCADE |
| `tasks` | `assigned_to` | `auth.users` | `id` | SET NULL |
| `tasks` | `claimed_by` | `auth.users` | `id` | SET NULL |
| `tasks` | `requested_by` | `auth.users` | `id` | SET NULL |
| `projects` | `space_id` | `spaces` | `id` | CASCADE |
| `knowledge_base` | `space_id` | `spaces` | `id` | CASCADE |
| `knowledge_base` | `updated_by_id` | `auth.users` | `id` | SET NULL |
| `secrets` | `space_id` | `spaces` | `id` | CASCADE |
| `area_leads` | `space_id` | `spaces` | `id` | CASCADE |
| `area_leads` | `lead_id` | `auth.users` | `id` | SET NULL |
| `contacts` | `space_id` | `spaces` | `id` | CASCADE |
| `payments` | `space_id` | `spaces` | `id` | CASCADE |
| `payments` | `member_id` | `space_members` | `id` | SET NULL |
| `comms_channels` | `space_id` | `spaces` | `id` | CASCADE |
| `comms_channels` | `project_id` | `projects` | `id` | CASCADE |
| `comms_messages` | `channel_id` | `comms_channels` | `id` | CASCADE |
| `comms_messages` | `space_id` | `spaces` | `id` | CASCADE |
| `comms_messages` | `user_id` | `auth.users` | `id` | SET NULL |
| `integrations` | `space_id` | `spaces` | `id` | CASCADE |
| `activity_log` | `space_id` | `spaces` | `id` | CASCADE |
| `activity_log` | `user_id` | `auth.users` | `id` | SET NULL |

---

## 5. Row Level Security

All tables have RLS enabled. Helper function:

```sql
CREATE OR REPLACE FUNCTION public.get_user_space_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = 'public'
AS $$
  SELECT space_id FROM public.space_members WHERE user_id = uid
$$;
```

### Policy Summary

| Table | Policy | Operation | Condition |
|-------|--------|-----------|-----------|
| `spaces` | `spaces_select_members` | SELECT | space_id IN get_user_space_ids(auth.uid()) |
| `spaces` | `spaces_insert_authenticated` | INSERT | auth.uid() IS NOT NULL |
| `spaces` | `spaces_update_admins` | UPDATE | Has admin role |
| `space_members` | `space_members_select_own` | SELECT | user_id = auth.uid() |
| `space_members` | `space_members_select_same_space` | SELECT | Same space |
| `space_members` | `space_members_insert_authenticated` | INSERT | auth.uid() IS NOT NULL |
| `space_members` | `space_members_update_admins` | UPDATE | Admin/Board or self |
| `space_members` | `space_members_delete_admins` | DELETE | Admin only |
| `tasks` | `tasks_*_members` | ALL | Members of space |
| `projects` | `projects_*_members` | ALL | Members of space |
| `knowledge_base` | `kb_select_members` | SELECT | Members + visibility |
| `knowledge_base` | `kb_insert_members` | INSERT | Members |
| `knowledge_base` | `kb_update_members` | UPDATE | Members |
| `knowledge_base` | `kb_delete_board` | DELETE | Board/Admin |
| `secrets` | `secrets_*_admins` | ALL | Admin/Board only |
| `payments` | `payments_*_treasurer` | ALL | Treasurer/Board/Admin |
| `contacts` | `contacts_*_members` | ALL | Members |
| `comms_channels` | `channels_select_members` | SELECT | Members |
| `comms_channels` | `channels_*_board` | INSERT/UPDATE/DELETE | Board/Admin |
| `comms_messages` | `messages_select_members` | SELECT | Members |
| `comms_messages` | `messages_insert_members` | INSERT | Members (user_id = auth.uid()) |
| `integrations` | `integrations_*_admins` | ALL | Admin only |
| `activity_log` | `activity_*_members` | SELECT/INSERT | Members |

---

## 6. Triggers & Functions

### `handle_space_signup()`

Triggered after auth.users INSERT. Creates space and/or member based on signup metadata.

```sql
CREATE OR REPLACE FUNCTION public.handle_space_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
-- Checks raw_user_meta_data for:
-- space_action: 'create' | 'join'
-- If 'create': creates space + admin member
-- If 'join': creates member in existing space
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_space_signup();
```

### `create_default_channels()`

Triggered after spaces INSERT. Creates default chat channels.

```sql
CREATE OR REPLACE FUNCTION public.create_default_channels()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.comms_channels (space_id, name, channel_type) VALUES
    (NEW.id, 'general', 'general'),
    (NEW.id, 'announcements', 'general'),
    (NEW.id, 'random', 'general'),
    (NEW.id, 'facilities', 'ops');
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_create_default_channels
AFTER INSERT ON public.spaces
FOR EACH ROW EXECUTE FUNCTION public.create_default_channels();
```

---

## 7. Indexes

Recommended indexes (may need to be added):

```sql
-- Space lookups
CREATE INDEX idx_spaces_slug ON spaces(slug);
CREATE INDEX idx_spaces_invite_code ON spaces(invite_code);

-- Member queries
CREATE INDEX idx_space_members_user_id ON space_members(user_id);
CREATE INDEX idx_space_members_space_status ON space_members(space_id, status);

-- Task queries
CREATE INDEX idx_tasks_space_status ON tasks(space_id, status);
CREATE INDEX idx_tasks_space_due ON tasks(space_id, due_date);

-- Project queries
CREATE INDEX idx_projects_space_status ON projects(space_id, status);

-- Payment queries
CREATE INDEX idx_payments_space_link ON payments(space_id, link_status);

-- Message queries
CREATE INDEX idx_messages_channel ON comms_messages(channel_id, created_at);

-- Activity log
CREATE INDEX idx_activity_space ON activity_log(space_id, created_at);
```

---

## 8. Migration History

| Script | Version | Description |
|--------|---------|-------------|
| `000_reset_schema.sql` | Dev | Drops and recreates everything (dev only) |
| `001_create_schema.sql` | 1.0 | Initial schema, all tables and enums |
| `002_schema_fixes.sql` | 1.1 | Added create_default_channels trigger |
| `003_signup_trigger.sql` | 1.2 | Added handle_space_signup trigger |
| `003_add_approved_column.sql` | 1.2 | Added approved column to space_members |
| `004_fix_rls_recursion.sql` | 1.3 | Fixed RLS infinite recursion |
| `005_fix_spaces_insert.sql` | 1.4 | Fixed spaces INSERT policy |
| `006_comprehensive_rls_fix.sql` | 1.5 | Complete RLS rewrite |
| `007_schema_audit_fixes.sql` | 1.6 | Added task_status 'done', contacts note/group_label, unique constraints |
| `008_fix_approved_default.sql` | 1.7 | space_members.approved DEFAULT true |
| `009_fix_member_insert_rls.sql` | 1.8 | Fixed member INSERT RLS for admin/board |
| `010_fix_channel_trigger.sql` | 1.9 | Removed non-existent description column from trigger |
| `011_fix_member_status_enum.sql` | 2.0 | Fixed enum values (active→current, pending→unverified) |

---

## Migrations 014-025 (additions since the 13-table baseline)

`scripts/schema.sql` is the canonical idempotent schema; each numbered
migration is mirrored as a section in it. Tables/columns added:

| Mig | Adds |
|-----|------|
| 014 | `space_members.user_id` made nullable (offline/imported members) |
| 015 | `prevent_member_self_role_change()` trigger (self-escalation guard) |
| 016 | Governance kernel: `proposals`, `proposal_votes`, `incidents`, `incident_updates`, `policies` + quorum/tally/SLA functions |
| 017 | Governance RLS hardening (cross-tenant edge cases) |
| 018 | `space_members.skills/interests/willing_to/affiliations/coi_last_disclosed_at`; `knowledge_base.is_meeting_minutes/meeting_date`; financial/member-directory visibility settings |
| 019 | Auto-expire open proposals past their voting window |
| 020 | `space_areas` (per-space configurable areas) + seeded defaults |
| 021 | `forum_threads`, `comments` (polymorphic: forum_thread/proposal/incident/policy), `space_tiers` + `space_members.tier_id`, `space_role_labels`, `space_custom_roles`, `space_member_custom_roles`, `space_invites`; `secrets.encrypted_value/encryption_version`; `knowledge_base.render_markdown`; comms_channels member-creatable |
| 022 | `space_onboarding_steps`; `space_members.onboarding_completed_at/onboarding_progress`; seed default steps |
| 023 | `space_role_permissions`, `ops_acl`; `user_effective_roles()`, `user_has_permission()` (SECURITY DEFINER); `secrets`/`knowledge_base` SELECT rewritten as `existing-rule OR ops_acl-match` (additive) |
| 024 | `prevent_member_self_role_change()` extended to also block self-change of `tier_id` and `onboarding_completed_at` |
| 025 | Re-asserts the hardened `incidents_insert` policy verbatim (production convergence; access-neutral, no schema change) |

New enum: `comment_entity_type` = `forum_thread | proposal | incident | policy`.

Every new table has RLS enabled with SELECT/INSERT/UPDATE/DELETE policies
(writes admin/board, deletes admin, reads space members) and, where it has
`updated_at`, a `touch_updated_at` trigger. The ACL model is additive:
with zero `ops_acl`/`space_role_permissions` rows the app behaves exactly
as the role-based baseline.
