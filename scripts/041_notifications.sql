-- =============================================================================
-- 041: Transactional notifications outbox (Product spine Phase 2)
-- =============================================================================
-- Dues-lifecycle emails (renewal receipt, payment-failed, lapse-to-late) are
-- enqueued by the Stripe webhook and sent by a separate dispatcher cron. The
-- webhook NEVER sends inline: it only writes an idempotent outbox row, so the
-- money path stays fast and safe to retry (a duplicate enqueue is a no-op via
-- the (space_id, dedupe_key) unique index).
--
--   * notifications: one row per message. Service client (webhook enqueue +
--     dispatcher) is the only writer; SELECT = admin/board/treasurer (mirrors
--     member_billing / payments visibility). Member self-view of their own
--     notifications is a validated service-client action, not an RLS path
--     (same convention as getMyBilling).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS then
-- CREATE. Apply as-is (Supabase SQL editor / psql); re-runs are no-ops.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id   uuid        REFERENCES public.space_members(id) ON DELETE CASCADE,
  type        text        NOT NULL,
  channel     text        NOT NULL DEFAULT 'email',
  recipient   text        NOT NULL,
  subject     text        NOT NULL,
  body_html   text        NOT NULL,
  body_text   text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending',
  attempts    integer     NOT NULL DEFAULT 0,
  last_error  text,
  dedupe_key  text        NOT NULL,
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe  ON public.notifications (space_id, dedupe_key);
CREATE INDEX IF NOT EXISTS        idx_notifications_pending ON public.notifications (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS        idx_notifications_member  ON public.notifications (space_id, member_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
-- No INSERT/UPDATE/DELETE policy: the validated service-client webhook enqueue
-- and dispatcher cron are the only writers.

DROP TRIGGER IF EXISTS trg_notifications_touch ON public.notifications;
CREATE TRIGGER trg_notifications_touch
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
