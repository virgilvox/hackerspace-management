-- =============================================================================
-- 031: secrets SELECT also honors the ops.secrets.read role permission
-- =============================================================================
-- Before this migration, secrets_select (from 023) allowed a row only to
-- admin/board OR a subject named in a per-secret ops_acl entry. The role
-- permission ops.secrets.read ("Reveal secrets" in the Customize matrix) was
-- NEVER consulted for secrets, so granting it did nothing and the matrix was
-- misleading. This adds the missing additive branch.
--
-- This is purely ADDITIVE and access-neutral for existing deployments:
--   * The admin/board branch is unchanged.
--   * The per-secret ops_acl branch is unchanged.
--   * A new OR branch grants SELECT to a member whose effective role holds
--     ops.secrets.read in space_role_permissions (admin implicitly holds all,
--     already covered by user_has_permission). With no such grant present the
--     behavior is exactly as before, so no space loses or gains access by
--     deploying this unless an admin has explicitly granted the permission.
--   * Still space-scoped: user_has_permission is per (uid, space_id), so this
--     cannot widen access across tenants.
--
-- The reveal/list server actions are updated in the same change to let RLS be
-- the boundary instead of a hard built-in-role pre-check (lib/actions/
-- secrets.ts). Write paths (create/update/delete) are intentionally NOT
-- widened.
--
-- Idempotent: DROP POLICY IF EXISTS then CREATE. The policy body is the
-- 023/030 text verbatim plus one OR branch.
-- =============================================================================

DROP POLICY IF EXISTS secrets_select ON public.secrets;
CREATE POLICY secrets_select ON public.secrets FOR SELECT
  USING (
    public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
    OR public.user_has_permission(auth.uid(), space_id, 'ops.secrets.read')
    OR EXISTS (
      SELECT 1 FROM public.ops_acl a
      WHERE a.space_id = secrets.space_id AND a.entity_type = 'secret'
        AND a.entity_id = secrets.id
        AND a.role IN (SELECT public.user_effective_roles(auth.uid(), secrets.space_id))
    )
  );
