-- =============================================================================
-- HACKERSPACE.SH — CANONICAL FRESH DEPLOYMENT SCHEMA
-- =============================================================================
-- This is the single source of truth for a fresh database setup.
-- Run this ONCE on a brand new Supabase project. It is fully idempotent.
--
-- Replaces all previous scripts (000–011). Those are kept as history only.
--
-- Execution order:
--   1. Extensions
--   2. Enums
--   3. Helper functions (used in RLS policies)
--   4. Tables (dependency order: spaces → space_members → everything else)
--   5. Indexes
--   6. Row Level Security (RLS) policies
--   7. Triggers
--   8. Auth hook (Supabase auth.users trigger)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENUMS
-- ─────────────────────────────────────────────────────────────────────────────

-- Member role within a space
DO $$ BEGIN
  CREATE TYPE public.member_role AS ENUM ('admin', 'board', 'treasurer', 'member', 'associate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Membership tier
DO $$ BEGIN
  CREATE TYPE public.member_tier AS ENUM ('plus', 'basic', 'associate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Membership lifecycle status
DO $$ BEGIN
  CREATE TYPE public.member_status AS ENUM ('current', 'late', 'inactive', 'unverified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task completion status
-- NOTE: Both 'completed' AND 'done' are valid — 'done' is legacy, 'completed'
-- is canonical. Application code must treat both as finished.
DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM (
    'open', 'claimed', 'in_progress', 'overdue', 'due_today',
    'completed', 'done', 'blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task category
DO $$ BEGIN
  CREATE TYPE public.task_type AS ENUM ('chore', 'task');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task / chore recurrence
DO $$ BEGIN
  CREATE TYPE public.recurrence_type AS ENUM ('daily', 'weekly', 'biweekly', 'monthly', 'none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Project lifecycle status
DO $$ BEGIN
  CREATE TYPE public.project_status AS ENUM ('backlog', 'in_progress', 'review', 'done', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payment platform source
DO $$ BEGIN
  CREATE TYPE public.payment_platform AS ENUM ('paypal', 'zeffy', 'venmo', 'cash');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Whether a payment row has been matched to a member
DO $$ BEGIN
  CREATE TYPE public.payment_link_status AS ENUM ('linked', 'unlinked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Knowledge base article visibility
DO $$ BEGIN
  CREATE TYPE public.kb_visibility AS ENUM ('all_members', 'board', 'admin_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Area lead assignment status
DO $$ BEGIN
  CREATE TYPE public.area_lead_status AS ENUM ('active', 'vacant', 'handoff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Contact / vendor type
DO $$ BEGIN
  CREATE TYPE public.contact_type AS ENUM ('vendor', 'supplier', 'partner', 'landlord', 'city');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Chat channel category
DO $$ BEGIN
  CREATE TYPE public.channel_type AS ENUM ('general', 'area', 'ops', 'project');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HELPER FUNCTIONS
-- Must be created before tables so they can be referenced in RLS policies.
-- Both are SECURITY DEFINER + fixed search_path to prevent privilege escalation.
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns all space_ids a given user belongs to.
-- Used in RLS policies to avoid recursive policy checks on space_members.
CREATE OR REPLACE FUNCTION public.get_user_space_ids(uid uuid)
  RETURNS SETOF uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT space_id FROM public.space_members WHERE user_id = uid;
$$;

-- Returns true if a user has one of the allowed roles in a specific space.
-- Used in RLS policies that require elevated permissions (admin, board, etc.).
CREATE OR REPLACE FUNCTION public.user_has_role_in_space(
  uid         uuid,
  sid         uuid,
  allowed_roles text[]
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE user_id    = uid
      AND space_id   = sid
      AND role::text = ANY(allowed_roles)
  );
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ── spaces ───────────────────────────────────────────────────────────────────
-- Top-level tenant. Each hackerspace is one row.
CREATE TABLE IF NOT EXISTS public.spaces (
  id                     uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                   text        NOT NULL,
  slug                   text        NOT NULL UNIQUE,
  city                   text,
  require_approval       boolean     NOT NULL DEFAULT true,
  public_member_directory boolean    NOT NULL DEFAULT false,
  invite_code            text        NOT NULL UNIQUE,
  webhook_secret         text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ── space_members ─────────────────────────────────────────────────────────────
-- One row per (user × space). A user may belong to multiple spaces.
CREATE TABLE IF NOT EXISTS public.space_members (
  id               uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id         uuid         NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id          uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name     text         NOT NULL,
  handle           text,
  email            text,
  phone            text,
  role             member_role  NOT NULL DEFAULT 'member',
  tier             member_tier  NOT NULL DEFAULT 'basic',
  status           member_status NOT NULL DEFAULT 'current',
  approved         boolean      NOT NULL DEFAULT true,
  has_card_access  boolean      NOT NULL DEFAULT false,
  payment_status   text,
  payment_note     text,
  last_payment_at  timestamptz,
  last_paid_at     timestamptz,
  joined_at        timestamptz  NOT NULL DEFAULT now()
);

-- ── tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id                uuid           PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id          uuid           NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title             text           NOT NULL,
  description       text,
  type              task_type      NOT NULL DEFAULT 'task',
  task_type         text           NOT NULL DEFAULT 'chore',  -- legacy text col, kept for compat
  status            task_status    NOT NULL DEFAULT 'open',
  area              text,
  recurrence        recurrence_type NOT NULL DEFAULT 'none',
  due_date          timestamptz,
  assigned_to       uuid           REFERENCES public.space_members(id) ON DELETE SET NULL,
  assigned_to_name  text,
  claimed_by        uuid           REFERENCES public.space_members(id) ON DELETE SET NULL,
  claimed_by_name   text,
  requested_by      uuid           REFERENCES public.space_members(id) ON DELETE SET NULL,
  requested_by_name text,
  subtask_total     integer        NOT NULL DEFAULT 0,
  subtask_completed integer        NOT NULL DEFAULT 0,
  progress          integer        NOT NULL DEFAULT 0,
  last_done_at      timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz    NOT NULL DEFAULT now(),
  updated_at        timestamptz    NOT NULL DEFAULT now()
);

-- ── projects ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id               uuid           PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id         uuid           NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title            text           NOT NULL,
  name             text,           -- legacy alias for title, kept for compat
  description      text,
  status           project_status NOT NULL DEFAULT 'backlog',
  area             text,
  category         text,
  tags             text[],
  assignees        text,          -- free-form text list
  assignee_names   text[],        -- structured array
  task_count       integer        NOT NULL DEFAULT 0,
  tasks_completed  integer        NOT NULL DEFAULT 0,
  progress         integer        NOT NULL DEFAULT 0,
  due_date         timestamptz,
  created_at       timestamptz    NOT NULL DEFAULT now(),
  updated_at       timestamptz    NOT NULL DEFAULT now()
);

-- ── payments ─────────────────────────────────────────────────────────────────
-- One row per transaction. Imported from PayPal/Zeffy/Venmo or logged as cash.
CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id         uuid                 NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  platform         payment_platform     NOT NULL,
  amount           numeric(10, 2)       NOT NULL,
  from_identifier  text,               -- email, @handle, or name from source platform
  from_note        text,               -- memo / note from sender
  member_id        uuid                REFERENCES public.space_members(id) ON DELETE SET NULL,
  member_name      text,
  link_status      payment_link_status  NOT NULL DEFAULT 'unlinked',
  transaction_date timestamptz          NOT NULL,
  created_at       timestamptz          NOT NULL DEFAULT now()
);

-- ── contacts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id           uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     uuid          NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name         text          NOT NULL,
  code         text          NOT NULL,  -- short identifier
  contact_type contact_type  NOT NULL,
  email        text,
  phone        text,
  details      text,
  note         text,
  group_label  text,
  tags         text[],
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);

-- ── knowledge_base ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id               uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id         uuid          NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title            text          NOT NULL,
  description      text,
  content          text,
  icon             text,
  visibility       kb_visibility NOT NULL DEFAULT 'all_members',
  access_level     text          NOT NULL DEFAULT 'all_members',  -- legacy text col
  area             text,
  tags             text[],
  is_pinned        boolean       NOT NULL DEFAULT false,
  pinned           boolean       NOT NULL DEFAULT false,           -- legacy alias
  updated_by_id    uuid          REFERENCES public.space_members(id) ON DELETE SET NULL,
  updated_by_name  text,
  updated_by       text,         -- legacy text col
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

-- ── secrets ──────────────────────────────────────────────────────────────────
-- Shared credentials vault. Only admins can write; board+ can read.
CREATE TABLE IF NOT EXISTS public.secrets (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  icon        text,
  description text,
  value       text        NOT NULL,   -- stored as plain text; encryption is a future enhancement
  area        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── area_leads ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.area_leads (
  id          uuid             PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid             NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  area_name   text             NOT NULL,
  area_code   text             NOT NULL,
  lead_id     uuid             REFERENCES public.space_members(id) ON DELETE SET NULL,
  lead_handle text,
  status      area_lead_status NOT NULL DEFAULT 'active',
  created_at  timestamptz      NOT NULL DEFAULT now(),
  updated_at  timestamptz      NOT NULL DEFAULT now()
);

-- ── integrations ─────────────────────────────────────────────────────────────
-- Payment platform credentials and other third-party configs.
-- config JSONB stores platform-specific keys (e.g. { client_id, client_secret }).
CREATE TABLE IF NOT EXISTS public.integrations (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  platform     text        NOT NULL,
  description  text,
  is_connected boolean     NOT NULL DEFAULT false,
  config       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, platform)
);

-- ── comms_channels ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comms_channels (
  id             uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id       uuid         NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name           text         NOT NULL,
  icon           text,
  channel_type   channel_type NOT NULL DEFAULT 'general',
  area_reference text,        -- links an 'area' channel to an area code
  project_id     uuid         REFERENCES public.projects(id) ON DELETE SET NULL,
  member_count   integer      NOT NULL DEFAULT 0,
  unread_count   integer      NOT NULL DEFAULT 0,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (space_id, name)
);

-- ── comms_messages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comms_messages (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id   uuid        NOT NULL REFERENCES public.comms_channels(id) ON DELETE CASCADE,
  space_id     uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text        NOT NULL,
  handle       text,
  content      text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── activity_log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text,
  action       text        NOT NULL,
  entity_type  text,
  entity_id    uuid,
  details      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_space_members_user_id    ON public.space_members (user_id);
CREATE INDEX IF NOT EXISTS idx_space_members_space_id   ON public.space_members (space_id);
CREATE INDEX IF NOT EXISTS idx_tasks_space_id           ON public.tasks (space_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status             ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to        ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by         ON public.tasks (claimed_by);
CREATE INDEX IF NOT EXISTS idx_projects_space_id        ON public.projects (space_id);
CREATE INDEX IF NOT EXISTS idx_payments_space_id        ON public.payments (space_id);
CREATE INDEX IF NOT EXISTS idx_payments_platform        ON public.payments (platform);
CREATE INDEX IF NOT EXISTS idx_payments_link_status     ON public.payments (link_status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_date ON public.payments (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_comms_messages_channel   ON public.comms_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_messages_space     ON public.comms_messages (space_id);
CREATE INDEX IF NOT EXISTS idx_kb_space_id              ON public.knowledge_base (space_id);
CREATE INDEX IF NOT EXISTS idx_secrets_space_id         ON public.secrets (space_id);
CREATE INDEX IF NOT EXISTS idx_contacts_space_id        ON public.contacts (space_id);
CREATE INDEX IF NOT EXISTS idx_area_leads_space_id      ON public.area_leads (space_id);
CREATE INDEX IF NOT EXISTS idx_integrations_space_id    ON public.integrations (space_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_space_id    ON public.activity_log (space_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at  ON public.activity_log (created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
-- Pattern: Every table has RLS enabled.
-- SELECT policies: any space member can read their own space's data.
-- WRITE policies: elevated roles required (admin/board/treasurer as appropriate).
-- The helper functions above prevent recursive policy evaluation.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.spaces           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secrets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area_leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comms_channels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comms_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log     ENABLE ROW LEVEL SECURITY;

-- ── spaces ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS spaces_select_members    ON public.spaces;
DROP POLICY IF EXISTS spaces_insert_authenticated ON public.spaces;
DROP POLICY IF EXISTS spaces_update_admins     ON public.spaces;
DROP POLICY IF EXISTS spaces_delete_admins     ON public.spaces;

CREATE POLICY spaces_select_members ON public.spaces
  FOR SELECT USING (id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY spaces_insert_authenticated ON public.spaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY spaces_update_admins ON public.spaces
  FOR UPDATE USING (user_has_role_in_space(auth.uid(), id, ARRAY['admin']));

CREATE POLICY spaces_delete_admins ON public.spaces
  FOR DELETE USING (user_has_role_in_space(auth.uid(), id, ARRAY['admin']));

-- ── space_members ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS space_members_select_own        ON public.space_members;
DROP POLICY IF EXISTS space_members_select_same_space ON public.space_members;
DROP POLICY IF EXISTS space_members_insert_authenticated ON public.space_members;
DROP POLICY IF EXISTS space_members_update_admins     ON public.space_members;
DROP POLICY IF EXISTS space_members_delete_admins     ON public.space_members;

-- Own row always visible (needed for get_user_space_ids bootstrapping)
CREATE POLICY space_members_select_own ON public.space_members
  FOR SELECT USING (user_id = auth.uid());

-- All members of the same space can see each other
CREATE POLICY space_members_select_same_space ON public.space_members
  FOR SELECT USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

-- A user may insert their own row, or admins/board may insert on behalf of others
CREATE POLICY space_members_insert_authenticated ON public.space_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR user_has_role_in_space(auth.uid(), space_id, ARRAY['admin', 'board'])
  );

-- Members may update their own profile; admins may update anyone
CREATE POLICY space_members_update_admins ON public.space_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR user_has_role_in_space(auth.uid(), space_id, ARRAY['admin'])
  );

CREATE POLICY space_members_delete_admins ON public.space_members
  FOR DELETE USING (user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- ── tasks ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tasks_select_members  ON public.tasks;
DROP POLICY IF EXISTS tasks_insert_members  ON public.tasks;
DROP POLICY IF EXISTS tasks_update_members  ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_members  ON public.tasks;

CREATE POLICY tasks_select_members ON public.tasks
  FOR SELECT USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY tasks_insert_members ON public.tasks
  FOR INSERT WITH CHECK (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY tasks_update_members ON public.tasks
  FOR UPDATE USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY tasks_delete_members ON public.tasks
  FOR DELETE USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

-- ── projects ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS projects_select_members ON public.projects;
DROP POLICY IF EXISTS projects_insert_members ON public.projects;
DROP POLICY IF EXISTS projects_update_members ON public.projects;
DROP POLICY IF EXISTS projects_delete_members ON public.projects;

CREATE POLICY projects_select_members ON public.projects
  FOR SELECT USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY projects_insert_members ON public.projects
  FOR INSERT WITH CHECK (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY projects_update_members ON public.projects
  FOR UPDATE USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY projects_delete_members ON public.projects
  FOR DELETE USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

-- ── payments ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS payments_select_treasurer ON public.payments;
DROP POLICY IF EXISTS payments_modify_treasurer ON public.payments;

CREATE POLICY payments_select_treasurer ON public.payments
  FOR SELECT USING (
    user_has_role_in_space(auth.uid(), space_id, ARRAY['admin', 'board', 'treasurer'])
  );

CREATE POLICY payments_modify_treasurer ON public.payments
  FOR ALL USING (
    user_has_role_in_space(auth.uid(), space_id, ARRAY['admin', 'treasurer'])
  );

-- ── contacts ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS contacts_select_members ON public.contacts;
DROP POLICY IF EXISTS contacts_modify_members ON public.contacts;

CREATE POLICY contacts_select_members ON public.contacts
  FOR SELECT USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY contacts_modify_members ON public.contacts
  FOR ALL USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

-- ── knowledge_base ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS kb_select_members ON public.knowledge_base;
DROP POLICY IF EXISTS kb_insert_members ON public.knowledge_base;
DROP POLICY IF EXISTS kb_update_members ON public.knowledge_base;
DROP POLICY IF EXISTS kb_delete_board   ON public.knowledge_base;

CREATE POLICY kb_select_members ON public.knowledge_base
  FOR SELECT USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY kb_insert_members ON public.knowledge_base
  FOR INSERT WITH CHECK (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY kb_update_members ON public.knowledge_base
  FOR UPDATE USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY kb_delete_board ON public.knowledge_base
  FOR DELETE USING (user_has_role_in_space(auth.uid(), space_id, ARRAY['admin', 'board']));

-- ── secrets ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS secrets_select_admins ON public.secrets;
DROP POLICY IF EXISTS secrets_modify_admins ON public.secrets;

-- Board/treasurer can read; only admins can write
CREATE POLICY secrets_select_admins ON public.secrets
  FOR SELECT USING (
    user_has_role_in_space(auth.uid(), space_id, ARRAY['admin', 'board', 'treasurer'])
  );

CREATE POLICY secrets_modify_admins ON public.secrets
  FOR ALL USING (user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- ── area_leads ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS area_leads_select_members ON public.area_leads;
DROP POLICY IF EXISTS area_leads_modify_board   ON public.area_leads;

CREATE POLICY area_leads_select_members ON public.area_leads
  FOR SELECT USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY area_leads_modify_board ON public.area_leads
  FOR ALL USING (user_has_role_in_space(auth.uid(), space_id, ARRAY['admin', 'board']));

-- ── integrations ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS integrations_select_admins ON public.integrations;
DROP POLICY IF EXISTS integrations_modify_admins ON public.integrations;

CREATE POLICY integrations_select_admins ON public.integrations
  FOR SELECT USING (user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

CREATE POLICY integrations_modify_admins ON public.integrations
  FOR ALL USING (user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- ── comms_channels ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS channels_select_members ON public.comms_channels;
DROP POLICY IF EXISTS channels_insert_board   ON public.comms_channels;
DROP POLICY IF EXISTS channels_update_board   ON public.comms_channels;
DROP POLICY IF EXISTS channels_delete_board   ON public.comms_channels;

CREATE POLICY channels_select_members ON public.comms_channels
  FOR SELECT USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY channels_insert_board ON public.comms_channels
  FOR INSERT WITH CHECK (user_has_role_in_space(auth.uid(), space_id, ARRAY['admin', 'board']));

CREATE POLICY channels_update_board ON public.comms_channels
  FOR UPDATE USING (user_has_role_in_space(auth.uid(), space_id, ARRAY['admin', 'board']));

CREATE POLICY channels_delete_board ON public.comms_channels
  FOR DELETE USING (user_has_role_in_space(auth.uid(), space_id, ARRAY['admin', 'board']));

-- ── comms_messages ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS messages_select_members ON public.comms_messages;
DROP POLICY IF EXISTS messages_insert_members ON public.comms_messages;

CREATE POLICY messages_select_members ON public.comms_messages
  FOR SELECT USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

-- Users may only insert messages attributed to themselves
CREATE POLICY messages_insert_members ON public.comms_messages
  FOR INSERT WITH CHECK (
    space_id IN (SELECT get_user_space_ids(auth.uid()))
    AND user_id = auth.uid()
  );

-- ── activity_log ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS activity_select_members ON public.activity_log;
DROP POLICY IF EXISTS activity_insert_members ON public.activity_log;

CREATE POLICY activity_select_members ON public.activity_log
  FOR SELECT USING (space_id IN (SELECT get_user_space_ids(auth.uid())));

CREATE POLICY activity_insert_members ON public.activity_log
  FOR INSERT WITH CHECK (space_id IN (SELECT get_user_space_ids(auth.uid())));


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-creates default channels when a new space is created
CREATE OR REPLACE FUNCTION public.create_default_channels()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.comms_channels (space_id, name, channel_type) VALUES
    (NEW.id, 'general',       'general'),
    (NEW.id, 'announcements', 'general'),
    (NEW.id, 'random',        'general'),
    (NEW.id, 'facilities',    'ops')
  ON CONFLICT (space_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_space_created ON public.spaces;
CREATE TRIGGER on_space_created
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.create_default_channels();


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. AUTH HOOK — fires on every new auth.users signup
-- ─────────────────────────────────────────────────────────────────────────────
-- Reads metadata passed at signup time to either:
--   • Create a new space and add the user as admin  (space_action = 'create')
--   • Join an existing space via invite code         (space_action = 'join')
--
-- Required signup metadata:
--   create: { space_action, space_name, space_slug, space_city, invite_code, full_name }
--   join:   { space_action:'join', join_invite_code, full_name }
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_space_signup()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_space_id    uuid;
  v_action      text;
  v_name        text;
  v_slug        text;
  v_city        text;
  v_invite_code text;
BEGIN
  v_action := COALESCE(NEW.raw_user_meta_data ->> 'space_action', '');

  IF v_action = 'create' THEN
    v_name        := NEW.raw_user_meta_data ->> 'space_name';
    v_slug        := NEW.raw_user_meta_data ->> 'space_slug';
    v_city        := NEW.raw_user_meta_data ->> 'space_city';
    v_invite_code := NEW.raw_user_meta_data ->> 'invite_code';

    INSERT INTO public.spaces (name, slug, city, invite_code)
    VALUES (v_name, v_slug, v_city, v_invite_code)
    RETURNING id INTO v_space_id;

    INSERT INTO public.space_members
      (space_id, user_id, display_name, email, role, tier, status, approved)
    VALUES (
      v_space_id, NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Admin'),
      NEW.email,
      'admin', 'plus', 'current', true
    );

  ELSIF v_action = 'join' THEN
    v_invite_code := NEW.raw_user_meta_data ->> 'join_invite_code';
    SELECT id INTO v_space_id FROM public.spaces WHERE invite_code = v_invite_code;

    IF v_space_id IS NOT NULL THEN
      INSERT INTO public.space_members
        (space_id, user_id, display_name, email, role, tier, status, approved)
      SELECT
        v_space_id, NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Member'),
        NEW.email,
        'member', 'basic',
        CASE WHEN s.require_approval THEN 'unverified' ELSE 'current' END,
        CASE WHEN s.require_approval THEN false          ELSE true      END
      FROM public.spaces s WHERE s.id = v_space_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Wire the auth hook (must exist in auth schema, not public)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_space_signup();


-- ─────────────────────────────────────────────────────────────────────────────
-- DONE.
-- For a fresh deployment, this is the only script you need to run.
-- ─────────────────────────────────────────────────────────────────────────────
