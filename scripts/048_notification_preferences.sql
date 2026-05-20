-- =============================================================================
-- 048: Member notification preferences (Product spine Phase 5)
-- =============================================================================
-- Per-member opt-out of muteable notification categories (bookings, classes,
-- forms, admin_alerts). Billing (dues renewed / payment-failed / lapsed) is
-- membership-critical and is never muteable, so it is never stored here. The
-- model is opt-out: absence of a row means the default, enabled.
--
-- The dispatcher cron reads these rows (service client) and marks a muted
-- outbox row 'skipped' instead of sending it; the member self-serve toggle on
-- /me writes them through a validated server action (service client). Both
-- paths use the service client, so there is NO client write policy and no
-- client read policy -- the same convention as notifications and
-- member_billing (member self-view goes through a validated action, not RLS).
-- RLS is enabled and default-deny for every non-service client.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
-- then CREATE. Apply as-is (Supabase SQL editor / psql); re-runs are no-ops.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id   uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  category    text        NOT NULL,
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, member_id, category)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- No client policy. Both the member self-view (getMyNotificationPreferences)
-- and the toggle write (setMyNotificationPreference) go through validated
-- service-client actions; the dispatcher reads via the service client too.
-- Default-deny for every non-service client.

DROP TRIGGER IF EXISTS trg_notification_prefs_touch ON public.notification_preferences;
CREATE TRIGGER trg_notification_prefs_touch
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
