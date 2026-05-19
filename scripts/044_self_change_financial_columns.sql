-- =============================================================================
-- 044: Block member self-change of financial columns
-- =============================================================================
-- prevent_member_self_role_change protected role/tier/status/approved/
-- card-access/onboarding/space but NOT the financial columns. RLS
-- members_update lets a member UPDATE their own row, so a member could
-- self-set payment_status / dues_paid_until / last_paid_at / etc. via
-- PostgREST and forge a "dues good" signal. Add them to the blocked set.
-- Legitimate writers are the Stripe webhook / treasurer actions via the
-- service client (auth.uid() IS NULL -> early return, unaffected) or a
-- privileged user editing ANOTHER member (NEW.user_id <> auth.uid()).
--
-- Idempotent: CREATE OR REPLACE FUNCTION.
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
