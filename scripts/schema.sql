-- =============================================================================
-- HACKERSPACE MANAGEMENT — CANONICAL SCHEMA
-- =============================================================================
-- Single file. Run top-to-bottom in Supabase SQL Editor on a fresh project.
-- Idempotent: uses IF NOT EXISTS / OR REPLACE throughout.
-- No supplemental scripts required.
--
-- Sections:
--   1. Extensions
--   2. Enums
--   3. Tables          (spaces → space_members → rest)
--   4. Indexes
--   5. Helper functions (must come after tables)
--   6. Row Level Security
--   7. Triggers & auth hook
--   8. Realtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- -----------------------------------------------------------------------------
-- 2. ENUMS
-- -----------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE public.member_role        AS ENUM ('admin','board','treasurer','member','associate');                              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.member_tier        AS ENUM ('plus','basic','associate');                                                    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.member_status      AS ENUM ('current','late','inactive','unverified');                                      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_status        AS ENUM ('open','claimed','in_progress','overdue','due_today','completed','done','blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_type          AS ENUM ('chore','task');                                                                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.recurrence_type    AS ENUM ('daily','weekly','biweekly','monthly','none');                                  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.project_status     AS ENUM ('backlog','in_progress','review','done','blocked');                             EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_platform   AS ENUM ('paypal','zeffy','venmo','cash');                                               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_link_status AS ENUM ('linked','unlinked');                                                          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.kb_visibility      AS ENUM ('all_members','board','admin_only');                                            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.area_lead_status   AS ENUM ('active','vacant','handoff');                                                   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.contact_type       AS ENUM ('vendor','supplier','partner','landlord','city');                               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.channel_type       AS ENUM ('general','area','ops','project');                                              EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- -----------------------------------------------------------------------------
-- 3. TABLES
-- -----------------------------------------------------------------------------

-- spaces ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spaces (
  id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                    text        NOT NULL,
  slug                    text        NOT NULL UNIQUE,
  description             text,
  logo_url                text,
  city                    text,
  address                 text,
  timezone                text        DEFAULT 'America/Phoenix',
  invite_code             text,
  require_approval        boolean     DEFAULT true,
  public_member_directory boolean     DEFAULT false,
  webhook_secret          text,
  settings                jsonb       DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- space_members ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.space_members (
  id                 uuid                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id           uuid                 NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id            uuid                 NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
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
  last_payment_at    timestamptz,
  last_paid_at       timestamptz,
  joined_at          timestamptz          DEFAULT now(),
  dues_paid_until    timestamptz,
  stripe_customer_id text,
  created_at         timestamptz          NOT NULL DEFAULT now(),
  updated_at         timestamptz          NOT NULL DEFAULT now(),
  UNIQUE (space_id, user_id)
);

-- Partial unique index: enforce uniqueness on email only when present
-- Required by importMembers upsert (onConflict: 'space_id,email')
CREATE UNIQUE INDEX IF NOT EXISTS idx_space_members_space_email
  ON public.space_members (space_id, email)
  WHERE email IS NOT NULL;

-- projects --------------------------------------------------------------------
-- Created before tasks because tasks.project_id references it.
CREATE TABLE IF NOT EXISTS public.projects (
  id              uuid                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id        uuid                  NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title           text                  NOT NULL,
  name            text,
  description     text,
  area            text,
  category        text,
  status          public.project_status NOT NULL DEFAULT 'backlog',
  lead_id         uuid                  REFERENCES auth.users(id) ON DELETE SET NULL,
  assignees       text,
  assignee_names  text[],
  due_date        timestamptz,
  tags            text[],
  task_count      integer               NOT NULL DEFAULT 0,
  tasks_completed integer               NOT NULL DEFAULT 0,
  progress        integer               NOT NULL DEFAULT 0,
  created_by      uuid                  REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz           NOT NULL DEFAULT now(),
  updated_at      timestamptz           NOT NULL DEFAULT now()
);

-- tasks -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id                uuid                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id          uuid                   NOT NULL REFERENCES public.spaces(id)    ON DELETE CASCADE,
  title             text                   NOT NULL,
  description       text,
  task_type         public.task_type       NOT NULL DEFAULT 'task',
  status            public.task_status     NOT NULL DEFAULT 'open',
  recurrence        public.recurrence_type DEFAULT 'none',
  priority          text                   DEFAULT 'medium',
  area              text,
  tags              text[],
  due_date          timestamptz,
  project_id        uuid                   REFERENCES public.projects(id) ON DELETE SET NULL,
  claimed_by        uuid                   REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_by_name   text,
  assigned_to       uuid                   REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_name  text,
  created_by        uuid                   REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by      uuid                   REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name text,
  subtask_total     integer                NOT NULL DEFAULT 0,
  subtask_completed integer                NOT NULL DEFAULT 0,
  progress          integer                NOT NULL DEFAULT 0,
  last_done_at      timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz            NOT NULL DEFAULT now(),
  updated_at        timestamptz            NOT NULL DEFAULT now()
);

-- payments --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid                       PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id         uuid                       NOT NULL REFERENCES public.spaces(id)       ON DELETE CASCADE,
  member_id        uuid                       REFERENCES public.space_members(id) ON DELETE SET NULL,
  platform         public.payment_platform    NOT NULL,
  amount           numeric(10,2)              NOT NULL,
  currency         text                       NOT NULL DEFAULT 'USD',
  description      text,
  -- status kept for backwards compatibility; link_status is canonical
  status           public.payment_link_status NOT NULL DEFAULT 'unlinked',
  link_status      public.payment_link_status NOT NULL DEFAULT 'unlinked',
  external_id      text,
  from_identifier  text,
  from_note        text,
  member_name      text,
  payer_name       text,
  payer_email      text,
  payment_date     timestamptz,
  transaction_date timestamptz                DEFAULT now(),
  raw_data         jsonb                      DEFAULT '{}',
  created_at       timestamptz                NOT NULL DEFAULT now(),
  updated_at       timestamptz                NOT NULL DEFAULT now()
);

-- contacts --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacts (
  id           uuid                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     uuid                 NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name         text                 NOT NULL,
  contact_type public.contact_type  NOT NULL DEFAULT 'vendor',
  code         text,
  email        text,
  phone        text,
  address      text,
  notes        text,
  details      text,
  note         text,
  group_label  text,
  tags         text[],
  created_by   uuid                 REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz          NOT NULL DEFAULT now(),
  updated_at   timestamptz          NOT NULL DEFAULT now()
);

-- knowledge_base --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id              uuid                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id        uuid                 NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title           text                 NOT NULL,
  content         text,
  category        text,
  area            text,
  icon            text,
  tags            text[],
  visibility      public.kb_visibility NOT NULL DEFAULT 'all_members',
  access_level    text                 DEFAULT 'all_members',
  -- pinned = legacy column, is_pinned = canonical
  pinned          boolean              NOT NULL DEFAULT false,
  is_pinned       boolean              NOT NULL DEFAULT false,
  created_by      uuid                 REFERENCES auth.users(id) ON DELETE SET NULL,
  -- updated_by = auth.users FK (legacy), updated_by_id = space_members FK (canonical)
  updated_by      uuid                 REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_id   uuid                 REFERENCES public.space_members(id) ON DELETE SET NULL,
  updated_by_name text,
  created_at      timestamptz          NOT NULL DEFAULT now(),
  updated_at      timestamptz          NOT NULL DEFAULT now()
);

-- secrets ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.secrets (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  -- label = legacy column, title = canonical
  label       text        NOT NULL,
  title       text,
  value       text        NOT NULL,
  description text,
  category    text        DEFAULT 'general',
  area        text,
  icon        text,
  notes       text,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- area_leads ------------------------------------------------------------------
-- area_code is the upsert conflict target (unique within a space)
CREATE TABLE IF NOT EXISTS public.area_leads (
  id          uuid                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid                    NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  area_name   text                    NOT NULL,
  area_code   text,
  description text,
  notes       text,
  lead_id     uuid                    REFERENCES public.space_members(id) ON DELETE SET NULL,
  lead_handle text,
  status      public.area_lead_status NOT NULL DEFAULT 'active',
  created_at  timestamptz             NOT NULL DEFAULT now(),
  updated_at  timestamptz             NOT NULL DEFAULT now(),
  CONSTRAINT area_leads_space_area_code_key UNIQUE (space_id, area_code) DEFERRABLE INITIALLY DEFERRED
);

-- integrations ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integrations (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  platform     text        NOT NULL,
  name         text,
  description  text,
  is_connected boolean     NOT NULL DEFAULT false,
  -- credentials/settings kept for legacy; config is canonical
  credentials  jsonb       DEFAULT '{}',
  settings     jsonb       DEFAULT '{}',
  config       jsonb,
  last_sync_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, platform)
);

-- comms_channels --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comms_channels (
  id             uuid                PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id       uuid                NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name           text                NOT NULL,
  description    text,
  channel_type   public.channel_type NOT NULL DEFAULT 'general',
  icon           text,
  area_reference text,
  is_default     boolean             NOT NULL DEFAULT false,
  is_archived    boolean             NOT NULL DEFAULT false,
  member_count   integer             NOT NULL DEFAULT 0,
  unread_count   integer             NOT NULL DEFAULT 0,
  created_by     uuid                REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz         NOT NULL DEFAULT now(),
  updated_at     timestamptz         NOT NULL DEFAULT now()
);

-- comms_messages --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comms_messages (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id   uuid        NOT NULL REFERENCES public.comms_channels(id) ON DELETE CASCADE,
  space_id     uuid        NOT NULL REFERENCES public.spaces(id)         ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id)            ON DELETE CASCADE,
  display_name text,
  handle       text,
  content      text        NOT NULL,
  edited       boolean     NOT NULL DEFAULT false,
  deleted      boolean     NOT NULL DEFAULT false,
  reply_to     uuid        REFERENCES public.comms_messages(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- activity_log ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text,
  action       text        NOT NULL,
  entity_type  text,
  entity_id    uuid,
  details      text,
  metadata     jsonb       DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- 4. INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_space_members_user_id      ON public.space_members (user_id);
CREATE INDEX IF NOT EXISTS idx_space_members_space_id     ON public.space_members (space_id);
CREATE INDEX IF NOT EXISTS idx_tasks_space_id             ON public.tasks (space_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status               ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by           ON public.tasks (claimed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to          ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id           ON public.tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_projects_space_id          ON public.projects (space_id);
CREATE INDEX IF NOT EXISTS idx_payments_space_id          ON public.payments (space_id);
CREATE INDEX IF NOT EXISTS idx_payments_member_id         ON public.payments (member_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_id       ON public.payments (external_id);
CREATE INDEX IF NOT EXISTS idx_payments_link_status       ON public.payments (link_status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_date  ON public.payments (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_space_id          ON public.contacts (space_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_space_id    ON public.knowledge_base (space_id);
CREATE INDEX IF NOT EXISTS idx_secrets_space_id           ON public.secrets (space_id);
CREATE INDEX IF NOT EXISTS idx_area_leads_space_id        ON public.area_leads (space_id);
CREATE INDEX IF NOT EXISTS idx_integrations_space_id      ON public.integrations (space_id);
CREATE INDEX IF NOT EXISTS idx_comms_channels_space_id    ON public.comms_channels (space_id);
CREATE INDEX IF NOT EXISTS idx_comms_messages_channel     ON public.comms_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_messages_space       ON public.comms_messages (space_id);
CREATE INDEX IF NOT EXISTS idx_comms_messages_user        ON public.comms_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_space_id      ON public.activity_log (space_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at    ON public.activity_log (created_at DESC);


-- -----------------------------------------------------------------------------
-- 5. HELPER FUNCTIONS
-- Must come after tables — they reference public.space_members.
-- SECURITY DEFINER with fixed search_path prevents privilege escalation.
-- -----------------------------------------------------------------------------

-- Returns all space_ids the given user belongs to.
-- Used in RLS SELECT policies to avoid recursive evaluation.
CREATE OR REPLACE FUNCTION public.get_user_space_ids(uid uuid)
  RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT space_id FROM public.space_members WHERE user_id = uid;
$$;

-- Returns true if the user holds one of the given roles in the given space.
CREATE OR REPLACE FUNCTION public.user_has_role_in_space(uid uuid, sid uuid, allowed_roles text[])
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE user_id = uid
      AND space_id = sid
      AND role::text = ANY(allowed_roles)
  );
$$;


-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
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

-- spaces
CREATE POLICY spaces_select ON public.spaces FOR SELECT
  USING (id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY spaces_insert ON public.spaces FOR INSERT
  WITH CHECK (true);
CREATE POLICY spaces_update ON public.spaces FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), id, ARRAY['admin','board']));

-- space_members
CREATE POLICY members_select ON public.space_members FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY members_insert ON public.space_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer'])
  );
CREATE POLICY members_update ON public.space_members FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer'])
  );
CREATE POLICY members_delete ON public.space_members FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- tasks
CREATE POLICY tasks_select ON public.tasks FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY tasks_insert ON public.tasks FOR INSERT
  WITH CHECK (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY tasks_update ON public.tasks FOR UPDATE
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY tasks_delete ON public.tasks FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

-- projects
CREATE POLICY projects_select ON public.projects FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY projects_insert ON public.projects FOR INSERT
  WITH CHECK (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY projects_update ON public.projects FOR UPDATE
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY projects_delete ON public.projects FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

-- payments (treasurer / board / admin only)
CREATE POLICY payments_select ON public.payments FOR SELECT
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY payments_insert ON public.payments FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY payments_update ON public.payments FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY payments_delete ON public.payments FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','treasurer']));

-- contacts
CREATE POLICY contacts_select ON public.contacts FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY contacts_insert ON public.contacts FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY contacts_update ON public.contacts FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY contacts_delete ON public.contacts FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

-- knowledge_base
CREATE POLICY kb_select ON public.knowledge_base FOR SELECT
  USING (
    space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    AND (
      visibility = 'all_members'
      OR (visibility = 'board'      AND public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']))
      OR (visibility = 'admin_only' AND public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']))
    )
  );
CREATE POLICY kb_insert ON public.knowledge_base FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY kb_update ON public.knowledge_base FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY kb_delete ON public.knowledge_base FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

-- secrets (board / admin only)
CREATE POLICY secrets_select ON public.secrets FOR SELECT
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY secrets_insert ON public.secrets FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY secrets_update ON public.secrets FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY secrets_delete ON public.secrets FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- area_leads
CREATE POLICY area_leads_select ON public.area_leads FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY area_leads_insert ON public.area_leads FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY area_leads_update ON public.area_leads FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY area_leads_delete ON public.area_leads FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- integrations (admin only)
CREATE POLICY integrations_select ON public.integrations FOR SELECT
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY integrations_insert ON public.integrations FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));
CREATE POLICY integrations_update ON public.integrations FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));
CREATE POLICY integrations_delete ON public.integrations FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- comms_channels
CREATE POLICY channels_select ON public.comms_channels FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY channels_insert ON public.comms_channels FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY channels_update ON public.comms_channels FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY channels_delete ON public.comms_channels FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

-- comms_messages
CREATE POLICY messages_select ON public.comms_messages FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY messages_insert ON public.comms_messages FOR INSERT
  WITH CHECK (
    space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    AND user_id = auth.uid()
  );
CREATE POLICY messages_update ON public.comms_messages FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
  );
CREATE POLICY messages_delete ON public.comms_messages FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
  );

-- activity_log (append-only for members, readable by admin/board)
CREATE POLICY activity_select ON public.activity_log FOR SELECT
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY activity_insert ON public.activity_log FOR INSERT
  WITH CHECK (space_id IN (SELECT public.get_user_space_ids(auth.uid())));


-- -----------------------------------------------------------------------------
-- 7. TRIGGERS & AUTH HOOK
-- -----------------------------------------------------------------------------

-- Auto-create default channels when a new space is created
CREATE OR REPLACE FUNCTION public.create_default_channels()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.comms_channels (space_id, name, description, channel_type, is_default)
  VALUES
    (NEW.id, 'general',       'General discussion',      'general', true),
    (NEW.id, 'announcements', 'Important announcements', 'general', false),
    (NEW.id, 'ops',           'Operations & logistics',  'ops',     false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_space_created ON public.spaces;
CREATE TRIGGER on_space_created
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.create_default_channels();

-- Auth signup hook
-- Called when a new user is created in auth.users.
-- Reads metadata from supabase.auth.signUp({ data: { space_id, role, display_name } })
-- and inserts the corresponding space_members row.
CREATE OR REPLACE FUNCTION public.handle_space_signup()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_space_id     uuid;
  v_role         public.member_role;
  v_display_name text;
BEGIN
  v_space_id := (NEW.raw_user_meta_data->>'space_id')::uuid;

  -- Default to 'member' if role is missing or invalid
  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role', '')::public.member_role,
    'member'
  );

  -- Prefer display_name, fall back to full_name, then email
  v_display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name',    ''),
    NEW.email
  );

  -- No space_id means this is not a hackerspace signup flow
  IF v_space_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.space_members
    (space_id, user_id, role, status, display_name, email, approved)
  VALUES
    (v_space_id, NEW.id, v_role, 'unverified', v_display_name, NEW.email, true)
  ON CONFLICT (space_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_space_signup();


-- -----------------------------------------------------------------------------
-- 8. REALTIME
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.comms_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comms_channels;
