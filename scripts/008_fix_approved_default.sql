-- 008: Set approved default to true so new members don't get locked out
-- The approved column was added without a default, meaning it defaults to NULL.
-- Queries filtering eq('approved', true) would silently return zero rows.
-- Fix: set the default to true so any insert that doesn't specify it gets approved automatically.

ALTER TABLE public.space_members
  ALTER COLUMN approved SET DEFAULT true;

-- Also backfill existing members who have null approved
UPDATE public.space_members
  SET approved = true
  WHERE approved IS NULL;
