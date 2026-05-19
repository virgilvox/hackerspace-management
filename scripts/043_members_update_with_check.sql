-- =============================================================================
-- 043: space_members UPDATE — add WITH CHECK (defense-in-depth)
-- =============================================================================
-- members_update had only a USING clause: a privileged caller could mutate a
-- member row into a space where they hold no role (cross-space move) because
-- the post-image was never re-checked. Add a WITH CHECK mirroring the USING
-- so the resulting row must still satisfy the same predicate. (Self column
-- escalation -- space_id/role/status -- is separately blocked by the
-- prevent_member_self_role_change trigger; see scripts/044.)
--
-- Idempotent: DROP POLICY IF EXISTS then CREATE.
-- =============================================================================

DROP POLICY IF EXISTS members_update ON public.space_members;
CREATE POLICY members_update ON public.space_members FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer'])
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer'])
  );
