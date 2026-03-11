-- Fix 1: Allow admins to insert space_members records without requiring user_id = auth.uid()
-- This is needed for: addMember (offline/manual member add), importMembers (CSV bulk import)
-- The current policy only allows self-registration (user_id = auth.uid())
-- We need to also allow board/admin members of the same space to insert

-- Drop the restrictive insert policy
DROP POLICY IF EXISTS space_members_insert_authenticated ON public.space_members;

-- New insert policy: allow self-registration OR admin/board inserting into their own space
-- Cast role and status to text to avoid enum comparison errors
CREATE POLICY space_members_insert_authenticated ON public.space_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Self registration: user is inserting their own record
    user_id = auth.uid()
    OR
    -- Admin/board adding a member to their space (offline member, no user_id yet)
    public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin', 'board'])
  );

-- Fix 2: Add unique constraint on space_members(space_id, email) for importMembers upsert
-- Only add if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'space_members_space_id_email_key'
  ) THEN
    ALTER TABLE public.space_members ADD CONSTRAINT space_members_space_id_email_key UNIQUE (space_id, email);
  END IF;
END $$;
