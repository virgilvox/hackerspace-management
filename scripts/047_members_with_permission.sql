-- =============================================================================
-- 047: members_with_permission helper (Product spine Phase 4 notifications)
-- =============================================================================
-- The dues outbox is member-keyed: one recipient per row. The new form-
-- submission "admin alert" fans out: one outbox row per recipient member who
-- holds a given permission (e.g. forms.manage). Today the only available
-- function is user_has_permission(uid, sid, perm): a per-user check. Iterating
-- it across every member of a space would be N round-trips for every form
-- submit -- bad latency, bad scaling.
--
-- members_with_permission(sid, perm) is the inverted, set-returning version of
-- user_has_permission. Same membership-status gate (current/late only, mirrors
-- migration 046), same admin-shortcut, same space_role_permissions +
-- user_effective_roles fallback. Additive: it adds nothing to RLS surface,
-- introduces no new tables/policies, and existing callers continue to use
-- user_has_permission unchanged.
--
-- Idempotent: CREATE OR REPLACE. Apply as-is (Supabase SQL editor / psql);
-- re-runs are no-ops.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.members_with_permission(sid uuid, perm text)
  RETURNS TABLE(member_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sm.id
  FROM public.space_members sm
  WHERE sm.space_id = sid
    AND sm.status IN ('current','late')   -- privilege-eligible only, mirrors 046
    AND (
      sm.role = 'admin'                    -- admins always pass (matches user_has_permission)
      OR EXISTS (
        SELECT 1 FROM public.space_role_permissions p
        WHERE p.space_id = sid AND p.permission = perm
          AND p.subject IN (SELECT public.user_effective_roles(sm.user_id, sid))
      )
    );
$$;
