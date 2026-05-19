-- =============================================================================
-- 046: RLS-layer privilege gate on member status (defense-in-depth for D2)
-- =============================================================================
-- D2 closed the require_approval bypass at the APP layer (requireMemberWithRole
-- rejects non-privilege-eligible status). This adds the same guard at the RLS
-- layer so an `unverified`/`inactive` member who somehow bypassed the app
-- (direct PostgREST) still cannot exercise a role or permission.
--
-- Mirrors lib/permissions.ts PRIVILEGE_STATUSES = ('current','late'). Scope is
-- deliberately the role/permission entrypoints ONLY:
--   * user_has_role_in_space  -> write policies + the self-change trigger's
--                                privileged-bypass + the admin short-circuit
--   * user_has_permission     -> guarded as a whole (closes the custom-role /
--                                area-lead permission path WITHOUT touching
--                                user_effective_roles)
-- get_user_space_ids and user_effective_roles are intentionally NOT changed:
-- gating SELECT-policy reads would break an unverified member's own /me +
-- onboarding (the legitimate require_approval flow). 'current'/'late' keep
-- full access; approval (a current admin updating ANOTHER member) is
-- unaffected. Idempotent: CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_has_role_in_space(uid uuid, sid uuid, allowed_roles text[])
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE user_id = uid
      AND space_id = sid
      AND role::text = ANY(allowed_roles)
      AND status IN ('current','late')   -- privilege-eligible only
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(uid uuid, sid uuid, perm text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.space_members
           WHERE user_id = uid AND space_id = sid
             AND status IN ('current','late')   -- no permission unless privilege-eligible
         )
     AND (
       public.user_has_role_in_space(uid, sid, ARRAY['admin'])
       OR EXISTS (
         SELECT 1 FROM public.space_role_permissions p
         WHERE p.space_id = sid AND p.permission = perm
           AND p.subject IN (SELECT public.user_effective_roles(uid, sid))
       )
     );
$$;
