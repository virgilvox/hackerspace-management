-- =============================================================================
-- 025: Re-assert the hardened incidents_insert policy (production convergence)
-- =============================================================================
-- A basic, active member filing an incident report on production (including
-- the anonymous path) hit:
--
--   new row violates row-level security policy for table "incidents"
--
-- Tracing the code against this repo, the insert SHOULD pass: fileIncident()
-- sets reporter_id = NULL when anonymous (satisfying the second WITH CHECK
-- branch) and space_id = the member's own space, and getAuthMember() resolves
-- the member strictly by user_id = auth.uid() (so get_user_space_ids(auth.uid())
-- contains that space_id). The failure is therefore a production divergence,
-- not reproducible from source. The three candidate root causes are:
--
--   1. auth.uid() is NULL inside the PostgREST request (SSR session/JWT not
--      reaching the DB for this action).
--   2. The deployed incidents_insert policy differs from migrations 016/017
--      (hand-edited, or an older variant the idempotent runner never replaced).
--   3. The acting space_members row's user_id does not match the JWT sub on
--      production (data drift).
--
-- This migration addresses cause #2 only: it idempotently drops and recreates
-- incidents_insert with the EXACT hardened expression from migration 017 and
-- scripts/schema.sql. It is access-neutral (the policy text is identical to the
-- intended state, so a correctly-deployed DB is unchanged) and it makes the
-- deployed policy converge to the known-good definition.
--
-- It does NOT fix causes #1 or #3. If the report persists after this migration
-- deploys, run the discriminating queries in docs/HANDOFF.md to confirm whether
-- auth.uid() resolves and whether the member row's user_id matches.
--
-- Idempotent: DROP POLICY IF EXISTS then CREATE.
-- =============================================================================

DROP POLICY IF EXISTS incidents_insert ON public.incidents;
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
