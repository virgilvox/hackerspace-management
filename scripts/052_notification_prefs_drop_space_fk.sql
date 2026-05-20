-- =============================================================================
-- 052: HOTFIX -- drop notification_preferences.space_id -> spaces FK
-- =============================================================================
-- PRODUCTION OUTAGE FIX. notification_preferences (migration 048) had FKs to
-- BOTH space_members(id) and spaces(id). PostgREST detects a table with FKs to
-- two tables as a many-to-many JUNCTION, so it found TWO ways to embed
-- `spaces` into `space_members` (the direct space_members.space_id FK AND the
-- notification_preferences junction) and refused the ambiguous embed with
-- PGRST201. The app layout resolves membership with
-- `space_members.select('*, spaces(*)')`; that query started erroring, so
-- `member` came back null and EVERY authenticated user was redirected to
-- /signup.
--
-- Fix: drop the redundant space_id -> spaces FK. space_id stays as a NOT NULL
-- column (PK / RLS / queries use it); the row is still reachable to its space
-- through member_id -> space_members -> spaces, and deleting a space still
-- cascades (space -> space_members -> notification_preferences via the
-- member_id FK). With only one FK left, notification_preferences is no longer
-- a junction and the space_members <-> spaces embed is unambiguous again.
--
-- Do NOT re-add a spaces FK to this table: it reintroduces the junction and
-- breaks every space_members/spaces embed across the app.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS. Apply as-is.
-- =============================================================================

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_space_id_fkey;
