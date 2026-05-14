-- =============================================================================
-- 014: Make space_members.user_id nullable for offline members
-- =============================================================================
-- Background:
--   addMember() and importMembers() in lib/actions.ts insert members that may
--   not have a corresponding auth.users row (admin-added or CSV-imported
--   members who have not signed up yet). The original schema declared
--   space_members.user_id as NOT NULL, which made those inserts fail.
--
-- This migration:
--   1. Drops the NOT NULL constraint on space_members.user_id.
--
-- Safe to re-run: ALTER COLUMN ... DROP NOT NULL is idempotent in Postgres.
-- =============================================================================

ALTER TABLE public.space_members
  ALTER COLUMN user_id DROP NOT NULL;
