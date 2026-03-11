-- =============================================================================
-- HACKERSPACE.SH — CANONICAL SCHEMA  (single source of truth)
-- =============================================================================
-- Run this file ONCE on a brand-new Supabase project.
-- It is fully idempotent: safe to run again if interrupted.
--
-- Execution order:
--   1. Extensions
--   2. Enums
--   3. Tables  (spaces → space_members → everything else)
--   4. Unique constraints & indexes
--   5. Helper functions  (reference space_members → must come after tables)
--   6. Row Level Security
--   7. Triggers & auth hook
--   8. Realtime
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE public.member_role      AS ENUM ('admin','board','treasurer','member','associate');   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.member_tier      AS ENUM ('plus','basic','associate');                        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.member_status    AS ENUM ('current','late','inactive','unverified');          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_status      AS ENUM ('open','claimed','in_progress','overdue','due_today','completed','done','blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_type        AS ENUM ('chore','task');                                    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.recurrence_type  AS ENUM ('daily','weekly','biweekly','monthly','none');      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.project_status   AS ENUM ('backlog','in_progress','review','done','blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_platform AS ENUM ('paypal','zeffy','venmo','cash');                   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_link_status AS ENUM ('linked','unlinked');                            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.kb_visibility    AS ENUM ('all_members','board','admin_only');                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.area_lead_status AS ENUM ('active','vacant','handoff');                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.contact_type     AS ENUM ('vendor','supplier','partner','landlord','city');   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.channel_type     AS ENUM ('general','area','ops','project');                  EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLES  (dependency order)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── spaces ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spaces (
  id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                    text        NOT NULL,
  slug                    text        NOT NULL UNIQUE,
  description             text,
  logo_url                text,
  city                    text,
  address                 text,
  timezone                text        NOT NULL DEFAULT 'America/Phoenix',
  invite_code             text,
  require_approval        boolean     NOT NULL DEFAULT true,
  public_member_directory boolean     NOT NULL DEFAULT false,
  webhook_secret          text,
  settings                jsonb       NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ── space_members ─────────────────────────────────────────────────────────────
-- One row per (user × space).
-- display_name  — the member's chosen name within this space
-- handle        — optional @handle (unique within a space is enforced by app, not DB)
CREATE TABLE IF NOT EXISTS public.space_members (
  id                 uuid                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id           uuid                 NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id            uuid                 REFERENCES auth.users(id) ON DELETE SET NULL,
  role               public.member_role   NOT NULL DEFAULT 'member',
  tier               public.member_tier   NOT NULL DEFAULT 'basic',
  status             public.member_status NOT NULL DEFAULT 'unverified',
  approved           boolean              NOT NULL DEFAULT true,
  display_name       text,
  handle             text,
  email              text,
  phone              text,
  bio                text,
  avatar_url         text,
  has_card_access    boolean              NOT NULL DEFAULT false,
  payment_status     text,
  payment_note       text,
  last_paid_at       timestamptz,
  joined_at          timestamptz          NOT NULL DEFAULT now(),
  dues_paid_until    timestamptz,
  stripe_customer_id text,
  created_at         timestamptz          NOT NULL DEFAULT now(),
  updated_at         timestamptz          NOT NULL DEFAULT now(),
  UNIQUE (space_id, user_id)
);

-- ── projects ─────────────────────────────────────────────────────────────────
-- Must be created before tasks (tasks.project_id FK).
CREATE TABLE IF NOT EXISTS public.projects (
  id              uuid                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id        uuid                   NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title           text                   NOT NULL,
  description     text,
  status          public.project_status  NOT NULL DEFAULT 'backlog',
  area            text,
  tags            text[],
  due_date        timestamptz,
  task_count      integer                NOT NULL DEFAULT 0,
  tasks_completed integer                NOT NULL DEFAULT 0,
  progress        integer                NOT NULL DEFAULT 0,
  created_at      timestamptz            NOT NULL DEFAULT now(),
  updated_at      timestamptz            NOT NULL DEFAULT now()
);

-- ── tasks ────────────────────────────────────────────────────────────────────
-- task_type  — the enum column (canonical)
-- status     — task lifecycle; both 'completed' and 'done' mean finished
CREATE TABLE IF NOT EXISTS public.tasks (
  id                uuid                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id          uuid                   NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title             text                   NOT NULL,
  description       text,
  task_type         public.task_type       NOT NULL DEFAULT 'task',
  status            public.task_status     NOT NULL DEFAULT 'open',
  recurrence        public.recurrence_type NOT NULL DEFAULT 'none',
  priority          text                   NOT NULL DEFAULT 'medium',
  area              text,
  project_id        uuid                   REFERENCES public.projects(id) ON DELETE SET NULL,
  tags              text[],
  due_date          timestamptz,
  claimed_by        uuid                   REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_by_name   text,
  assigned_to       uuid                   REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_name  text,
  requested_by      uuid                   REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name text,
  subtask_total     integer                NOT NULL DEFAULT 0,
  subtask_completed integer                NOT NULL DEFAULT 0,
  progress          integer                NOT NULL DEFAULT 0,
  last_done_at      timestamptz,
  completed_at      timestamptz,
  created_by        uuid                   REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz            NOT NULL DEFAULT now(),
  updated_at        timestamptz            NOT NULL DEFAULT now()
);

-- ── payments ─────────────────────────────────────────────────────────────────
-- from_identifier — email / @handle / name from source platform
-- from_note       — memo / note from sender
-- link_status     — whether this payment has been matched to a member
CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid                       PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id         uuid                       NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  platform         public.payment_platform    NOT NULL,
  amount           numeric(10,2)              NOT NULL,
  from_identifier  text,
  from_note        text,
  member_id        uuid                       REFERENCES public.space_members(id) ON DELETE SET NULL,
  member_name      text,
  link_status      public.payment_link_status NOT NULL DEFAULT 'unlinked',
  transaction_date timestamptz                NOT NULL DEFAULT now(),
  created_at       timestamptz                NOT NULL DEFAULT now()
);

-- ── contacts ─────────────────────────────────────────────────────────────────
-- code — short auto-generated identifier (e.g. "VEN234")
CREATE TABLE IF NOT EXISTS public.contacts (
  id           uuid                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     uuid                  NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name         text                  NOT NULL,
  code         text                  NOT NULL,
  contact_type public.contact_type   NOT NULL DEFAULT 'vendor',
  email        text,
  phone        text,
  details      text,
  note         text,
  group_label  text,
  tags         text[],
  created_at   timestamptz           NOT NULL DEFAULT now(),
  updated_at   timestamptz           NOT NULL DEFAULT now()
);

-- ── knowledge_base ────────────────────────────────────────────────────────────
-- is_pinned        — canonical pinned flag
-- updated_by_id    — FK to space_members (for display in UI)
-- updated_by_name  — denormalized display name for performance
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id              uuid                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id        uuid                 NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title           text                 NOT NULL,
  description     text,
  content         text,
  icon            text,
  visibility      public.kb_visibility NOT NULL DEFAULT 'all_members',
  area            text,
  tags            text[],
  is_pinned       boolean              NOT NULL DEFAULT false,
  updated_by_id   uuid                 REFERENCES public.space_members(id) ON DELETE SET NULL,
  updated_by_name text,
  created_at      timestamptz          NOT NULL DEFAULT now(),
  updated_at      timestamptz          NOT NULL DEFAULT now()
);

-- ── secrets ──────────────────────────────────────────────────────────────────
-- Shared credentials vault. Admin write, board+ read.
-- value stored as plain text — encryption is a future enhancement.
CREATE TABLE IF NOT EXISTS public.secrets (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  icon        text,
  description text,
  value       text        NOT NULL,
  area        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── area_leads ───────────────────────────────────────────────────────────────
-- area_code must be unique within a space (used as upsert conflict target).
CREATE TABLE IF NOT EXISTS public.area_leads (
  id          uuid                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid                     NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  area_name   text                     NOT NULL,
  area_code   text                     NOT NULL,
  lead_id     uuid                     REFERENCES public.space_members(id) ON DELETE SET NULL,
  lead_handle text,
  status      public.area_lead_status  NOT NULL DEFAULT 'active',
  created_at  timestamptz              NOT NULL DEFAULT now(),
  updated_at  timestamptz              NOT NULL DEFAULT now(),
  UNIQUE (space_id, area_code)
);

-- ── integrations ─────────────────────────────────────────────────────────────
-- config JSONB holds platform-specific credentials (e.g. client_id, token).
-- platform must be unique within a space (used as upsert conflict target).
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
-- name must be unique within a space.
CREATE TABLE IF NOT EXISTS public.comms_channels (
  id             uuid                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id       uuid                  NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name           text                  NOT NULL,
  icon           text,
  channel_type   public.channel_type   NOT NULL DEFAULT 'general',
  area_reference text,
  project_id     uuid                  REFERENCES public.projects(id) ON DELETE SET NULL,
  member_count   integer               NOT NULL DEFAULT 0,
  unread_count   integer               NOT NULL DEFAULT 0,
  created_at     timestamptz           NOT NULL DEFAULT now(),
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
-- Append-only audit log. No UPDATE/DELETE policies.
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
-- 4. UNIQUE CONSTRAINTS & INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- Partial unique index: (space_id, email) only where email IS NOT NULL
-- Required by importMembers upsert in actions.ts
CREATE UNIQUE INDEX IF NOT EXISTS idx_space_members_space_email
  ON public.space_members (space_id, email)
  WHERE email IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_space_members_user_id     ON public.space_members (user_id);
CREATE INDEX IF NOT EXISTS idx_space_members_space_id    ON public.space_members (space_id);
CREATE INDEX IF NOT EXISTS idx_tasks_space_id            ON public.tasks (space_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status              ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by          ON public.tasks (claimed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to         ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_projects_space_id         ON public.projects (space_id);
CREATE INDEX IF NOT EXISTS idx_payments_space_id         ON public.payments (space_id);
CREATE INDEX IF NOT EXISTS idx_payments_link_status      ON public.payments (link_status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_date ON public.payments (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_kb_space_id               ON public.knowledge_base (space_id);
CREATE INDEX IF NOT EXISTS idx_secrets_space_id          ON public.secrets (space_id);
CREATE INDEX IF NOT EXISTS idx_contacts_space_id         ON public.contacts (space_id);
CREATE INDEX IF NOT EXISTS idx_area_leads_space_id       ON public.area_leads (space_id);
CREATE INDEX IF NOT EXISTS idx_integrations_space_id     ON public.integrations (space_id);
CREATE INDEX IF NOT EXISTS idx_comms_messages_channel    ON public.comms_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_messages_space      ON public.comms_messages (space_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_space_id     ON public.activity_log (space_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at   ON public.activity_log (created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. HELPER FUNCTIONS
-- Must come AFTER tables because they reference space_members.
-- Both are SECURITY DEFINER with fixed search_path.
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns all space_ids a given user belongs to.
-- Used in RLS SELECT policies to avoid recursive policy evaluation.
CREATE OR REPLACE FUNCTION public.get_user_space_ids(uid uuid)
  RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT space_id FROM public.space_members WHERE user_id = uid;
$$;

-- Returns true if the user has one of the allowed roles in the given space.
-- Used in RLS policies that require elevated permissions.
CREATE OR REPLACE FUNCTION public.user_has_role_in_space(uid uuid, sid uuid, allowed_roles text[])
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE user_id = uid AND space_id = sid AND role::text = ANY(allowed_roles)
  );
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
-- Pattern:
--   SELECT  → any space member
--   INSERT  → any space member, or elevated role depending on sensitivity
--   UPDATE  → space member (own row) or elevated role
--   DELETE  → admin/board only
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
CREATE POLICY "spaces_select" ON public.spaces
  FOR SELECT USING (id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "spaces_insert" ON public.spaces
  FOR INSERT WITH CHECK (true);   -- auth hook creates the space; server-side admin client used

CREATE POLICY "spaces_update" ON public.spaces
  FOR UPDATE USING (public.user_has_role_in_space(auth.uid(), id, ARRAY['admin','board']));

-- ── space_members ─────────────────────────────────────────────────────────────
CREATE POLICY "members_select" ON public.space_members
  FOR SELECT USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "members_insert" ON public.space_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer'])
  );

CREATE POLICY "members_update" ON public.space_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer'])
  );

CREATE POLICY "members_delete" ON public.space_members
  FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- ── tasks ────────────────────────────────────────────────────────────────────
CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

-- ── projects ─────────────────────────────────────────────────────────────────
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

-- ── payments ─────────────────────────────────────────────────────────────────
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));

CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));

CREATE POLICY "payments_delete" ON public.payments
  FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','treasurer']));

-- ── contacts ─────────────────────────────────────────────────────────────────
CREATE POLICY "contacts_select" ON public.contacts
  FOR SELECT USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "contacts_insert" ON public.contacts
  FOR INSERT WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));

CREATE POLICY "contacts_update" ON public.contacts
  FOR UPDATE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));

CREATE POLICY "contacts_delete" ON public.contacts
  FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

-- ── knowledge_base ────────────────────────────────────────────────────────────
CREATE POLICY "kb_select" ON public.knowledge_base
  FOR SELECT USING (
    space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    AND (
      visibility = 'all_members'
      OR (visibility = 'board'      AND public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']))
      OR (visibility = 'admin_only' AND public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']))
    )
  );

CREATE POLICY "kb_insert" ON public.knowledge_base
  FOR INSERT WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));

CREATE POLICY "kb_update" ON public.knowledge_base
  FOR UPDATE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));

CREATE POLICY "kb_delete" ON public.knowledge_base
  FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

-- ── secrets ──────────────────────────────────────────────────────────────────
CREATE POLICY "secrets_select" ON public.secrets
  FOR SELECT USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

CREATE POLICY "secrets_insert" ON public.secrets
  FOR INSERT WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

CREATE POLICY "secrets_update" ON public.secrets
  FOR UPDATE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

CREATE POLICY "secrets_delete" ON public.secrets
  FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- ── area_leads ───────────────────────────────────────────────────────────────
CREATE POLICY "area_leads_select" ON public.area_leads
  FOR SELECT USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "area_leads_insert" ON public.area_leads
  FOR INSERT WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

CREATE POLICY "area_leads_update" ON public.area_leads
  FOR UPDATE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

CREATE POLICY "area_leads_delete" ON public.area_leads
  FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- ── integrations ─────────────────────────────────────────────────────────────
CREATE POLICY "integrations_select" ON public.integrations
  FOR SELECT USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));

CREATE POLICY "integrations_insert" ON public.integrations
  FOR INSERT WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

CREATE POLICY "integrations_update" ON public.integrations
  FOR UPDATE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

CREATE POLICY "integrations_delete" ON public.integrations
  FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- ── comms_channels ───────────────────────────────────────────────────────────
CREATE POLICY "channels_select" ON public.comms_channels
  FOR SELECT USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "channels_insert" ON public.comms_channels
  FOR INSERT WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

CREATE POLICY "channels_update" ON public.comms_channels
  FOR UPDATE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

CREATE POLICY "channels_delete" ON public.comms_channels
  FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- ── comms_messages ───────────────────────────────────────────────────────────
CREATE POLICY "messages_select" ON public.comms_messages
  FOR SELECT USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

CREATE POLICY "messages_insert" ON public.comms_messages
  FOR INSERT WITH CHECK (
    space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    AND user_id = auth.uid()
  );

CREATE POLICY "messages_update" ON public.comms_messages
  FOR UPDATE USING (
    user_id = auth.uid()
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
  );

CREATE POLICY "messages_delete" ON public.comms_messages
  FOR DELETE USING (
    user_id = auth.uid()
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
  );

-- ── activity_log ─────────────────────────────────────────────────────────────
CREATE POLICY "activity_select" ON public.activity_log
  FOR SELECT USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

CREATE POLICY "activity_insert" ON public.activity_log
  FOR INSERT WITH CHECK (space_id IN (SELECT public.get_user_space_ids(auth.uid())));


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TRIGGERS & AUTH HOOK
-- ─────────────────────────────────────────────────────────────────────────────

-- Create default comms channels when a new space is created.
CREATE OR REPLACE FUNCTION public.create_default_channels()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.comms_channels (space_id, name, icon, channel_type)
  VALUES
    (NEW.id, 'general',       '💬', 'general'),
    (NEW.id, 'announcements', '📢', 'general'),
    (NEW.id, 'ops',           '⚙️', 'ops');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_space_created ON public.spaces;
CREATE TRIGGER on_space_created
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.create_default_channels();

-- Auth hook: create a space_member row when a new user signs up.
-- Reads metadata fields: space_id, role, full_name / display_name.
-- NOTE: The app's signup flow calls createSpace/joinSpace server actions
-- directly after signUp() returns a session (email confirm disabled).
-- This trigger is a safety net for when email confirmation IS enabled.
CREATE OR REPLACE FUNCTION public.handle_space_signup()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_space_id    uuid;
  v_role        public.member_role;
  v_display_name text;
BEGIN
  v_space_id     := (NEW.raw_user_meta_data->>'space_id')::uuid;
  v_role         := COALESCE(
                      NULLIF((NEW.raw_user_meta_data->>'role'), '')::public.member_role,
                      'member'
                    );
  v_display_name := COALESCE(
                      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
                      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
                      NEW.email
                    );

  IF v_space_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.space_members (space_id, user_id, role, status, display_name, email, approved)
  VALUES (v_space_id, NEW.id, v_role, 'unverified', v_display_name, NEW.email, true)
  ON CONFLICT (space_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_space_signup();


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. REALTIME
-- ─────────────────────────────────────────────────────────────────────────────
-- Enable realtime for live chat.
ALTER PUBLICATION supabase_realtime ADD TABLE public.comms_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comms_channels;
