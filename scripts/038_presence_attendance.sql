-- =============================================================================
-- 038: Presence & attendance (check-in / check-out / hosting)
-- =============================================================================
-- space_visits is one row per visit: a member checks in (optionally as a host,
-- optionally with a note), and later checks out (optionally with a note). An
-- open visit (checked_out_at IS NULL) means the member is currently present.
--
--   * Partial UNIQUE (space_id, member_id) WHERE checked_out_at IS NULL: at
--     most one open visit per member per space. The action layer auto-closes a
--     stale open visit before starting a new one.
--   * Presence is inherently social, so any space member may SELECT. There is
--     deliberately NO client INSERT/UPDATE/DELETE policy: check-in/out funnel
--     through validated service-client actions that resolve the member
--     server-side (self-only) and enforce the one-open invariant and the
--     host-eligibility rule. History is not deletable (no DELETE path).
--   * No new permission code. The org-wide attendance view is visible to any
--     space member (product decision); managers are not special here.
--
-- spaces.host_requires_card gates checking in *as a host*: when true (default)
-- a member must have an active member_card on file to mark themselves host;
-- a space may flip it off to let anyone self-mark host. Enforced in the app
-- (lib/presence-logic.ts + lib/actions/presence.ts); additive nullable-safe
-- column with a NOT NULL DEFAULT so existing spaces keep the safe behavior.
--
-- Idempotent: ADD COLUMN / CREATE TABLE / CREATE INDEX IF NOT EXISTS,
-- DROP POLICY IF EXISTS then CREATE.
-- =============================================================================

ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS host_requires_card boolean NOT NULL DEFAULT true;

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
-- No INSERT/UPDATE/DELETE policy: the validated service-client actions are the
-- only writers; attendance history is immutable.
