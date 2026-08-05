-- =============================================================================
-- 055: atomic, concurrency-safe onboarding step completion
-- =============================================================================
-- markOnboardingStepDone previously did a read-modify-write on the
-- space_members.onboarding_progress jsonb column: SELECT the object, add the
-- step id to completed_step_ids in JS, then UPDATE the whole object back. Two
-- near-simultaneous completions (a double-submit, or two steps ticked in quick
-- succession) both read the same base array and the second write clobbers the
-- first -- a lost update that silently drops a completed step (deferred bug L3).
--
-- mark_onboarding_step_done replaces that with a single atomic UPDATE that
-- dedup-appends the step id into onboarding_progress.completed_step_ids. Because
-- it is one statement, the row lock serializes concurrent callers and Postgres
-- re-evaluates the jsonb expression against the latest committed tuple
-- (EvalPlanQual) under READ COMMITTED -- so no update is ever lost, and other
-- keys in the object are preserved. Appending an already-present id is a no-op
-- (idempotent), matching the old Set semantics.
--
-- Ownership: the id-append is harmless, but a caller must still only be able to
-- touch their OWN membership row. When invoked with a JWT (auth.uid() set, the
-- normal RLS/user client path) the WHERE clause pins the row to
-- user_id = auth.uid(), so passing another member's id updates nothing. The
-- service/no-JWT path (auth.uid() IS NULL) is trusted and scoped by p_member_id,
-- mirroring the existing atomic RPCs (class_signup_tx et al.).
--
-- Idempotent migration: CREATE OR REPLACE. Apply as-is (Supabase SQL editor /
-- psql); re-runs are no-ops.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_onboarding_step_done(
  p_member_id uuid, p_step_id uuid
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_completed jsonb;
BEGIN
  UPDATE public.space_members m
  SET onboarding_progress = jsonb_set(
        coalesce(m.onboarding_progress, '{}'::jsonb),
        '{completed_step_ids}',
        CASE
          WHEN coalesce(m.onboarding_progress -> 'completed_step_ids', '[]'::jsonb)
                 @> to_jsonb(p_step_id::text)
            THEN m.onboarding_progress -> 'completed_step_ids'
          ELSE coalesce(m.onboarding_progress -> 'completed_step_ids', '[]'::jsonb)
                 || to_jsonb(p_step_id::text)
        END
      )
  WHERE m.id = p_member_id
    AND (auth.uid() IS NULL OR m.user_id = auth.uid())
  RETURNING m.onboarding_progress -> 'completed_step_ids' INTO v_completed;

  -- NULL when no row matched (not the caller's membership); the resulting
  -- completed_step_ids array otherwise.
  RETURN v_completed;
END;
$$;

-- Lock down default PUBLIC execute. The user (RLS) client calls this as the
-- authenticated role; the ownership guard above keeps it to the caller's own
-- row. service_role (the admin client) may also call it for the trusted path.
REVOKE EXECUTE ON FUNCTION public.mark_onboarding_step_done(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_onboarding_step_done(uuid, uuid) TO authenticated, service_role;
