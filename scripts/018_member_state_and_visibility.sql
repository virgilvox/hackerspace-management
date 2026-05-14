-- =============================================================================
-- 018: Member-state extensions, visibility settings, KB meeting flag
-- =============================================================================
-- Tier 2 and Tier 3 of docs/GOVERNANCE_FEATURES.md (the smaller column-set
-- extensions; UI for the rest follows in app code).
--
-- Adds:
--   - Self-editable member profile fields: skills, interests, willing_to.
--   - Conflict-of-interest disclosure fields: affiliations,
--     coi_last_disclosed_at.
--   - A BEFORE-UPDATE/INSERT trigger on space_members that auto-creates a
--     180-day card-access review task whenever has_card_access flips on.
--   - Per-space settings for financial-data visibility and member-directory
--     visibility (so spaces can change "who sees the cardholder count" without
--     code changes).
--   - knowledge_base flags for board meeting minutes: is_meeting_minutes and
--     meeting_date.
--   - inactive_members view: members with no activity_log entry in 180 days.
--
-- Idempotent.
-- =============================================================================


-- 1. ENUMS ----------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.financial_visibility AS ENUM ('treasurer_only','board_visible','all_members_visible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.directory_visibility AS ENUM ('board_only','member_count_visible','members_visible','public_members_visible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2. SPACES — visibility settings ---------------------------------------------
ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS financial_visibility        public.financial_visibility NOT NULL DEFAULT 'board_visible';
ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS member_directory_visibility public.directory_visibility  NOT NULL DEFAULT 'members_visible';


-- 3. SPACE_MEMBERS — opt-in profile and COI ----------------------------------
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS skills       text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS interests    text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS willing_to   text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS affiliations text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS coi_last_disclosed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_space_members_willing_to ON public.space_members USING GIN (willing_to);
CREATE INDEX IF NOT EXISTS idx_space_members_skills     ON public.space_members USING GIN (skills);


-- 4. KNOWLEDGE_BASE — meeting minutes flag -----------------------------------
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS is_meeting_minutes boolean     NOT NULL DEFAULT false;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS meeting_date       timestamptz;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_meeting_date
  ON public.knowledge_base (meeting_date DESC)
  WHERE is_meeting_minutes = true;


-- 5. Card-access mid-tenure review trigger -----------------------------------
-- Fires when has_card_access flips from false/null to true. Inserts a 180-day
-- task into `tasks` so admin / board are reminded to re-evaluate access.
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
      space_id,
      title,
      description,
      task_type,
      status,
      area,
      due_date,
      requested_by_name
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


-- 6. inactive_members view ---------------------------------------------------
-- Members in good standing who have no activity_log entry in the last 180
-- days. View, not materialized — recomputed on read. Cheap because activity_log
-- already has an index on (space_id, created_at DESC).
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

-- Grant access via RLS-equivalent function. Views inherit RLS from underlying
-- tables in Postgres only if the view owner is not a superuser. The view here
-- is owned by `postgres`, which bypasses RLS. We therefore filter at the
-- application layer (`/members` page already scopes by space_id when reading
-- this view).
