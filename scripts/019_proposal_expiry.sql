-- =============================================================================
-- 019: Auto-expire open proposals whose voting window has closed
-- =============================================================================
-- Pass 5's open item: when `voting_closes_at < now()` on an `open` proposal,
-- nothing flips the status. Admins have to click "Mark decided" manually.
--
-- This migration adds two pieces:
--
--   1. A SECURITY DEFINER function `public.expire_proposals()` that finds
--      every open proposal with a passed deadline and updates it:
--        - If quorum is met, status becomes 'decided' and decided_at = now()
--          (the trigger has already computed `passed`, so the result is final).
--        - If quorum is NOT met, status becomes 'expired'.
--      Returns the number of proposals it touched, so callers can monitor.
--
--   2. An "on-read" optimisation: nothing here yet, deliberately. Polling
--      `SELECT public.expire_proposals()` on a schedule is the recommended
--      pattern. From a Next.js cron job, from pg_cron on Supabase, or from
--      a /api/cron route guarded by a CRON_SECRET header.
--
-- Safe to re-run: CREATE OR REPLACE FUNCTION.
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
  -- Quorum met -> decide.
  WITH updated AS (
    UPDATE public.proposals
       SET status = 'decided',
           decided_at = now()
     WHERE status = 'open'
       AND voting_closes_at IS NOT NULL
       AND voting_closes_at < now()
       AND quorum_met = true
    RETURNING 1
  )
  SELECT count(*) INTO v_decided FROM updated;

  -- Quorum not met -> expire.
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

-- Optional: schedule with pg_cron if available. Self-hosted Supabase enables
-- the extension by default; managed Supabase requires the user to enable it
-- from Database → Extensions. The DO block below is best-effort and fails
-- silently when pg_cron is not present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule any prior job with the same name (idempotent).
    PERFORM cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname = 'expire-proposals-hourly';
    PERFORM cron.schedule(
      'expire-proposals-hourly',
      '0 * * * *',
      $cron$SELECT public.expire_proposals();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not installed or insufficient privileges. The function still
  -- exists; the operator can run it on whatever schedule they want.
  NULL;
END $$;
