-- =============================================================================
-- 024: Close member self-escalation gaps in prevent_member_self_role_change
-- =============================================================================
-- The members_update RLS policy intentionally lets a member update their own
-- row (display_name, handle, bio, skills, ...). The 015 trigger blocks the
-- privileged columns, but two columns added by later migrations were not in
-- its list:
--
--   tier_id                 (021) - a member could self-upgrade their tier
--   onboarding_completed_at (022) - a member could skip required onboarding
--                                   (e.g. the code-of-conduct acknowledgement)
--                                   by setting this directly via PostgREST
--
-- finishOnboarding()/skipOnboarding() now set onboarding_completed_at through
-- the service-role client AFTER server-side validation, so blocking it here
-- does not break the legitimate path.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_member_self_role_change()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_is_privileged boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  SELECT public.user_has_role_in_space(auth.uid(), NEW.space_id, ARRAY['admin','board','treasurer'])
    INTO v_is_privileged;

  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  IF NEW.role                    IS DISTINCT FROM OLD.role
  OR NEW.tier                    IS DISTINCT FROM OLD.tier
  OR NEW.tier_id                 IS DISTINCT FROM OLD.tier_id
  OR NEW.status                  IS DISTINCT FROM OLD.status
  OR NEW.approved                IS DISTINCT FROM OLD.approved
  OR NEW.has_card_access         IS DISTINCT FROM OLD.has_card_access
  OR NEW.onboarding_completed_at IS DISTINCT FROM OLD.onboarding_completed_at
  OR NEW.space_id                IS DISTINCT FROM OLD.space_id THEN
    RAISE EXCEPTION 'Members cannot change their own role, tier, status, approval, card access, onboarding completion, or space.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_member_self_role_change ON public.space_members;
CREATE TRIGGER trg_prevent_member_self_role_change
  BEFORE UPDATE ON public.space_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_member_self_role_change();
