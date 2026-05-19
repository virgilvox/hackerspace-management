-- =============================================================================
-- 045: Class signup/cancel concurrency (P1, deeper-audit deferred)
-- =============================================================================
-- signUpForClass did count-registered -> decide -> insert and cancelMySignup
-- did cancel -> recount -> promote, both non-atomic: concurrent signups at
-- the capacity boundary over-enrolled, and concurrent cancels double-promoted
-- waitlisters. Capacity is dynamic (session OR class), so a constraint can't
-- express it. These functions serialize all signup/cancel for a session with
-- a per-session advisory xact lock and do the decision + write atomically.
--
-- The pure lib/classes-logic.ts (computeSignupStatus / pickPromotion) remains
-- the documented rule and is unit-tested; the SQL below MUST match it and is
-- the runtime authority. Idempotent: CREATE OR REPLACE.
-- =============================================================================

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
