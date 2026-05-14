-- =============================================================================
-- 017: Governance RLS hardening
-- =============================================================================
-- Pass 5's Tier 1 RLS allowed several cross-tenant edge cases when a user is
-- a member of more than one space. The app's `requireMember()` uses `.single()`
-- which makes multi-space practically impossible at the app layer, but RLS
-- should be airtight regardless.
--
-- Bugs being closed (defense in depth):
--   1. proposal_votes.votes_insert / votes_update accepted a vote where
--      member_id was from space A but the proposal was in space B.
--   2. incidents.incidents_insert let the reporter set reporter_id to any
--      space_members row they own, including one in a different space.
--   3. incident_updates.incident_updates_insert did not validate author_id.
--
-- Also adds a partial unique index that prevents two `active` policy versions
-- for the same slug — fixing a race when two admins concurrently activate
-- different drafts.
--
-- Idempotent: drops policies / indexes first.
-- =============================================================================

-- 1. proposal_votes: require member's space match the proposal's space.
DROP POLICY IF EXISTS votes_insert ON public.proposal_votes;
CREATE POLICY votes_insert ON public.proposal_votes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.proposals p
      JOIN public.space_members m ON m.id = proposal_votes.member_id
      WHERE p.id = proposal_votes.proposal_id
        AND m.user_id = auth.uid()
        AND m.space_id = p.space_id
        AND p.status = 'open'
        AND p.voting_opens_at <= now()
        AND p.voting_closes_at > now()
    )
  );

DROP POLICY IF EXISTS votes_update ON public.proposal_votes;
CREATE POLICY votes_update ON public.proposal_votes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.proposals p
      JOIN public.space_members m ON m.id = proposal_votes.member_id
      WHERE p.id = proposal_votes.proposal_id
        AND m.user_id = auth.uid()
        AND m.space_id = p.space_id
        AND p.status = 'open'
        AND p.voting_closes_at > now()
    )
  );


-- 2. incidents: reporter_id, when set, must be a space_members row owned by
--    the caller AND in the same space as the incident.
DROP POLICY IF EXISTS incidents_insert ON public.incidents;
CREATE POLICY incidents_insert ON public.incidents FOR INSERT
  WITH CHECK (
    space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    AND (
      reporter_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.space_members m
        WHERE m.id = incidents.reporter_id
          AND m.user_id = auth.uid()
          AND m.space_id = incidents.space_id
      )
    )
  );


-- 3. incident_updates: author_id, when set, must be a space_members row
--    owned by the caller AND in the same space as the incident.
DROP POLICY IF EXISTS incident_updates_insert ON public.incident_updates;
CREATE POLICY incident_updates_insert ON public.incident_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_updates.incident_id
        AND (
          public.user_has_role_in_space(auth.uid(), i.space_id, ARRAY['admin','board'])
          OR i.reporter_id IN (
            SELECT m.id FROM public.space_members m
            WHERE m.user_id = auth.uid() AND m.space_id = i.space_id
          )
        )
    )
    AND (
      author_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.space_members m, public.incidents i
        WHERE i.id = incident_updates.incident_id
          AND m.id = incident_updates.author_id
          AND m.user_id = auth.uid()
          AND m.space_id = i.space_id
      )
    )
  );


-- 4. Exactly one active policy version per (space, slug).
DROP INDEX IF EXISTS public.policies_one_active_per_slug;
CREATE UNIQUE INDEX policies_one_active_per_slug
  ON public.policies (space_id, slug)
  WHERE status = 'active';
