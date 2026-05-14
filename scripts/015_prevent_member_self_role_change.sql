-- =============================================================================
-- 015: Prevent self-role-change on space_members
-- =============================================================================
-- Background:
--   The members_update RLS policy allows a user to UPDATE their own row
--   (user_id = auth.uid()). This is intentional so members can edit their
--   display_name, handle, phone, etc. without going through admin.
--   But the policy has no column-level restriction, so a member could
--   PATCH their own row via PostgREST and set role = 'admin'.
--
-- This migration:
--   Adds a BEFORE UPDATE trigger that rejects any change to role, tier,
--   status, approved, has_card_access, or space_id when the row being
--   updated belongs to the current user AND the current user does not
--   already hold a privileged role in that space.
--
-- Service role (no auth.uid) and admin/board/treasurer self-updates are
-- unaffected.
--
-- Safe to re-run: function is CREATE OR REPLACE; trigger is dropped first.
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
