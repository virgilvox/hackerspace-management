-- =====================================================
-- 007: Fix schema + RLS issues found in full audit
-- =====================================================

-- 1. Fix task_status enum — add 'done' and 'completed' alias
--    The code uses 'done' but enum only has 'completed'
--    Safest: add 'done' to the enum
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'done';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'blocked';

-- 2. Fix project_status enum — add 'blocked' for dashboard display
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'blocked';

-- 3. Add missing columns to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS group_label text;

-- 4. Fix integrations unique constraint
--    Current: platform is globally unique (wrong — each space should have its own)
--    Drop the global unique and add a composite unique
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_platform_key;
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_space_platform_unique UNIQUE (space_id, platform);

-- 5. Fix area_leads unique constraint (needed for upsert onConflict)
ALTER TABLE public.area_leads
  ADD CONSTRAINT area_leads_space_area_unique UNIQUE (space_id, area_code);

-- 6. Fix space_members_insert_authenticated — allow admins to add members without user accounts
--    (null user_id is valid for manually-added members)
DROP POLICY IF EXISTS "space_members_insert_authenticated" ON public.space_members;
CREATE POLICY "space_members_insert_authenticated" ON public.space_members
  FOR INSERT WITH CHECK (
    -- User can add themselves
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    -- Admin can add a member record (possibly without user_id) to their own space
    (
      auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id != auth.uid()) AND
      EXISTS (
        SELECT 1 FROM public.space_members sm
        WHERE sm.user_id = auth.uid()
          AND sm.space_id = space_members.space_id
          AND sm.role::text IN ('admin', 'board')
      )
    )
  );

-- 7. Make sure activity_log allows service_role inserts (for triggers)
GRANT ALL ON public.activity_log TO service_role;
GRANT ALL ON public.space_members TO service_role;
GRANT ALL ON public.spaces TO service_role;

-- 8. Add progress column to projects if missing
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;

-- 9. Add name alias for projects (code uses project.name but column is title)
--    Add a generated column as alias
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS name text GENERATED ALWAYS AS (title) STORED;
