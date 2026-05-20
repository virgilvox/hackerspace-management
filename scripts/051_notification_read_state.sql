-- =============================================================================
-- 051: in-app notification center read state (Product spine Phase 5)
-- =============================================================================
-- The notifications outbox doubles as the member's in-app inbox on /me. Add a
-- per-row read marker so the inbox can show unread/read state and an unread
-- count. read_at IS NULL means unread; the member self-serve mark-read action
-- (service client, scoped to the caller's own member_id) sets it. This is the
-- always-on channel: a notification whose EMAIL was muted ('skipped' by the
-- dispatcher per the member's preferences) still appears here as unread.
--
-- No RLS change: notifications already has SELECT = admin/board/treasurer and
-- NO client write policy; the member's read + mark-read both go through
-- validated service-client actions (same convention as the rest of the
-- notification self-view).
--
-- Idempotent: ADD COLUMN / CREATE INDEX IF NOT EXISTS. Apply as-is.
-- =============================================================================

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Partial index for the per-member unread count / unread list.
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (space_id, member_id) WHERE read_at IS NULL;
