-- =============================================================================
-- 016: Governance kernel — proposals, incidents, policies
-- =============================================================================
-- Tier 1 of docs/GOVERNANCE_FEATURES.md.
--
-- This migration adds three tightly integrated entities:
--
--   proposals + proposal_votes  — async voting (Patterns 3, 4, 5, 12)
--   incidents + incident_updates — CoC / safety report tracking (Pattern 1)
--   policies                     — versioned bylaws with provenance (Pattern 4)
--
-- Plus six new columns on `spaces` for per-space governance defaults
-- (quorum percent, voting window, incident SLA, mission statement, etc).
--
-- The three modules cross-reference: a proposal can cite a policy clause, an
-- incident appeal becomes a proposal, a passed bylaw-change proposal supersedes
-- a policy version. The circular FKs are added via ALTER TABLE after creation.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS before
-- CREATE POLICY, CREATE OR REPLACE FUNCTION, etc.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE public.proposal_type   AS ENUM ('bylaw_change','board_action','membership_vote','advisory_poll','recall','budget'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.proposal_status AS ENUM ('draft','open','decided','withdrawn','expired');                                    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.threshold_rule  AS ENUM ('simple_majority','two_thirds','three_fourths','unanimous');                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.vote_position   AS ENUM ('yes','no','abstain','recused');                                                   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.incident_status AS ENUM ('received','under_review','decided','appealed','closed');                          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.incident_severity AS ENUM ('low','medium','high','critical');                                               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.incident_update_visibility AS ENUM ('reporter_only','all_parties','board_only');                            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.policy_status   AS ENUM ('draft','active','deprecated','superseded');                                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- -----------------------------------------------------------------------------
-- 2. SPACES — per-space governance defaults
-- -----------------------------------------------------------------------------
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS default_quorum_percent      integer NOT NULL DEFAULT 10;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS default_quorum_floor        integer NOT NULL DEFAULT 1;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS default_voting_window_hours integer NOT NULL DEFAULT 216;  -- 9 days
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS default_threshold           public.threshold_rule NOT NULL DEFAULT 'simple_majority';
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS incident_sla_hours          integer NOT NULL DEFAULT 72;   -- 3 days
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS mission_statement           text;


-- -----------------------------------------------------------------------------
-- 3. TABLES
-- Order matters because of the circular FKs. Create the tables first without
-- the circular FK columns enforced, then add constraints via ALTER TABLE.
-- -----------------------------------------------------------------------------

-- proposals --------------------------------------------------------------------
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

-- proposal_votes ---------------------------------------------------------------
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

-- incidents --------------------------------------------------------------------
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

-- incident_updates -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incident_updates (
  id           uuid                                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id  uuid                                 NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  author_id    uuid                                 REFERENCES public.space_members(id) ON DELETE SET NULL,
  author_name  text,
  body         text                                 NOT NULL,
  visibility   public.incident_update_visibility    NOT NULL DEFAULT 'all_parties',
  created_at   timestamptz                          NOT NULL DEFAULT now()
);

-- policies ---------------------------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- 4. CIRCULAR FOREIGN KEYS — added after all three tables exist
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_policy_ref_fk
    FOREIGN KEY (policy_ref_id) REFERENCES public.policies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_parent_incident_fk
    FOREIGN KEY (parent_incident_id) REFERENCES public.incidents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.incidents
    ADD CONSTRAINT incidents_appeal_proposal_fk
    FOREIGN KEY (appeal_proposal_id) REFERENCES public.proposals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.policies
    ADD CONSTRAINT policies_adopted_by_proposal_fk
    FOREIGN KEY (adopted_by_proposal_id) REFERENCES public.proposals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- -----------------------------------------------------------------------------
-- 5. INDEXES
-- -----------------------------------------------------------------------------
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
  ON public.incidents (reporter_token)
  WHERE reporter_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON public.incident_updates (incident_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policies_space_slug     ON public.policies (space_id, slug);
CREATE INDEX IF NOT EXISTS idx_policies_status         ON public.policies (status);


-- -----------------------------------------------------------------------------
-- 6. TRIGGERS
-- -----------------------------------------------------------------------------

-- 6.1 Computes quorum_required and voting window when a proposal opens.
CREATE OR REPLACE FUNCTION public.compute_proposal_quorum()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
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
      WHERE space_id = NEW.space_id
        AND status IN ('current','late')
        AND approved = true;

    NEW.quorum_percent := COALESCE(v_quorum_percent, 10);
    NEW.quorum_floor   := COALESCE(v_quorum_floor, 1);
    NEW.quorum_required := GREATEST(
      NEW.quorum_floor,
      CEIL(v_member_count * NEW.quorum_percent / 100.0)::integer
    );

    IF NEW.voting_opens_at IS NULL THEN
      NEW.voting_opens_at := now();
    END IF;
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


-- 6.2 Recomputes proposal vote tallies on any vote insert / update / delete.
CREATE OR REPLACE FUNCTION public.refresh_proposal_tally()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_proposal_id     uuid;
  v_yes             integer;
  v_no              integer;
  v_abstain         integer;
  v_recused         integer;
  v_total           integer;
  v_quorum_required integer;
  v_threshold       public.threshold_rule;
  v_status          public.proposal_status;
  v_quorum_met      boolean;
  v_passed          boolean;
BEGIN
  v_proposal_id := COALESCE(NEW.proposal_id, OLD.proposal_id);

  SELECT
    count(*) FILTER (WHERE position = 'yes'),
    count(*) FILTER (WHERE position = 'no'),
    count(*) FILTER (WHERE position = 'abstain'),
    count(*) FILTER (WHERE position = 'recused'),
    count(*)
  INTO v_yes, v_no, v_abstain, v_recused, v_total
  FROM public.proposal_votes
  WHERE proposal_id = v_proposal_id;

  SELECT quorum_required, threshold, status
    INTO v_quorum_required, v_threshold, v_status
    FROM public.proposals WHERE id = v_proposal_id;

  -- For quorum, count yes+no+abstain (recused does not count toward quorum).
  v_quorum_met := (v_yes + v_no + v_abstain) >= COALESCE(v_quorum_required, 0);

  v_passed := CASE
    WHEN NOT v_quorum_met THEN false
    WHEN v_yes + v_no = 0 THEN false
    WHEN v_threshold = 'simple_majority' THEN v_yes > v_no
    WHEN v_threshold = 'two_thirds'      THEN v_yes * 3 >= (v_yes + v_no) * 2
    WHEN v_threshold = 'three_fourths'   THEN v_yes * 4 >= (v_yes + v_no) * 3
    WHEN v_threshold = 'unanimous'       THEN v_no = 0 AND v_yes > 0
    ELSE false
  END;

  UPDATE public.proposals
    SET outcome_yes     = v_yes,
        outcome_no      = v_no,
        outcome_abstain = v_abstain,
        outcome_recused = v_recused,
        total_voters    = v_total,
        quorum_met      = v_quorum_met,
        passed          = v_passed,
        updated_at      = now()
    WHERE id = v_proposal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_proposal_tally ON public.proposal_votes;
CREATE TRIGGER trg_refresh_proposal_tally
  AFTER INSERT OR UPDATE OR DELETE ON public.proposal_votes
  FOR EACH ROW EXECUTE FUNCTION public.refresh_proposal_tally();


-- 6.3 Sets incident.sla_response_by on insert if not provided.
CREATE OR REPLACE FUNCTION public.compute_incident_sla()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_hours integer;
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


-- 6.4 Updated-at maintenance.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposals_touch ON public.proposals;
CREATE TRIGGER trg_proposals_touch
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_incidents_touch ON public.incidents;
CREATE TRIGGER trg_incidents_touch
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_policies_touch ON public.policies;
CREATE TRIGGER trg_policies_touch
  BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.proposals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies         ENABLE ROW LEVEL SECURITY;

-- Drop first so re-runs are safe.
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

-- proposals: any member can read and propose; proposer can edit while draft;
-- admin/board can transition status. Delete: admin/board only.
CREATE POLICY proposals_select ON public.proposals FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY proposals_insert ON public.proposals FOR INSERT
  WITH CHECK (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY proposals_update ON public.proposals FOR UPDATE
  USING (
    public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
    OR (
      status = 'draft'
      AND proposer_id IN (
        SELECT id FROM public.space_members WHERE user_id = auth.uid()
      )
    )
  );
CREATE POLICY proposals_delete ON public.proposals FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

-- proposal_votes: all members see all votes (transparency). Members can only
-- write their own vote. Can update while proposal still open. Never deleted.
CREATE POLICY votes_select ON public.proposal_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_votes.proposal_id
        AND p.space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    )
  );
CREATE POLICY votes_insert ON public.proposal_votes FOR INSERT
  WITH CHECK (
    member_id IN (
      SELECT id FROM public.space_members WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_votes.proposal_id
        AND p.status = 'open'
        AND p.voting_opens_at <= now()
        AND p.voting_closes_at > now()
    )
  );
CREATE POLICY votes_update ON public.proposal_votes FOR UPDATE
  USING (
    member_id IN (
      SELECT id FROM public.space_members WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_votes.proposal_id
        AND p.status = 'open'
        AND p.voting_closes_at > now()
    )
  );

-- incidents: admin/board see all; reporter sees their own; named subjects do
-- not see by default (board-only disposition until policy says otherwise).
CREATE POLICY incidents_select ON public.incidents FOR SELECT
  USING (
    public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
    OR reporter_id IN (
      SELECT id FROM public.space_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY incidents_insert ON public.incidents FOR INSERT
  WITH CHECK (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY incidents_update ON public.incidents FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
-- No DELETE policy: incidents are retained.

-- incident_updates: visible per the row's `visibility` field, with admin/board
-- always able to read.
CREATE POLICY incident_updates_select ON public.incident_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_updates.incident_id
        AND (
          public.user_has_role_in_space(auth.uid(), i.space_id, ARRAY['admin','board'])
          OR (
            incident_updates.visibility <> 'board_only'
            AND i.reporter_id IN (
              SELECT id FROM public.space_members WHERE user_id = auth.uid()
            )
          )
        )
    )
  );
CREATE POLICY incident_updates_insert ON public.incident_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_updates.incident_id
        AND (
          public.user_has_role_in_space(auth.uid(), i.space_id, ARRAY['admin','board'])
          OR i.reporter_id IN (
            SELECT id FROM public.space_members WHERE user_id = auth.uid()
          )
        )
    )
  );

-- policies: all members read; admin/board insert and supersede (which is an
-- INSERT of a new version row, not an UPDATE). UPDATE allowed only for admin/
-- board for status flips (deprecate, supersede). No DELETE.
CREATE POLICY policies_select ON public.policies FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY policies_insert ON public.policies FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY policies_update ON public.policies FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
