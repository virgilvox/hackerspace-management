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
-- btree_gist: provides `uuid WITH =` for the equipment_reservations overlap
-- exclusion constraint (see section below / scripts/042).
CREATE EXTENSION IF NOT EXISTS btree_gist;


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
DO $$ BEGIN CREATE TYPE public.payment_platform   AS ENUM ('paypal','zeffy','venmo','cash','stripe');                                        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
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
  host_requires_card      boolean     NOT NULL DEFAULT true,
  webhook_secret          text,
  settings                jsonb       DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- space_members ---------------------------------------------------------------
-- user_id is NULLABLE on purpose. The application supports "offline" members
-- (added by an admin without an auth account). addMember() and importMembers()
-- both insert rows with user_id = NULL.
CREATE TABLE IF NOT EXISTS public.space_members (
  id                 uuid                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id           uuid                 NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id            uuid                 REFERENCES auth.users(id)             ON DELETE CASCADE,
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
      AND status IN ('current','late')   -- privilege-eligible only (046)
  );
$$;


-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- Drops first so re-runs do not fail with "policy already exists".
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS spaces_select        ON public.spaces;
DROP POLICY IF EXISTS spaces_insert        ON public.spaces;
DROP POLICY IF EXISTS spaces_update        ON public.spaces;
DROP POLICY IF EXISTS members_select       ON public.space_members;
DROP POLICY IF EXISTS members_insert       ON public.space_members;
DROP POLICY IF EXISTS members_update       ON public.space_members;
DROP POLICY IF EXISTS members_delete       ON public.space_members;
DROP POLICY IF EXISTS tasks_select         ON public.tasks;
DROP POLICY IF EXISTS tasks_insert         ON public.tasks;
DROP POLICY IF EXISTS tasks_update         ON public.tasks;
DROP POLICY IF EXISTS tasks_delete         ON public.tasks;
DROP POLICY IF EXISTS projects_select      ON public.projects;
DROP POLICY IF EXISTS projects_insert      ON public.projects;
DROP POLICY IF EXISTS projects_update      ON public.projects;
DROP POLICY IF EXISTS projects_delete      ON public.projects;
DROP POLICY IF EXISTS payments_select      ON public.payments;
DROP POLICY IF EXISTS payments_insert      ON public.payments;
DROP POLICY IF EXISTS payments_update      ON public.payments;
DROP POLICY IF EXISTS payments_delete      ON public.payments;
DROP POLICY IF EXISTS contacts_select      ON public.contacts;
DROP POLICY IF EXISTS contacts_insert      ON public.contacts;
DROP POLICY IF EXISTS contacts_update      ON public.contacts;
DROP POLICY IF EXISTS contacts_delete      ON public.contacts;
DROP POLICY IF EXISTS kb_select            ON public.knowledge_base;
DROP POLICY IF EXISTS kb_insert            ON public.knowledge_base;
DROP POLICY IF EXISTS kb_update            ON public.knowledge_base;
DROP POLICY IF EXISTS kb_delete            ON public.knowledge_base;
DROP POLICY IF EXISTS secrets_select       ON public.secrets;
DROP POLICY IF EXISTS secrets_insert       ON public.secrets;
DROP POLICY IF EXISTS secrets_update       ON public.secrets;
DROP POLICY IF EXISTS secrets_delete       ON public.secrets;
DROP POLICY IF EXISTS area_leads_select    ON public.area_leads;
DROP POLICY IF EXISTS area_leads_insert    ON public.area_leads;
DROP POLICY IF EXISTS area_leads_update    ON public.area_leads;
DROP POLICY IF EXISTS area_leads_delete    ON public.area_leads;
DROP POLICY IF EXISTS integrations_select  ON public.integrations;
DROP POLICY IF EXISTS integrations_insert  ON public.integrations;
DROP POLICY IF EXISTS integrations_update  ON public.integrations;
DROP POLICY IF EXISTS integrations_delete  ON public.integrations;
DROP POLICY IF EXISTS channels_select      ON public.comms_channels;
DROP POLICY IF EXISTS channels_insert      ON public.comms_channels;
DROP POLICY IF EXISTS channels_update      ON public.comms_channels;
DROP POLICY IF EXISTS channels_delete      ON public.comms_channels;
DROP POLICY IF EXISTS messages_select      ON public.comms_messages;
DROP POLICY IF EXISTS messages_insert      ON public.comms_messages;
DROP POLICY IF EXISTS messages_update      ON public.comms_messages;
DROP POLICY IF EXISTS messages_delete      ON public.comms_messages;
DROP POLICY IF EXISTS activity_select      ON public.activity_log;
DROP POLICY IF EXISTS activity_insert      ON public.activity_log;

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
  )
  WITH CHECK (
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

-- Privilege-escalation guard.
-- RLS lets a member update their own space_members row (so they can fix their
-- own display_name, handle, phone, etc.). Without this trigger, a member
-- could PATCH role = 'admin' on themselves via a direct PostgREST call.
-- The trigger fires on every UPDATE: if the user updating their own row is
-- not already an admin/board/treasurer, any change to role/tier/status/
-- approved is rejected. SECURITY DEFINER so it can read space_members
-- regardless of RLS during the check.
CREATE OR REPLACE FUNCTION public.prevent_member_self_role_change()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_is_privileged boolean;
BEGIN
  -- Service role (no auth.uid) and inserts handled elsewhere: skip.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- If the row being updated does not belong to the current user, the
  -- existing RLS already requires admin/board/treasurer. Nothing to add.
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Self-update. If the user already holds a privileged role IN THIS SPACE
  -- they may update anything (an admin editing their own row is fine).
  SELECT public.user_has_role_in_space(auth.uid(), NEW.space_id, ARRAY['admin','board','treasurer'])
    INTO v_is_privileged;

  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  -- Non-privileged self-update: protected columns must not change.
  IF NEW.role     IS DISTINCT FROM OLD.role
  OR NEW.tier     IS DISTINCT FROM OLD.tier
  OR NEW.status   IS DISTINCT FROM OLD.status
  OR NEW.approved IS DISTINCT FROM OLD.approved
  OR NEW.has_card_access IS DISTINCT FROM OLD.has_card_access
  OR NEW.space_id IS DISTINCT FROM OLD.space_id THEN
    RAISE EXCEPTION 'Members cannot change their own role, tier, status, approval, card access, or space.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_member_self_role_change ON public.space_members;
CREATE TRIGGER trg_prevent_member_self_role_change
  BEFORE UPDATE ON public.space_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_member_self_role_change();


-- -----------------------------------------------------------------------------
-- 8. REALTIME
-- Wrapped in DO blocks so re-running this file is safe: ADD TABLE errors when
-- the table is already a member of the publication.
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comms_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comms_channels;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =============================================================================
-- 9. GOVERNANCE KERNEL
-- Source of truth: scripts/016_governance_kernel.sql.
-- Tier 1 from docs/GOVERNANCE_FEATURES.md.
-- Adds proposals + proposal_votes, incidents + incident_updates, policies.
-- =============================================================================

-- 9.1 Enums ------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE public.proposal_type   AS ENUM ('bylaw_change','board_action','membership_vote','advisory_poll','recall','budget'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.proposal_status AS ENUM ('draft','open','decided','withdrawn','expired');                                    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.threshold_rule  AS ENUM ('simple_majority','two_thirds','three_fourths','unanimous');                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vote_position   AS ENUM ('yes','no','abstain','recused');                                                   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.incident_status AS ENUM ('received','under_review','decided','appealed','closed');                          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.incident_severity AS ENUM ('low','medium','high','critical');                                               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.incident_update_visibility AS ENUM ('reporter_only','all_parties','board_only');                            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.policy_status   AS ENUM ('draft','active','deprecated','superseded');                                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9.2 Spaces extensions ------------------------------------------------------
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS default_quorum_percent      integer NOT NULL DEFAULT 10;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS default_quorum_floor        integer NOT NULL DEFAULT 1;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS default_voting_window_hours integer NOT NULL DEFAULT 216;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS default_threshold           public.threshold_rule NOT NULL DEFAULT 'simple_majority';
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS incident_sla_hours          integer NOT NULL DEFAULT 72;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS mission_statement           text;

-- 9.3 Tables -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proposals (
  id                   uuid                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id             uuid                    NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  proposer_id          uuid                    REFERENCES public.space_members(id) ON DELETE SET NULL,
  proposer_name        text,
  title                text                    NOT NULL,
  body                 text                    NOT NULL DEFAULT '',
  proposal_type        public.proposal_type    NOT NULL DEFAULT 'advisory_poll',
  status               public.proposal_status  NOT NULL DEFAULT 'draft',
  quorum_required      integer                 NOT NULL DEFAULT 0,
  quorum_percent       integer                 NOT NULL DEFAULT 10,
  quorum_floor         integer                 NOT NULL DEFAULT 1,
  threshold            public.threshold_rule   NOT NULL DEFAULT 'simple_majority',
  voting_opens_at      timestamptz,
  voting_closes_at     timestamptz,
  policy_ref_id        uuid,
  parent_incident_id   uuid,
  outcome_yes          integer                 NOT NULL DEFAULT 0,
  outcome_no           integer                 NOT NULL DEFAULT 0,
  outcome_abstain      integer                 NOT NULL DEFAULT 0,
  outcome_recused      integer                 NOT NULL DEFAULT 0,
  total_voters         integer                 NOT NULL DEFAULT 0,
  quorum_met           boolean,
  passed               boolean,
  created_at           timestamptz             NOT NULL DEFAULT now(),
  updated_at           timestamptz             NOT NULL DEFAULT now(),
  decided_at           timestamptz
);

CREATE TABLE IF NOT EXISTS public.proposal_votes (
  id              uuid                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id     uuid                  NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  member_id       uuid                  NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  position        public.vote_position  NOT NULL,
  recusal_reason  text,
  comment         text,
  voted_at        timestamptz           NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, member_id),
  CONSTRAINT recused_requires_reason
    CHECK (position <> 'recused' OR (recusal_reason IS NOT NULL AND length(trim(recusal_reason)) > 0))
);

CREATE TABLE IF NOT EXISTS public.incidents (
  id                   uuid                       PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id             uuid                       NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  reporter_id          uuid                       REFERENCES public.space_members(id) ON DELETE SET NULL,
  reporter_token       text                       UNIQUE,
  is_anonymous         boolean                    NOT NULL DEFAULT false,
  subjects             uuid[]                     NOT NULL DEFAULT '{}'::uuid[],
  category             text                       NOT NULL DEFAULT 'general',
  severity             public.incident_severity   NOT NULL DEFAULT 'medium',
  title                text                       NOT NULL,
  body                 text                       NOT NULL,
  status               public.incident_status     NOT NULL DEFAULT 'received',
  disposition          text,
  decision_maker_ids   uuid[]                     NOT NULL DEFAULT '{}'::uuid[],
  appeal_proposal_id   uuid,
  sla_response_by      timestamptz,
  created_at           timestamptz                NOT NULL DEFAULT now(),
  updated_at           timestamptz                NOT NULL DEFAULT now(),
  acknowledged_at      timestamptz,
  decided_at           timestamptz,
  closed_at            timestamptz
);

CREATE TABLE IF NOT EXISTS public.incident_updates (
  id           uuid                                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id  uuid                                 NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  author_id    uuid                                 REFERENCES public.space_members(id) ON DELETE SET NULL,
  author_name  text,
  body         text                                 NOT NULL,
  visibility   public.incident_update_visibility    NOT NULL DEFAULT 'all_parties',
  created_at   timestamptz                          NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.policies (
  id                       uuid                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id                 uuid                  NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  slug                     text                  NOT NULL,
  section_ref              text,
  parent_policy_id         uuid                  REFERENCES public.policies(id) ON DELETE SET NULL,
  title                    text                  NOT NULL,
  body_formal              text                  NOT NULL DEFAULT '',
  body_plain               text,
  version                  integer               NOT NULL DEFAULT 1,
  prior_version_id         uuid                  REFERENCES public.policies(id) ON DELETE SET NULL,
  status                   public.policy_status  NOT NULL DEFAULT 'draft',
  effective_at             timestamptz,
  adopted_by_proposal_id   uuid,
  created_at               timestamptz           NOT NULL DEFAULT now(),
  updated_at               timestamptz           NOT NULL DEFAULT now(),
  UNIQUE (space_id, slug, version)
);

-- 9.4 Circular FKs -----------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.proposals ADD CONSTRAINT proposals_policy_ref_fk
    FOREIGN KEY (policy_ref_id) REFERENCES public.policies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.proposals ADD CONSTRAINT proposals_parent_incident_fk
    FOREIGN KEY (parent_incident_id) REFERENCES public.incidents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.incidents ADD CONSTRAINT incidents_appeal_proposal_fk
    FOREIGN KEY (appeal_proposal_id) REFERENCES public.proposals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.policies ADD CONSTRAINT policies_adopted_by_proposal_fk
    FOREIGN KEY (adopted_by_proposal_id) REFERENCES public.proposals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9.5 Indexes ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_proposals_space         ON public.proposals (space_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status        ON public.proposals (status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposer      ON public.proposals (proposer_id);
CREATE INDEX IF NOT EXISTS idx_proposals_closes        ON public.proposals (voting_closes_at);
CREATE INDEX IF NOT EXISTS idx_proposal_votes_proposal ON public.proposal_votes (proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_votes_member   ON public.proposal_votes (member_id);
CREATE INDEX IF NOT EXISTS idx_incidents_space         ON public.incidents (space_id);
CREATE INDEX IF NOT EXISTS idx_incidents_reporter      ON public.incidents (reporter_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status        ON public.incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_subjects      ON public.incidents USING GIN (subjects);
CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_token_unique
  ON public.incidents (reporter_token) WHERE reporter_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON public.incident_updates (incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policies_space_slug     ON public.policies (space_id, slug);
CREATE INDEX IF NOT EXISTS idx_policies_status         ON public.policies (status);

-- 9.6 Triggers ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_proposal_quorum()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_count integer;
  v_quorum_percent integer;
  v_quorum_floor integer;
  v_voting_window_hours integer;
BEGIN
  IF NEW.status = 'open' AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
    SELECT default_quorum_percent, default_quorum_floor, default_voting_window_hours
      INTO v_quorum_percent, v_quorum_floor, v_voting_window_hours
      FROM public.spaces WHERE id = NEW.space_id;
    SELECT count(*) INTO v_member_count
      FROM public.space_members
      WHERE space_id = NEW.space_id AND status IN ('current','late') AND approved = true;
    NEW.quorum_percent := COALESCE(v_quorum_percent, 10);
    NEW.quorum_floor   := COALESCE(v_quorum_floor, 1);
    NEW.quorum_required := GREATEST(NEW.quorum_floor, CEIL(v_member_count * NEW.quorum_percent / 100.0)::integer);
    IF NEW.voting_opens_at IS NULL THEN NEW.voting_opens_at := now(); END IF;
    IF NEW.voting_closes_at IS NULL THEN
      NEW.voting_closes_at := NEW.voting_opens_at + (v_voting_window_hours || ' hours')::interval;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_proposal_quorum ON public.proposals;
CREATE TRIGGER trg_compute_proposal_quorum
  BEFORE INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.compute_proposal_quorum();

CREATE OR REPLACE FUNCTION public.refresh_proposal_tally()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposal_id uuid; v_yes integer; v_no integer; v_abstain integer; v_recused integer; v_total integer;
  v_quorum_required integer; v_threshold public.threshold_rule; v_status public.proposal_status;
  v_quorum_met boolean; v_passed boolean;
BEGIN
  v_proposal_id := COALESCE(NEW.proposal_id, OLD.proposal_id);
  SELECT count(*) FILTER (WHERE position='yes'), count(*) FILTER (WHERE position='no'),
         count(*) FILTER (WHERE position='abstain'), count(*) FILTER (WHERE position='recused'), count(*)
    INTO v_yes, v_no, v_abstain, v_recused, v_total
    FROM public.proposal_votes WHERE proposal_id = v_proposal_id;
  SELECT quorum_required, threshold, status INTO v_quorum_required, v_threshold, v_status
    FROM public.proposals WHERE id = v_proposal_id;
  v_quorum_met := (v_yes + v_no + v_abstain) >= COALESCE(v_quorum_required, 0);
  v_passed := CASE
    WHEN NOT v_quorum_met THEN false
    WHEN v_yes + v_no = 0 THEN false
    WHEN v_threshold = 'simple_majority' THEN v_yes > v_no
    WHEN v_threshold = 'two_thirds'      THEN v_yes * 3 >= (v_yes + v_no) * 2
    WHEN v_threshold = 'three_fourths'   THEN v_yes * 4 >= (v_yes + v_no) * 3
    WHEN v_threshold = 'unanimous'       THEN v_no = 0 AND v_yes > 0
    ELSE false END;
  UPDATE public.proposals
    SET outcome_yes=v_yes, outcome_no=v_no, outcome_abstain=v_abstain, outcome_recused=v_recused,
        total_voters=v_total, quorum_met=v_quorum_met, passed=v_passed, updated_at=now()
    WHERE id = v_proposal_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_proposal_tally ON public.proposal_votes;
CREATE TRIGGER trg_refresh_proposal_tally
  AFTER INSERT OR UPDATE OR DELETE ON public.proposal_votes
  FOR EACH ROW EXECUTE FUNCTION public.refresh_proposal_tally();

CREATE OR REPLACE FUNCTION public.compute_incident_sla()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hours integer;
BEGIN
  IF NEW.sla_response_by IS NULL THEN
    SELECT incident_sla_hours INTO v_hours FROM public.spaces WHERE id = NEW.space_id;
    NEW.sla_response_by := COALESCE(NEW.created_at, now()) + (COALESCE(v_hours, 72) || ' hours')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_incident_sla ON public.incidents;
CREATE TRIGGER trg_compute_incident_sla
  BEFORE INSERT ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.compute_incident_sla();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_proposals_touch ON public.proposals;
CREATE TRIGGER trg_proposals_touch BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_incidents_touch ON public.incidents;
CREATE TRIGGER trg_incidents_touch BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_policies_touch ON public.policies;
CREATE TRIGGER trg_policies_touch BEFORE UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 9.7 RLS --------------------------------------------------------------------
ALTER TABLE public.proposals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proposals_select        ON public.proposals;
DROP POLICY IF EXISTS proposals_insert        ON public.proposals;
DROP POLICY IF EXISTS proposals_update        ON public.proposals;
DROP POLICY IF EXISTS proposals_delete        ON public.proposals;
DROP POLICY IF EXISTS votes_select            ON public.proposal_votes;
DROP POLICY IF EXISTS votes_insert            ON public.proposal_votes;
DROP POLICY IF EXISTS votes_update            ON public.proposal_votes;
DROP POLICY IF EXISTS incidents_select        ON public.incidents;
DROP POLICY IF EXISTS incidents_insert        ON public.incidents;
DROP POLICY IF EXISTS incidents_update        ON public.incidents;
DROP POLICY IF EXISTS incident_updates_select ON public.incident_updates;
DROP POLICY IF EXISTS incident_updates_insert ON public.incident_updates;
DROP POLICY IF EXISTS policies_select         ON public.policies;
DROP POLICY IF EXISTS policies_insert         ON public.policies;
DROP POLICY IF EXISTS policies_update         ON public.policies;

CREATE POLICY proposals_select ON public.proposals FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY proposals_insert ON public.proposals FOR INSERT
  WITH CHECK (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY proposals_update ON public.proposals FOR UPDATE
  USING (
    public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
    OR (status = 'draft' AND proposer_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid()))
  );
CREATE POLICY proposals_delete ON public.proposals FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

CREATE POLICY votes_select ON public.proposal_votes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_votes.proposal_id
                   AND p.space_id IN (SELECT public.get_user_space_ids(auth.uid()))));
CREATE POLICY votes_insert ON public.proposal_votes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.proposals p
      JOIN public.space_members m ON m.id = proposal_votes.member_id
      WHERE p.id = proposal_votes.proposal_id
        AND m.user_id = auth.uid()
        AND m.space_id = p.space_id
        AND p.status = 'open'
        AND p.voting_opens_at <= now()
        AND p.voting_closes_at > now()
    )
  );
CREATE POLICY votes_update ON public.proposal_votes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.proposals p
      JOIN public.space_members m ON m.id = proposal_votes.member_id
      WHERE p.id = proposal_votes.proposal_id
        AND m.user_id = auth.uid()
        AND m.space_id = p.space_id
        AND p.status = 'open'
        AND p.voting_closes_at > now()
    )
  );

CREATE POLICY incidents_select ON public.incidents FOR SELECT
  USING (
    public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
    OR reporter_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid())
  );
CREATE POLICY incidents_insert ON public.incidents FOR INSERT
  WITH CHECK (
    space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    AND (
      reporter_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.space_members m
        WHERE m.id = incidents.reporter_id
          AND m.user_id = auth.uid()
          AND m.space_id = incidents.space_id
      )
    )
  );
CREATE POLICY incidents_update ON public.incidents FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

CREATE POLICY incident_updates_select ON public.incident_updates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_updates.incident_id
              AND (public.user_has_role_in_space(auth.uid(), i.space_id, ARRAY['admin','board'])
                   OR (incident_updates.visibility <> 'board_only'
                       AND i.reporter_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid()))))
  );
CREATE POLICY incident_updates_insert ON public.incident_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_updates.incident_id
        AND (
          public.user_has_role_in_space(auth.uid(), i.space_id, ARRAY['admin','board'])
          OR i.reporter_id IN (
            SELECT m.id FROM public.space_members m
            WHERE m.user_id = auth.uid() AND m.space_id = i.space_id
          )
        )
    )
    AND (
      author_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.space_members m, public.incidents i
        WHERE i.id = incident_updates.incident_id
          AND m.id = incident_updates.author_id
          AND m.user_id = auth.uid()
          AND m.space_id = i.space_id
      )
    )
  );

CREATE POLICY policies_select ON public.policies FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY policies_insert ON public.policies FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY policies_update ON public.policies FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

-- 9.8 Active-policy uniqueness ------------------------------------------------
-- A race between two admins concurrently activating two different drafts of
-- the same slug could leave two `active` rows. Partial unique index forbids
-- it at the storage layer.
DROP INDEX IF EXISTS public.policies_one_active_per_slug;
CREATE UNIQUE INDEX policies_one_active_per_slug
  ON public.policies (space_id, slug)
  WHERE status = 'active';


-- =============================================================================
-- 10. MEMBER STATE + VISIBILITY (Tier 2 + Tier 3 of GOVERNANCE_FEATURES.md)
-- Source of truth: scripts/018_member_state_and_visibility.sql.
-- =============================================================================

-- 10.1 Enums
DO $$ BEGIN
  CREATE TYPE public.financial_visibility AS ENUM ('treasurer_only','board_visible','all_members_visible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.directory_visibility AS ENUM ('board_only','member_count_visible','members_visible','public_members_visible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10.2 Spaces visibility settings
ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS financial_visibility        public.financial_visibility NOT NULL DEFAULT 'board_visible';
ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS member_directory_visibility public.directory_visibility  NOT NULL DEFAULT 'members_visible';

-- 10.3 Space-members opt-in profile and COI
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS skills       text[]      NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS interests    text[]      NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS willing_to   text[]      NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS affiliations text[]      NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS coi_last_disclosed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_space_members_willing_to ON public.space_members USING GIN (willing_to);
CREATE INDEX IF NOT EXISTS idx_space_members_skills     ON public.space_members USING GIN (skills);

-- 10.4 Knowledge-base meeting minutes flag
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS is_meeting_minutes boolean     NOT NULL DEFAULT false;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS meeting_date       timestamptz;
CREATE INDEX IF NOT EXISTS idx_knowledge_base_meeting_date
  ON public.knowledge_base (meeting_date DESC)
  WHERE is_meeting_minutes = true;

-- 10.5 Card-access mid-tenure review trigger
CREATE OR REPLACE FUNCTION public.schedule_card_review()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_review_date timestamptz;
  v_old_card boolean;
BEGIN
  v_old_card := COALESCE(OLD.has_card_access, false);
  IF NEW.has_card_access = true AND (TG_OP = 'INSERT' OR v_old_card = false) THEN
    v_review_date := now() + interval '180 days';
    INSERT INTO public.tasks (
      space_id, title, description, task_type, status, area, due_date, requested_by_name
    ) VALUES (
      NEW.space_id,
      'Card-access review: ' || COALESCE(NULLIF(NEW.display_name, ''), 'member'),
      'Auto-generated 6-month review. Confirm card-access should continue. Any concerns from area leads, station champions, or hosts?',
      'task',
      'open',
      'Admin',
      v_review_date,
      'System'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_card_review ON public.space_members;
CREATE TRIGGER trg_schedule_card_review
  AFTER INSERT OR UPDATE OF has_card_access ON public.space_members
  FOR EACH ROW EXECUTE FUNCTION public.schedule_card_review();

-- 10.6 Inactive members view
CREATE OR REPLACE VIEW public.inactive_members AS
SELECT m.*,
       a.last_activity_at
FROM public.space_members m
LEFT JOIN LATERAL (
  SELECT max(created_at) AS last_activity_at
  FROM public.activity_log al
  WHERE al.user_id = m.user_id AND al.space_id = m.space_id
) a ON true
WHERE m.status IN ('current', 'late')
  AND m.approved = true
  AND (a.last_activity_at IS NULL OR a.last_activity_at < now() - interval '180 days');


-- =============================================================================
-- 11. PROPOSAL EXPIRY
-- Source: scripts/019_proposal_expiry.sql.
-- Call public.expire_proposals() on a schedule to auto-close open proposals
-- whose voting_closes_at has passed.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.expire_proposals()
  RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_decided integer;
  v_expired integer;
BEGIN
  WITH updated AS (
    UPDATE public.proposals
       SET status = 'decided', decided_at = now()
     WHERE status = 'open'
       AND voting_closes_at IS NOT NULL
       AND voting_closes_at < now()
       AND quorum_met = true
    RETURNING 1
  )
  SELECT count(*) INTO v_decided FROM updated;

  WITH updated AS (
    UPDATE public.proposals
       SET status = 'expired'
     WHERE status = 'open'
       AND voting_closes_at IS NOT NULL
       AND voting_closes_at < now()
       AND COALESCE(quorum_met, false) = false
    RETURNING 1
  )
  SELECT count(*) INTO v_expired FROM updated;

  RETURN v_decided + v_expired;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'expire-proposals-hourly';
    PERFORM cron.schedule('expire-proposals-hourly', '0 * * * *', $cron$SELECT public.expire_proposals();$cron$);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;


-- =============================================================================
-- 12. SPACE AREAS
-- Source: scripts/020_areas.sql.
-- Each space gets its own list of physical areas / shops / categories.
-- A trigger seeds ten sensible defaults when a space is created. Admin and
-- board members manage the list afterwards.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.space_areas (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  code        text        NOT NULL,
  name        text        NOT NULL,
  icon        text,
  sort_order  integer     NOT NULL DEFAULT 100,
  is_archived boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, code),
  UNIQUE (space_id, name)
);

CREATE INDEX IF NOT EXISTS idx_space_areas_space_sort
  ON public.space_areas (space_id, sort_order, name);

ALTER TABLE public.space_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS space_areas_select ON public.space_areas;
DROP POLICY IF EXISTS space_areas_insert ON public.space_areas;
DROP POLICY IF EXISTS space_areas_update ON public.space_areas;
DROP POLICY IF EXISTS space_areas_delete ON public.space_areas;

CREATE POLICY space_areas_select ON public.space_areas FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY space_areas_insert ON public.space_areas FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY space_areas_update ON public.space_areas FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY space_areas_delete ON public.space_areas FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

DROP TRIGGER IF EXISTS trg_space_areas_touch ON public.space_areas;
CREATE TRIGGER trg_space_areas_touch
  BEFORE UPDATE ON public.space_areas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.seed_default_areas()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.space_areas (space_id, code, name, sort_order) VALUES
    (NEW.id, '3d-printing', '3D Printing',  10),
    (NEW.id, 'electronics', 'Electronics',  20),
    (NEW.id, 'woodshop',    'Woodshop',     30),
    (NEW.id, 'laser',       'Laser',        40),
    (NEW.id, 'metal-shop',  'Metal Shop',   50),
    (NEW.id, 'facilities',  'Facilities',   60),
    (NEW.id, 'software',    'Software',     70),
    (NEW.id, 'kitchen',     'Kitchen',      80),
    (NEW.id, 'admin',       'Admin',        90),
    (NEW.id, 'general',     'General',     100)
  ON CONFLICT (space_id, code) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_areas ON public.spaces;
CREATE TRIGGER trg_seed_default_areas
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_areas();


-- =============================================================================
-- 13. Forum, polymorphic comments, custom tiers, custom role labels and
--     custom roles, multi-code invites, secrets encryption-at-rest, KB
--     markdown rendering flag.
--     Equivalent to scripts/021_forum_tiers_roles_invites_secrets.sql.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.comment_entity_type AS ENUM ('forum_thread','proposal','incident','policy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.forum_threads (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id        uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  author_id       uuid        REFERENCES public.space_members(id)   ON DELETE SET NULL,
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body            text,
  category        text        NOT NULL DEFAULT 'general',
  pinned          boolean     NOT NULL DEFAULT false,
  locked          boolean     NOT NULL DEFAULT false,
  comment_count   integer     NOT NULL DEFAULT 0,
  last_comment_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_forum_threads_space        ON public.forum_threads (space_id, last_comment_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_forum_threads_space_pinned ON public.forum_threads (space_id, pinned DESC, last_comment_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.comments (
  id          uuid                       PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid                       NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  entity_type public.comment_entity_type NOT NULL,
  entity_id   uuid                       NOT NULL,
  author_id   uuid                       REFERENCES public.space_members(id) ON DELETE SET NULL,
  parent_id   uuid                       REFERENCES public.comments(id) ON DELETE CASCADE,
  body        text                       NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  edited_at   timestamptz,
  created_at  timestamptz                NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON public.comments (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_space  ON public.comments (space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments (author_id);

CREATE OR REPLACE FUNCTION public.touch_thread_on_comment()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.entity_type = 'forum_thread') THEN
    UPDATE public.forum_threads SET comment_count = comment_count + 1, last_comment_at = NEW.created_at, updated_at = now() WHERE id = NEW.entity_id;
  ELSIF (TG_OP = 'DELETE' AND OLD.entity_type = 'forum_thread') THEN
    UPDATE public.forum_threads SET comment_count = GREATEST(comment_count - 1, 0), updated_at = now() WHERE id = OLD.entity_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_thread_on_comment ON public.comments;
CREATE TRIGGER trg_touch_thread_on_comment
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_thread_on_comment();

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments      ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forum_threads_select ON public.forum_threads;
DROP POLICY IF EXISTS forum_threads_insert ON public.forum_threads;
DROP POLICY IF EXISTS forum_threads_update ON public.forum_threads;
DROP POLICY IF EXISTS forum_threads_delete ON public.forum_threads;
CREATE POLICY forum_threads_select ON public.forum_threads FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY forum_threads_insert ON public.forum_threads FOR INSERT
  WITH CHECK (
    space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    AND (author_id IS NULL OR author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid() AND space_id = forum_threads.space_id))
  );
CREATE POLICY forum_threads_update ON public.forum_threads FOR UPDATE
  USING (
    (author_id IS NOT NULL AND author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid()))
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
  );
CREATE POLICY forum_threads_delete ON public.forum_threads FOR DELETE
  USING (
    (author_id IS NOT NULL AND author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid()))
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin'])
  );

DROP POLICY IF EXISTS comments_select ON public.comments;
DROP POLICY IF EXISTS comments_insert ON public.comments;
DROP POLICY IF EXISTS comments_update ON public.comments;
DROP POLICY IF EXISTS comments_delete ON public.comments;
CREATE POLICY comments_select ON public.comments FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY comments_insert ON public.comments FOR INSERT
  WITH CHECK (
    space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    AND (author_id IS NULL OR author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid() AND space_id = comments.space_id))
  );
CREATE POLICY comments_update ON public.comments FOR UPDATE
  USING (author_id IS NOT NULL AND author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid()));
CREATE POLICY comments_delete ON public.comments FOR DELETE
  USING (
    (author_id IS NOT NULL AND author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid()))
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
  );

CREATE TABLE IF NOT EXISTS public.space_tiers (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id            uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  slug                text        NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 50),
  name                text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description         text,
  monthly_price_cents integer     NOT NULL DEFAULT 0 CHECK (monthly_price_cents >= 0),
  billing_cadence     text        NOT NULL DEFAULT 'monthly' CHECK (billing_cadence IN ('monthly','quarterly','annual','one_time','custom')),
  is_system           boolean     NOT NULL DEFAULT false,
  is_archived         boolean     NOT NULL DEFAULT false,
  sort_order          integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_space_tiers_space ON public.space_tiers (space_id, sort_order, name);

ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS tier_id uuid REFERENCES public.space_tiers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_space_members_tier_id ON public.space_members (tier_id);

CREATE OR REPLACE FUNCTION public.seed_default_tiers()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.space_tiers (space_id, slug, name, description, monthly_price_cents, billing_cadence, is_system, sort_order) VALUES
    (NEW.id, 'plus',      'Plus',      'Full access including 24/7 keycard',            0, 'monthly', true, 0),
    (NEW.id, 'basic',     'Basic',     'Standard member access during open hours',      0, 'monthly', true, 1),
    (NEW.id, 'associate', 'Associate', 'Limited access for adjacent community members', 0, 'monthly', true, 2)
  ON CONFLICT (space_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_tiers ON public.spaces;
CREATE TRIGGER trg_seed_default_tiers
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_tiers();

ALTER TABLE public.space_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tiers_select ON public.space_tiers;
DROP POLICY IF EXISTS tiers_insert ON public.space_tiers;
DROP POLICY IF EXISTS tiers_update ON public.space_tiers;
DROP POLICY IF EXISTS tiers_delete ON public.space_tiers;
CREATE POLICY tiers_select ON public.space_tiers FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY tiers_insert ON public.space_tiers FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY tiers_update ON public.space_tiers FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY tiers_delete ON public.space_tiers FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']) AND NOT is_system);

CREATE TABLE IF NOT EXISTS public.space_role_labels (
  id           uuid               PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     uuid               NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  role         public.member_role NOT NULL,
  display_name text,
  description  text,
  color        text,
  sort_order   integer            NOT NULL DEFAULT 0,
  created_at   timestamptz        NOT NULL DEFAULT now(),
  updated_at   timestamptz        NOT NULL DEFAULT now(),
  UNIQUE (space_id, role)
);

CREATE TABLE IF NOT EXISTS public.space_custom_roles (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  slug        text        NOT NULL CHECK (slug ~* '^[a-z0-9][a-z0-9_-]{0,49}$'),
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description text,
  color       text,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, slug)
);

CREATE TABLE IF NOT EXISTS public.space_member_custom_roles (
  member_id      uuid        NOT NULL REFERENCES public.space_members(id)      ON DELETE CASCADE,
  custom_role_id uuid        NOT NULL REFERENCES public.space_custom_roles(id) ON DELETE CASCADE,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, custom_role_id)
);
CREATE INDEX IF NOT EXISTS idx_space_role_labels_space      ON public.space_role_labels (space_id);
CREATE INDEX IF NOT EXISTS idx_space_custom_roles_space     ON public.space_custom_roles (space_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_member_custom_roles_role     ON public.space_member_custom_roles (custom_role_id);

ALTER TABLE public.space_role_labels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_custom_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_member_custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_labels_select ON public.space_role_labels;
DROP POLICY IF EXISTS role_labels_insert ON public.space_role_labels;
DROP POLICY IF EXISTS role_labels_update ON public.space_role_labels;
DROP POLICY IF EXISTS role_labels_delete ON public.space_role_labels;
CREATE POLICY role_labels_select ON public.space_role_labels FOR SELECT USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY role_labels_insert ON public.space_role_labels FOR INSERT WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY role_labels_update ON public.space_role_labels FOR UPDATE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY role_labels_delete ON public.space_role_labels FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

DROP POLICY IF EXISTS custom_roles_select ON public.space_custom_roles;
DROP POLICY IF EXISTS custom_roles_insert ON public.space_custom_roles;
DROP POLICY IF EXISTS custom_roles_update ON public.space_custom_roles;
DROP POLICY IF EXISTS custom_roles_delete ON public.space_custom_roles;
CREATE POLICY custom_roles_select ON public.space_custom_roles FOR SELECT USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY custom_roles_insert ON public.space_custom_roles FOR INSERT WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY custom_roles_update ON public.space_custom_roles FOR UPDATE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY custom_roles_delete ON public.space_custom_roles FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

DROP POLICY IF EXISTS member_custom_roles_select ON public.space_member_custom_roles;
DROP POLICY IF EXISTS member_custom_roles_insert ON public.space_member_custom_roles;
DROP POLICY IF EXISTS member_custom_roles_delete ON public.space_member_custom_roles;
CREATE POLICY member_custom_roles_select ON public.space_member_custom_roles FOR SELECT
  USING (member_id IN (SELECT id FROM public.space_members WHERE space_id IN (SELECT public.get_user_space_ids(auth.uid()))));
CREATE POLICY member_custom_roles_insert ON public.space_member_custom_roles FOR INSERT
  WITH CHECK (member_id IN (SELECT sm.id FROM public.space_members sm WHERE public.user_has_role_in_space(auth.uid(), sm.space_id, ARRAY['admin','board'])));
CREATE POLICY member_custom_roles_delete ON public.space_member_custom_roles FOR DELETE
  USING (member_id IN (SELECT sm.id FROM public.space_members sm WHERE public.user_has_role_in_space(auth.uid(), sm.space_id, ARRAY['admin','board'])));

CREATE TABLE IF NOT EXISTS public.space_invites (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  code        text        NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 4 AND 32),
  label       text,
  expires_at  timestamptz,
  max_uses    integer CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count  integer     NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  is_enabled  boolean     NOT NULL DEFAULT true,
  role        member_role NOT NULL DEFAULT 'member',
  created_by  uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_space_invites_space ON public.space_invites (space_id, is_enabled, expires_at);
CREATE INDEX IF NOT EXISTS idx_space_invites_code  ON public.space_invites (code) WHERE is_enabled;

ALTER TABLE public.space_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invites_select ON public.space_invites;
DROP POLICY IF EXISTS invites_insert ON public.space_invites;
DROP POLICY IF EXISTS invites_update ON public.space_invites;
DROP POLICY IF EXISTS invites_delete ON public.space_invites;
CREATE POLICY invites_select ON public.space_invites FOR SELECT USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY invites_insert ON public.space_invites FOR INSERT WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY invites_update ON public.space_invites FOR UPDATE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY invites_delete ON public.space_invites FOR DELETE USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS encrypted_value    bytea;
ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS encryption_version smallint NOT NULL DEFAULT 0;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS render_markdown boolean NOT NULL DEFAULT true;

-- comms_channels: any member can create one; non-default channels can be
-- updated/deleted by the creator or admin/board.
DROP POLICY IF EXISTS channels_insert ON public.comms_channels;
CREATE POLICY channels_insert ON public.comms_channels FOR INSERT
  WITH CHECK (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
DROP POLICY IF EXISTS channels_update ON public.comms_channels;
CREATE POLICY channels_update ON public.comms_channels FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']) OR created_by = auth.uid());
DROP POLICY IF EXISTS channels_delete ON public.comms_channels;
CREATE POLICY channels_delete ON public.comms_channels FOR DELETE
  USING (NOT is_default AND (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']) OR created_by = auth.uid()));

DROP TRIGGER IF EXISTS trg_forum_threads_touch       ON public.forum_threads;
DROP TRIGGER IF EXISTS trg_space_tiers_touch          ON public.space_tiers;
DROP TRIGGER IF EXISTS trg_space_role_labels_touch    ON public.space_role_labels;
DROP TRIGGER IF EXISTS trg_space_custom_roles_touch   ON public.space_custom_roles;
DROP TRIGGER IF EXISTS trg_space_invites_touch        ON public.space_invites;
CREATE TRIGGER trg_forum_threads_touch       BEFORE UPDATE ON public.forum_threads       FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_space_tiers_touch          BEFORE UPDATE ON public.space_tiers          FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_space_role_labels_touch    BEFORE UPDATE ON public.space_role_labels    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_space_custom_roles_touch   BEFORE UPDATE ON public.space_custom_roles   FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_space_invites_touch        BEFORE UPDATE ON public.space_invites        FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =============================================================================
-- 14. Configurable member onboarding.
--     Equivalent to scripts/022_onboarding.sql.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.space_onboarding_steps (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  step_key    text        NOT NULL CHECK (char_length(step_key) BETWEEN 1 AND 60),
  step_type   text        NOT NULL CHECK (step_type IN ('welcome','code_of_conduct','profile','payment','content','form')),
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body        text,
  config      jsonb       NOT NULL DEFAULT '{}',
  is_enabled  boolean     NOT NULL DEFAULT true,
  is_required boolean     NOT NULL DEFAULT false,
  is_system   boolean     NOT NULL DEFAULT false,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, step_key)
);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_space ON public.space_onboarding_steps (space_id, sort_order);

ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS onboarding_progress jsonb NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.seed_default_onboarding_steps()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.space_onboarding_steps
    (space_id, step_key, step_type, title, body, config, is_enabled, is_required, is_system, sort_order)
  VALUES
    (NEW.id, 'welcome', 'welcome', 'Welcome to ' || NEW.name,
     E'We are glad you are here.\n\nThis short setup gets you ready to use the space. It takes about a minute.',
     '{}'::jsonb, true, false, true, 0),
    (NEW.id, 'code_of_conduct', 'code_of_conduct', 'Code of Conduct',
     E'Be excellent to each other.\n\n- Treat people and tools with respect.\n- Clean up after yourself.\n- Ask before using equipment you have not been trained on.',
     '{"require_ack": true, "ack_label": "I have read and agree to the code of conduct"}'::jsonb, true, true, true, 1),
    (NEW.id, 'profile', 'profile', 'Complete your profile',
     E'Tell the space who you are. You can change this anytime from your profile.',
     '{}'::jsonb, true, false, true, 2),
    (NEW.id, 'payment', 'payment', 'Set up your dues',
     E'Membership dues keep the space running. Set up your recurring payment now so you do not lose access.',
     '{}'::jsonb, true, false, true, 3)
  ON CONFLICT (space_id, step_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_onboarding_steps ON public.spaces;
CREATE TRIGGER trg_seed_default_onboarding_steps
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_onboarding_steps();

ALTER TABLE public.space_onboarding_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onboarding_steps_select ON public.space_onboarding_steps;
DROP POLICY IF EXISTS onboarding_steps_insert ON public.space_onboarding_steps;
DROP POLICY IF EXISTS onboarding_steps_update ON public.space_onboarding_steps;
DROP POLICY IF EXISTS onboarding_steps_delete ON public.space_onboarding_steps;
CREATE POLICY onboarding_steps_select ON public.space_onboarding_steps FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY onboarding_steps_insert ON public.space_onboarding_steps FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY onboarding_steps_update ON public.space_onboarding_steps FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY onboarding_steps_delete ON public.space_onboarding_steps FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']) AND NOT is_system);

DROP TRIGGER IF EXISTS trg_onboarding_steps_touch ON public.space_onboarding_steps;
CREATE TRIGGER trg_onboarding_steps_touch
  BEFORE UPDATE ON public.space_onboarding_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =============================================================================
-- 15. Customizable permissions, per-item Ops ACLs, area-lead effective roles.
--     Equivalent to scripts/023_permissions.sql. Additive: the new SELECT
--     branches only widen access; with no rows in the new tables behavior is
--     unchanged.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.space_role_permissions (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  subject     text        NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 50),
  permission  text        NOT NULL CHECK (char_length(permission) BETWEEN 1 AND 60),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, subject, permission)
);
CREATE INDEX IF NOT EXISTS idx_role_perms_space ON public.space_role_permissions (space_id, subject);

CREATE TABLE IF NOT EXISTS public.ops_acl (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  entity_type text        NOT NULL CHECK (entity_type IN ('secret','kb','process','area_lead')),
  entity_id   uuid        NOT NULL,
  role        text        NOT NULL CHECK (char_length(role) BETWEEN 1 AND 64),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, entity_type, entity_id, role)
);
CREATE INDEX IF NOT EXISTS idx_ops_acl_entity ON public.ops_acl (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ops_acl_space  ON public.ops_acl (space_id);

CREATE OR REPLACE FUNCTION public.user_effective_roles(uid uuid, sid uuid)
  RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sm.role::text FROM public.space_members sm
  WHERE sm.user_id = uid AND sm.space_id = sid
  UNION
  SELECT cr.slug
  FROM public.space_members sm
  JOIN public.space_member_custom_roles mcr ON mcr.member_id = sm.id
  JOIN public.space_custom_roles cr ON cr.id = mcr.custom_role_id
  WHERE sm.user_id = uid AND sm.space_id = sid
  UNION
  SELECT 'area_lead:' || al.id::text
  FROM public.space_members sm
  JOIN public.area_leads al ON al.lead_id = sm.id
  WHERE sm.user_id = uid AND sm.space_id = sid AND al.space_id = sid;
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(uid uuid, sid uuid, perm text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.space_members
           WHERE user_id = uid AND space_id = sid
             AND status IN ('current','late')   -- no permission unless privilege-eligible (046)
         )
     AND (
       public.user_has_role_in_space(uid, sid, ARRAY['admin'])
       OR EXISTS (
         SELECT 1 FROM public.space_role_permissions p
         WHERE p.space_id = sid AND p.permission = perm
           AND p.subject IN (SELECT public.user_effective_roles(uid, sid))
       )
     );
$$;

-- Inverted, set-returning form of user_has_permission: which members in this
-- space hold the named permission? Same membership-status gate (current/late,
-- mirrors 046), same admin-shortcut, same space_role_permissions +
-- user_effective_roles fallback. Used by notification fan-outs (e.g. the
-- forms.manage admin alert) where N user_has_permission calls would be N
-- round-trips. Equivalent to scripts/047_members_with_permission.sql.
CREATE OR REPLACE FUNCTION public.members_with_permission(sid uuid, perm text)
  RETURNS TABLE(member_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sm.id
  FROM public.space_members sm
  WHERE sm.space_id = sid
    AND sm.status IN ('current','late')
    AND (
      sm.role = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.space_role_permissions p
        WHERE p.space_id = sid AND p.permission = perm
          AND p.subject IN (SELECT public.user_effective_roles(sm.user_id, sid))
      )
    );
$$;

ALTER TABLE public.space_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_acl                ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_perms_select ON public.space_role_permissions;
DROP POLICY IF EXISTS role_perms_insert ON public.space_role_permissions;
DROP POLICY IF EXISTS role_perms_update ON public.space_role_permissions;
DROP POLICY IF EXISTS role_perms_delete ON public.space_role_permissions;
CREATE POLICY role_perms_select ON public.space_role_permissions FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY role_perms_insert ON public.space_role_permissions FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY role_perms_update ON public.space_role_permissions FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY role_perms_delete ON public.space_role_permissions FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

DROP POLICY IF EXISTS ops_acl_select ON public.ops_acl;
DROP POLICY IF EXISTS ops_acl_insert ON public.ops_acl;
DROP POLICY IF EXISTS ops_acl_update ON public.ops_acl;
DROP POLICY IF EXISTS ops_acl_delete ON public.ops_acl;
CREATE POLICY ops_acl_select ON public.ops_acl FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY ops_acl_insert ON public.ops_acl FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY ops_acl_update ON public.ops_acl FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY ops_acl_delete ON public.ops_acl FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

DROP POLICY IF EXISTS secrets_select ON public.secrets;
-- secrets_select also honors the ops.secrets.read role permission
-- (equivalent to scripts/031_secrets_permission_select.sql). Additive: the
-- admin/board and per-secret ops_acl branches are unchanged.
CREATE POLICY secrets_select ON public.secrets FOR SELECT
  USING (
    public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
    OR public.user_has_permission(auth.uid(), space_id, 'ops.secrets.read')
    OR EXISTS (
      SELECT 1 FROM public.ops_acl a
      WHERE a.space_id = secrets.space_id AND a.entity_type = 'secret'
        AND a.entity_id = secrets.id
        AND a.role IN (SELECT public.user_effective_roles(auth.uid(), secrets.space_id))
    )
  );

DROP POLICY IF EXISTS kb_select ON public.knowledge_base;
CREATE POLICY kb_select ON public.knowledge_base FOR SELECT
  USING (
    (
      space_id IN (SELECT public.get_user_space_ids(auth.uid()))
      AND (
        visibility = 'all_members'
        OR (visibility = 'board'      AND public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']))
        OR (visibility = 'admin_only' AND public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']))
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.ops_acl a
      WHERE a.space_id = knowledge_base.space_id AND a.entity_type IN ('kb','process')
        AND a.entity_id = knowledge_base.id
        AND a.role IN (SELECT public.user_effective_roles(auth.uid(), knowledge_base.space_id))
    )
  );

CREATE OR REPLACE FUNCTION public.seed_default_role_permissions()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.space_role_permissions (space_id, subject, permission)
  SELECT NEW.id, d.subject, d.permission
  FROM (VALUES
    ('board','ops.kb.read'),('board','ops.kb.write'),('board','ops.process.read'),
    ('board','ops.process.write'),('board','ops.secrets.read'),('board','ops.secrets.write'),
    ('board','ops.arealeads.manage'),('board','members.manage'),('board','payments.manage'),
    ('board','governance.manage'),('board','forum.moderate'),('board','forms.manage'),
    ('board','certifications.manage'),('board','certifications.grant'),
    ('board','classes.manage'),('board','classes.instruct'),
    ('board','equipment.manage'),
    ('board','door.manage'),('board','door.operate'),
    ('board','customize.manage'),('board','settings.manage'),
    ('treasurer','payments.manage'),('treasurer','ops.kb.read'),('treasurer','ops.process.read'),
    ('member','ops.kb.read'),('member','ops.process.read'),
    ('associate','ops.kb.read')
  ) AS d(subject, permission)
  ON CONFLICT (space_id, subject, permission) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_role_permissions ON public.spaces;
CREATE TRIGGER trg_seed_default_role_permissions
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_role_permissions();


-- =============================================================================
-- 16. Self-change hardening (equivalent to scripts/024 + scripts/044).
--     Columns a non-privileged member cannot change on their own
--     space_members row: role, tier(_id), status, approved, has_card_access,
--     onboarding_completed_at, space_id, and the payment/dues fields
--     (payment_status, payment_note, dues_paid_until, last_paid_at,
--     last_payment_at, stripe_customer_id, joined_at). Service-client and
--     privileged-on-another-member writes bypass (auth.uid() guards).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_member_self_role_change()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_privileged boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN RETURN NEW; END IF;
  SELECT public.user_has_role_in_space(auth.uid(), NEW.space_id, ARRAY['admin','board','treasurer'])
    INTO v_is_privileged;
  IF v_is_privileged THEN RETURN NEW; END IF;
  IF NEW.role                    IS DISTINCT FROM OLD.role
  OR NEW.tier                    IS DISTINCT FROM OLD.tier
  OR NEW.tier_id                 IS DISTINCT FROM OLD.tier_id
  OR NEW.status                  IS DISTINCT FROM OLD.status
  OR NEW.approved                IS DISTINCT FROM OLD.approved
  OR NEW.has_card_access         IS DISTINCT FROM OLD.has_card_access
  OR NEW.onboarding_completed_at IS DISTINCT FROM OLD.onboarding_completed_at
  OR NEW.space_id                IS DISTINCT FROM OLD.space_id
  OR NEW.payment_status          IS DISTINCT FROM OLD.payment_status
  OR NEW.payment_note            IS DISTINCT FROM OLD.payment_note
  OR NEW.dues_paid_until         IS DISTINCT FROM OLD.dues_paid_until
  OR NEW.last_paid_at            IS DISTINCT FROM OLD.last_paid_at
  OR NEW.last_payment_at         IS DISTINCT FROM OLD.last_payment_at
  OR NEW.stripe_customer_id      IS DISTINCT FROM OLD.stripe_customer_id
  OR NEW.joined_at               IS DISTINCT FROM OLD.joined_at THEN
    RAISE EXCEPTION 'Members cannot change their own role, tier, status, approval, card access, onboarding completion, space, or payment/dues fields.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_member_self_role_change ON public.space_members;
CREATE TRIGGER trg_prevent_member_self_role_change
  BEFORE UPDATE ON public.space_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_member_self_role_change();


-- =============================================================================
-- 17. Custom forms and waivers (schema + RLS).
--     Equivalent to scripts/026_forms.sql. The forms.manage seed for board is
--     already in seed_default_role_permissions() in Section 15; the backfill
--     below is a no-op on a clean database (no spaces yet) and idempotent on an
--     existing one.
--
--     RLS is additive and default-deny:
--       * forms SELECT = forms.manage holders see all forms in the space;
--         ordinary members see only published ones. The public unauthenticated
--         /f/[slug] page is served by a service-client server action, so the
--         anon role gets no grant on this table.
--       * forms write = user_has_permission(..., 'forms.manage').
--       * form_submissions SELECT = user_has_permission(..., 'forms.manage');
--         anon can never read submissions.
--       * form_submissions has NO write policy: with RLS on, that denies every
--         non-service client, funnelling all writes through the validated
--         service-client server action and making submissions immutable.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.forms (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  slug        text        NOT NULL
                          CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
                                 AND char_length(slug) BETWEEN 1 AND 80),
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text,
  kind        text        NOT NULL DEFAULT 'form'
                          CHECK (kind IN ('form','waiver')),
  visibility  text        NOT NULL DEFAULT 'members'
                          CHECK (visibility IN ('public_anon','public_auth','members')),
  status      text        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','published','closed')),
  schema      jsonb       NOT NULL DEFAULT '[]',
  legal_text  text,
  version     integer     NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by  uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forms_space_slug_key UNIQUE (space_id, slug)
);
-- The UNIQUE(space_id, slug) constraint above also serves slug lookups
-- scoped to a space (the /f/[space]/[slug] public route).
CREATE INDEX IF NOT EXISTS idx_forms_space  ON public.forms (space_id, status);

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id            uuid        NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  space_id           uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id          uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  submitter_email    text,
  answers            jsonb       NOT NULL DEFAULT '{}',
  form_snapshot      jsonb       NOT NULL,
  legal_text_snapshot text,
  form_version       integer     NOT NULL,
  ip                 inet,
  user_agent         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form  ON public.form_submissions (form_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_space ON public.form_submissions (space_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_email ON public.form_submissions (submitter_email) WHERE submitter_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_submissions_member ON public.form_submissions (member_id) WHERE member_id IS NOT NULL;

ALTER TABLE public.forms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forms_select ON public.forms;
DROP POLICY IF EXISTS forms_insert ON public.forms;
DROP POLICY IF EXISTS forms_update ON public.forms;
DROP POLICY IF EXISTS forms_delete ON public.forms;
CREATE POLICY forms_select ON public.forms FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'forms.manage')
    OR (
      space_id IN (SELECT public.get_user_space_ids(auth.uid()))
      AND status = 'published'
    )
  );
CREATE POLICY forms_insert ON public.forms FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'forms.manage'));
CREATE POLICY forms_update ON public.forms FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'forms.manage'));
CREATE POLICY forms_delete ON public.forms FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'forms.manage'));

DROP POLICY IF EXISTS form_submissions_select ON public.form_submissions;
CREATE POLICY form_submissions_select ON public.form_submissions FOR SELECT
  USING (public.user_has_permission(auth.uid(), space_id, 'forms.manage'));

DROP TRIGGER IF EXISTS trg_forms_touch ON public.forms;
CREATE TRIGGER trg_forms_touch
  BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'forms.manage' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;


-- =============================================================================
-- 18. Certifications + Instructor capability
--     (equivalent to scripts/030_certifications.sql).
--
--     certification *types* per space (optional validity_months); per-member
--     grants whose expires_at is snapshotted at grant time; soft revoke only.
--     Permissions: certifications.manage (cert types) and certifications.grant
--     (award/revoke = the Instructor capability, assignable to any role via
--     the additive space_role_permissions model). RLS is additive/default-deny:
--     members read cert types and their own grants; managers/granters read all;
--     member_certifications has no DELETE policy so the history is immutable.
--     There is no anonymous path. seed_default_role_permissions() above already
--     seeds both codes to board; the backfill below covers existing spaces.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.certifications (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id        uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name            text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description     text,
  validity_months integer     CHECK (validity_months IS NULL OR validity_months > 0),
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_certifications_space_name
  ON public.certifications (space_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_certifications_space
  ON public.certifications (space_id, is_active);

CREATE TABLE IF NOT EXISTS public.member_certifications (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id         uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id        uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  certification_id uuid        NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
  granted_by       uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  granted_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,
  revoked_at       timestamptz,
  revoked_by       uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  revoked_reason   text,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_certifications_active
  ON public.member_certifications (member_id, certification_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_member_certifications_space
  ON public.member_certifications (space_id);
CREATE INDEX IF NOT EXISTS idx_member_certifications_member
  ON public.member_certifications (member_id);
CREATE INDEX IF NOT EXISTS idx_member_certifications_cert
  ON public.member_certifications (certification_id);

ALTER TABLE public.certifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS certifications_select ON public.certifications;
DROP POLICY IF EXISTS certifications_insert ON public.certifications;
DROP POLICY IF EXISTS certifications_update ON public.certifications;
DROP POLICY IF EXISTS certifications_delete ON public.certifications;
CREATE POLICY certifications_select ON public.certifications FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY certifications_insert ON public.certifications FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'certifications.manage'));
CREATE POLICY certifications_update ON public.certifications FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'certifications.manage'));
CREATE POLICY certifications_delete ON public.certifications FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'certifications.manage'));

DROP POLICY IF EXISTS member_certifications_select ON public.member_certifications;
DROP POLICY IF EXISTS member_certifications_insert ON public.member_certifications;
DROP POLICY IF EXISTS member_certifications_update ON public.member_certifications;
CREATE POLICY member_certifications_select ON public.member_certifications FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'certifications.manage')
    OR public.user_has_permission(auth.uid(), space_id, 'certifications.grant')
    OR member_id IN (
      SELECT id FROM public.space_members
      WHERE user_id = auth.uid() AND space_id = member_certifications.space_id
    )
  );
CREATE POLICY member_certifications_insert ON public.member_certifications FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'certifications.grant'));
CREATE POLICY member_certifications_update ON public.member_certifications FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'certifications.grant'));
-- No DELETE policy: grant/revoke history is immutable to non-service clients.

DROP TRIGGER IF EXISTS trg_certifications_touch ON public.certifications;
CREATE TRIGGER trg_certifications_touch
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'certifications.manage' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;
INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'certifications.grant' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;


-- =============================================================================
-- 19. Classes (offerings, scheduled sessions, member signups)
--     (equivalent to scripts/032_classes.sql).
--
--     classes (offering; optional payment_link, capacity, is_active archive,
--     grants_certification_id -> certifications), class_sessions (scheduled
--     occurrence; space_id denormalized), class_signups (member signup;
--     space_id denormalized; partial unique = one non-cancelled signup per
--     member per session). Permissions classes.manage / classes.instruct
--     (group Classes). RLS additive/default-deny: classes SELECT = manager
--     (all) or member (is_active); class_sessions SELECT = any space member;
--     class_signups SELECT = manage/instruct (all) or member (own), UPDATE =
--     classes.instruct, NO INSERT/DELETE policy (signup/cancel funnels
--     through a validated service-client action). No anonymous path.
--     seed_default_role_permissions() above already seeds both codes; the
--     backfill below covers existing spaces.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.classes (
  id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id                uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title                   text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description             text,
  payment_link            text        CHECK (payment_link IS NULL OR payment_link ~ '^https?://'),
  capacity                integer     CHECK (capacity IS NULL OR capacity > 0),
  is_active               boolean     NOT NULL DEFAULT true,
  grants_certification_id uuid        REFERENCES public.certifications(id) ON DELETE SET NULL,
  required_form_id        uuid        REFERENCES public.forms(id) ON DELETE SET NULL,
  created_by              uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_classes_space ON public.classes (space_id, is_active);

CREATE TABLE IF NOT EXISTS public.class_sessions (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id   uuid        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  space_id   uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz CHECK (ends_at IS NULL OR ends_at >= starts_at),
  location   text,
  capacity   integer     CHECK (capacity IS NULL OR capacity > 0),
  status     text        NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','cancelled','completed')),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_sessions_space ON public.class_sessions (space_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class ON public.class_sessions (class_id);

CREATE TABLE IF NOT EXISTS public.class_signups (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   uuid        NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  space_id     uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id    uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'registered'
                           CHECK (status IN ('registered','waitlisted','cancelled')),
  attended     boolean     NOT NULL DEFAULT false,
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_signups_active
  ON public.class_signups (session_id, member_id)
  WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_class_signups_space   ON public.class_signups (space_id);
CREATE INDEX IF NOT EXISTS idx_class_signups_session ON public.class_signups (session_id);
CREATE INDEX IF NOT EXISTS idx_class_signups_member  ON public.class_signups (member_id);

ALTER TABLE public.classes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_signups  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classes_select ON public.classes;
DROP POLICY IF EXISTS classes_insert ON public.classes;
DROP POLICY IF EXISTS classes_update ON public.classes;
DROP POLICY IF EXISTS classes_delete ON public.classes;
CREATE POLICY classes_select ON public.classes FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'classes.manage')
    OR (
      space_id IN (SELECT public.get_user_space_ids(auth.uid()))
      AND is_active
    )
  );
CREATE POLICY classes_insert ON public.classes FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));
CREATE POLICY classes_update ON public.classes FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));
CREATE POLICY classes_delete ON public.classes FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));

DROP POLICY IF EXISTS class_sessions_select ON public.class_sessions;
DROP POLICY IF EXISTS class_sessions_insert ON public.class_sessions;
DROP POLICY IF EXISTS class_sessions_update ON public.class_sessions;
DROP POLICY IF EXISTS class_sessions_delete ON public.class_sessions;
CREATE POLICY class_sessions_select ON public.class_sessions FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY class_sessions_insert ON public.class_sessions FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));
CREATE POLICY class_sessions_update ON public.class_sessions FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));
CREATE POLICY class_sessions_delete ON public.class_sessions FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));

DROP POLICY IF EXISTS class_signups_select ON public.class_signups;
DROP POLICY IF EXISTS class_signups_update ON public.class_signups;
CREATE POLICY class_signups_select ON public.class_signups FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'classes.manage')
    OR public.user_has_permission(auth.uid(), space_id, 'classes.instruct')
    OR member_id IN (
      SELECT id FROM public.space_members
      WHERE user_id = auth.uid() AND space_id = class_signups.space_id
    )
  );
CREATE POLICY class_signups_update ON public.class_signups FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'classes.instruct'));
-- No INSERT/DELETE policy: signup/cancel via a validated service-client action.

DROP TRIGGER IF EXISTS trg_classes_touch ON public.classes;
CREATE TRIGGER trg_classes_touch
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_class_sessions_touch ON public.class_sessions;
CREATE TRIGGER trg_class_sessions_touch
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'classes.manage' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;
INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'classes.instruct' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;

-- Atomic signup/cancel (equivalent to scripts/045). Per-session advisory
-- xact lock serializes the capacity decision + write so concurrent signups
-- can't over-enroll and concurrent cancels can't double-promote. Mirrors the
-- pure lib/classes-logic rule; this SQL is the runtime authority.
CREATE OR REPLACE FUNCTION public.class_signup_tx(
  p_session_id uuid, p_space_id uuid, p_member_id uuid
) RETURNS TABLE(signup_id uuid, signup_status text, err text)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cap int; v_reg int; v_status text; v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text));
  IF EXISTS (
    SELECT 1 FROM class_signups
    WHERE session_id = p_session_id AND member_id = p_member_id
      AND space_id = p_space_id AND status <> 'cancelled'
  ) THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 'already'::text; RETURN;
  END IF;
  SELECT COALESCE(s.capacity, c.capacity) INTO v_cap
  FROM class_sessions s JOIN classes c ON c.id = s.class_id
  WHERE s.id = p_session_id AND s.space_id = p_space_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 'no_session'::text; RETURN;
  END IF;
  SELECT count(*) INTO v_reg FROM class_signups
  WHERE session_id = p_session_id AND status = 'registered';
  v_status := CASE WHEN v_cap IS NULL OR v_reg < v_cap
                   THEN 'registered' ELSE 'waitlisted' END;
  INSERT INTO class_signups (session_id, space_id, member_id, status)
  VALUES (p_session_id, p_space_id, p_member_id, v_status)
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, v_status, NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.class_cancel_tx(
  p_session_id uuid, p_space_id uuid, p_member_id uuid
) RETURNS TABLE(cancelled_id uuid, promoted_id uuid, err text)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sid uuid; v_status text; v_cap int; v_reg int; v_prom uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text));
  SELECT id, status INTO v_sid, v_status FROM class_signups
  WHERE session_id = p_session_id AND member_id = p_member_id
    AND space_id = p_space_id AND status <> 'cancelled'
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, 'not_signed_up'::text; RETURN;
  END IF;
  UPDATE class_signups SET status = 'cancelled' WHERE id = v_sid;
  v_prom := NULL;
  IF v_status = 'registered' THEN
    SELECT COALESCE(s.capacity, c.capacity) INTO v_cap
    FROM class_sessions s JOIN classes c ON c.id = s.class_id
    WHERE s.id = p_session_id AND s.space_id = p_space_id;
    SELECT count(*) INTO v_reg FROM class_signups
    WHERE session_id = p_session_id AND status = 'registered';
    IF v_cap IS NULL OR v_reg < v_cap THEN
      SELECT id INTO v_prom FROM class_signups
      WHERE session_id = p_session_id AND space_id = p_space_id
        AND status = 'waitlisted'
      ORDER BY signed_up_at ASC LIMIT 1;
      IF v_prom IS NOT NULL THEN
        UPDATE class_signups SET status = 'registered' WHERE id = v_prom;
      END IF;
    END IF;
  END IF;
  RETURN QUERY SELECT v_sid, v_prom, NULL::text;
END;
$$;


-- =============================================================================
-- 20. Equipment registry + reservations
--     (equivalent to scripts/033_equipment.sql).
--
--     equipment (registry; status available/maintenance/retired; optional
--     required_certification_id -> certifications; is_active archive),
--     equipment_reservations (member time-window reservation; space_id
--     denormalized; no DB overlap constraint -- enforced in the validated
--     action). Permission equipment.manage (group Equipment). RLS additive/
--     default-deny: equipment SELECT = manager (all) or member (is_active);
--     equipment_reservations SELECT = manager (all) or member (own), UPDATE =
--     equipment.manage, NO INSERT/DELETE policy (reserve/cancel via a
--     validated service-client action enforcing status + no-overlap +
--     required-cert). No anonymous path. seed_default_role_permissions()
--     above already seeds the code; the backfill below covers existing spaces.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.equipment (
  id                       uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id                 uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name                     text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description              text,
  location                 text,
  status                   text        NOT NULL DEFAULT 'available'
                                       CHECK (status IN ('available','maintenance','retired')),
  required_certification_id uuid       REFERENCES public.certifications(id) ON DELETE SET NULL,
  asset_tag                text,
  is_active                boolean     NOT NULL DEFAULT true,
  created_by               uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipment_space ON public.equipment (space_id, is_active);

CREATE TABLE IF NOT EXISTS public.equipment_reservations (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid        NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  space_id     uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id    uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL CHECK (ends_at > starts_at),
  status       text        NOT NULL DEFAULT 'reserved'
                           CHECK (status IN ('reserved','cancelled','completed')),
  notes        text,
  created_by   uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipment_res_space     ON public.equipment_reservations (space_id);
CREATE INDEX IF NOT EXISTS idx_equipment_res_equipment ON public.equipment_reservations (equipment_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_equipment_res_member    ON public.equipment_reservations (member_id);

-- DB-enforced no-overlap (equivalent to scripts/042). Only 'reserved' rows
-- conflict; the app-side check stays as a fast pre-check, the DB is the
-- arbiter under concurrency. Idempotent: DROP then ADD.
ALTER TABLE public.equipment_reservations
  DROP CONSTRAINT IF EXISTS equipment_reservations_no_overlap;
ALTER TABLE public.equipment_reservations
  ADD CONSTRAINT equipment_reservations_no_overlap
  EXCLUDE USING gist (
    equipment_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status = 'reserved');

ALTER TABLE public.equipment              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_select ON public.equipment;
DROP POLICY IF EXISTS equipment_insert ON public.equipment;
DROP POLICY IF EXISTS equipment_update ON public.equipment;
DROP POLICY IF EXISTS equipment_delete ON public.equipment;
CREATE POLICY equipment_select ON public.equipment FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'equipment.manage')
    OR (
      space_id IN (SELECT public.get_user_space_ids(auth.uid()))
      AND is_active
    )
  );
CREATE POLICY equipment_insert ON public.equipment FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'equipment.manage'));
CREATE POLICY equipment_update ON public.equipment FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'equipment.manage'));
CREATE POLICY equipment_delete ON public.equipment FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'equipment.manage'));

DROP POLICY IF EXISTS equipment_reservations_select ON public.equipment_reservations;
DROP POLICY IF EXISTS equipment_reservations_update ON public.equipment_reservations;
CREATE POLICY equipment_reservations_select ON public.equipment_reservations FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'equipment.manage')
    OR member_id IN (
      SELECT id FROM public.space_members
      WHERE user_id = auth.uid() AND space_id = equipment_reservations.space_id
    )
  );
CREATE POLICY equipment_reservations_update ON public.equipment_reservations FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'equipment.manage'));
-- No INSERT/DELETE policy: reserve/cancel via a validated service-client action.

DROP TRIGGER IF EXISTS trg_equipment_touch ON public.equipment;
CREATE TRIGGER trg_equipment_touch
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'equipment.manage' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;


-- =============================================================================
-- 21. Member access cards + door permissions (Door epic, phase 1)
--     (equivalent to scripts/034_member_cards.sql).
--
--     member_cards (card UID is a credential; door.manage-only RLS, no
--     member SELECT policy -- the masked self-view is a server action).
--     Permissions door.manage / door.operate (group Access) introduced for
--     the whole Door epic, seeded to board (above) + backfilled below.
--     No controller calls in this phase. No anonymous path.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.member_cards (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id   uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id  uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  card_uid   text        NOT NULL CHECK (char_length(card_uid) BETWEEN 1 AND 200),
  card_type  text        NOT NULL DEFAULT 'rfid' CHECK (card_type IN ('rfid','nfc')),
  label      text,
  is_active  boolean     NOT NULL DEFAULT true,
  created_by uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_cards_uid    ON public.member_cards (space_id, card_uid);
CREATE INDEX IF NOT EXISTS        idx_member_cards_space  ON public.member_cards (space_id);
CREATE INDEX IF NOT EXISTS        idx_member_cards_member ON public.member_cards (member_id);

ALTER TABLE public.member_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_cards_select ON public.member_cards;
DROP POLICY IF EXISTS member_cards_insert ON public.member_cards;
DROP POLICY IF EXISTS member_cards_update ON public.member_cards;
DROP POLICY IF EXISTS member_cards_delete ON public.member_cards;
CREATE POLICY member_cards_select ON public.member_cards FOR SELECT
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY member_cards_insert ON public.member_cards FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY member_cards_update ON public.member_cards FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY member_cards_delete ON public.member_cards FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));

DROP TRIGGER IF EXISTS trg_member_cards_touch ON public.member_cards;
CREATE TRIGGER trg_member_cards_touch
  BEFORE UPDATE ON public.member_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'door.manage' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;
INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'door.operate' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;


-- =============================================================================
-- 22. Door connections + access log (Door epic, phase 2)
--     (equivalent to scripts/035_door_connections.sql).
--
--     door_connections: per-space controller integration. The shared door
--     password is NOT here -- secret_ref -> AES-256-GCM `secrets` vault,
--     decrypted server-side only. pinned_host is the SSRF pin (executor only
--     ever calls that exact host, no redirects, size/time caps). adapter
--     native_heatsync|generic_http; allow_member_self_entry opt-in (phase 3).
--     door_access_log: append-only, secrets redacted, service-client-only
--     writes (no client write policy; immutable audit). RLS additive/
--     default-deny: door_connections CRUD = door.manage; door_access_log
--     SELECT = door.manage OR door.operate. No anonymous path. No new
--     permission codes (door.manage/door.operate from migration 034).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.door_connections (
  id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id                uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name                    text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  adapter                 text        NOT NULL DEFAULT 'generic_http'
                                      CHECK (adapter IN ('native_heatsync','generic_http')),
  base_url                text        NOT NULL CHECK (base_url ~ '^https?://'),
  pinned_host             text        NOT NULL CHECK (char_length(pinned_host) BETWEEN 1 AND 255),
  auth_mode               text        NOT NULL DEFAULT 'none'
                                      CHECK (auth_mode IN ('none','query','header','bearer')),
  auth_param              text,
  secret_ref              uuid        REFERENCES public.secrets(id) ON DELETE SET NULL,
  verbs                   jsonb       NOT NULL DEFAULT '{}',
  allow_member_self_entry boolean     NOT NULL DEFAULT false,
  is_enabled              boolean     NOT NULL DEFAULT true,
  created_by              uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_door_connections_space ON public.door_connections (space_id);

CREATE TABLE IF NOT EXISTS public.door_access_log (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id         uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  connection_id    uuid        REFERENCES public.door_connections(id) ON DELETE SET NULL,
  actor_member_id  uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  target_member_id uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  action           text        NOT NULL,
  success          boolean     NOT NULL DEFAULT false,
  detail           text,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_door_access_log_space ON public.door_access_log (space_id, occurred_at DESC);

ALTER TABLE public.door_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.door_access_log  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS door_connections_select ON public.door_connections;
DROP POLICY IF EXISTS door_connections_insert ON public.door_connections;
DROP POLICY IF EXISTS door_connections_update ON public.door_connections;
DROP POLICY IF EXISTS door_connections_delete ON public.door_connections;
CREATE POLICY door_connections_select ON public.door_connections FOR SELECT
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY door_connections_insert ON public.door_connections FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY door_connections_update ON public.door_connections FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY door_connections_delete ON public.door_connections FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));

DROP POLICY IF EXISTS door_access_log_select ON public.door_access_log;
CREATE POLICY door_access_log_select ON public.door_access_log FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'door.manage')
    OR public.user_has_permission(auth.uid(), space_id, 'door.operate')
  );

DROP TRIGGER IF EXISTS trg_door_connections_touch ON public.door_connections;
CREATE TRIGGER trg_door_connections_touch
  BEFORE UPDATE ON public.door_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =============================================================================
-- 23. Door card slot allocation (Door epic, phase 3)
--     (equivalent to scripts/036_door_card_slots.sql).
--
--     A controller may key cards by integer slot (HeatSync/23b: 0-200). The
--     slot space is PER CONNECTION; door_card_slots is the allocation map.
--     UNIQUE (connection_id, slot) lets the DB arbitrate concurrent grants;
--     UNIQUE (connection_id, card_id) makes re-granting idempotent. The
--     lowest-free-slot policy + range bounds live in pure unit-tested logic
--     (lib/door-slots-logic.ts), not SQL, so it stays adapter-generic. RLS
--     additive/default-deny: SELECT = door.manage OR door.operate; NO client
--     write policy (validated service-client executor only, in lockstep with
--     the controller). No new permission codes. No anonymous path.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.door_card_slots (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id      uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  connection_id uuid        NOT NULL REFERENCES public.door_connections(id) ON DELETE CASCADE,
  card_id       uuid        NOT NULL REFERENCES public.member_cards(id) ON DELETE CASCADE,
  slot          integer     NOT NULL CHECK (slot >= 0),
  created_by    uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_door_card_slots_slot ON public.door_card_slots (connection_id, slot);
CREATE UNIQUE INDEX IF NOT EXISTS idx_door_card_slots_card ON public.door_card_slots (connection_id, card_id);
CREATE INDEX IF NOT EXISTS        idx_door_card_slots_space ON public.door_card_slots (space_id);

ALTER TABLE public.door_card_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS door_card_slots_select ON public.door_card_slots;
CREATE POLICY door_card_slots_select ON public.door_card_slots FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'door.manage')
    OR public.user_has_permission(auth.uid(), space_id, 'door.operate')
  );

DROP TRIGGER IF EXISTS trg_door_card_slots_touch ON public.door_card_slots;
CREATE TRIGGER trg_door_card_slots_touch
  BEFORE UPDATE ON public.door_card_slots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =============================================================================
-- 24. Presence & attendance (check-in / check-out / hosting)
--     (equivalent to scripts/038_presence_attendance.sql).
--
--     space_visits: one row per visit; open (checked_out_at IS NULL) = present.
--     Partial UNIQUE (space_id, member_id) WHERE checked_out_at IS NULL keeps
--     at most one open visit per member (the action auto-closes a stale one
--     before a new check-in). SELECT = any space member (presence is social);
--     NO client write policy (validated service-client actions only, self-
--     resolved, immutable history). No new permission code; the org-wide
--     attendance view is visible to any space member by product decision.
--     spaces.host_requires_card (mirrored above) gates host check-in; enforced
--     in the app.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.space_visits (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id       uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id      uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  checked_in_at  timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  is_host        boolean     NOT NULL DEFAULT false,
  check_in_note  text        CHECK (check_in_note IS NULL OR char_length(check_in_note) <= 500),
  check_out_note text        CHECK (check_out_note IS NULL OR char_length(check_out_note) <= 500),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_space_visits_open
  ON public.space_visits (space_id, member_id) WHERE checked_out_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_space_visits_present
  ON public.space_visits (space_id) WHERE checked_out_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_space_visits_member
  ON public.space_visits (space_id, member_id, checked_in_at DESC);

ALTER TABLE public.space_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS space_visits_select ON public.space_visits;
CREATE POLICY space_visits_select ON public.space_visits FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));


-- =============================================================================
-- 25. Stripe recurring dues (Phase 1)
--     (equivalent to scripts/040_stripe_billing.sql; payment_platform 'stripe'
--     is added to the CREATE TYPE list near the top of this file).
--
--     Per-space OWN Stripe keys (NOT Connect): secret key + webhook signing
--     secret in the AES-256-GCM secrets vault; publishable key, mode,
--     tier->price map, secret refs in integrations.config. member_billing =
--     one row per member with a Stripe customer/subscription; the webhook
--     (service client) is the only writer, SELECT = admin/board/treasurer
--     (mirrors payments). stripe_webhook_events = idempotency ledger keyed by
--     Stripe's stable event id; service-client only, no client policy.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.member_billing (
  id                     uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id               uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id              uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  stripe_customer_id     text,
  stripe_subscription_id text,
  subscription_status    text,
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_billing_member   ON public.member_billing (space_id, member_id);
CREATE INDEX IF NOT EXISTS        idx_member_billing_customer ON public.member_billing (stripe_customer_id);
CREATE INDEX IF NOT EXISTS        idx_member_billing_space    ON public.member_billing (space_id);

ALTER TABLE public.member_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_billing_select ON public.member_billing;
CREATE POLICY member_billing_select ON public.member_billing FOR SELECT
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id    text        PRIMARY KEY,
  space_id    uuid        REFERENCES public.spaces(id) ON DELETE CASCADE,
  type        text,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_member_billing_touch ON public.member_billing;
CREATE TRIGGER trg_member_billing_touch
  BEFORE UPDATE ON public.member_billing
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- 26. Transactional notifications outbox (Product spine Phase 2)
--     (equivalent to scripts/041_notifications.sql.)
--
--     Dues-lifecycle emails are enqueued by the Stripe webhook and sent by a
--     separate dispatcher cron. The webhook only writes an idempotent outbox
--     row (never sends inline), so the money path stays fast and retry-safe;
--     a duplicate enqueue is a no-op via the (space_id, dedupe_key) unique
--     index. Service client (webhook enqueue + dispatcher) is the only
--     writer; SELECT = admin/board/treasurer (mirrors member_billing). Member
--     self-view is a validated service-client action, not an RLS path.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id   uuid        REFERENCES public.space_members(id) ON DELETE CASCADE,
  type        text        NOT NULL,
  channel     text        NOT NULL DEFAULT 'email',
  recipient   text        NOT NULL,
  subject     text        NOT NULL,
  body_html   text        NOT NULL,
  body_text   text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending',
  attempts    integer     NOT NULL DEFAULT 0,
  last_error  text,
  dedupe_key  text        NOT NULL,
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe  ON public.notifications (space_id, dedupe_key);
CREATE INDEX IF NOT EXISTS        idx_notifications_pending ON public.notifications (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS        idx_notifications_member  ON public.notifications (space_id, member_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));

DROP TRIGGER IF EXISTS trg_notifications_touch ON public.notifications;
CREATE TRIGGER trg_notifications_touch
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
