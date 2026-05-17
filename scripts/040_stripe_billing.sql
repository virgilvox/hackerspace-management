-- =============================================================================
-- 040: Stripe recurring dues (Phase 1) — enum + member billing + webhook dedupe
-- =============================================================================
-- Per-space OWN Stripe keys (NOT Connect). Secret key + webhook signing secret
-- live in the AES-256-GCM secrets vault; non-secret config (publishable key,
-- mode, tier->price map, secret refs) in integrations.config. This migration
-- is structure only; it never writes the literal 'stripe' enum value, so
-- ALTER TYPE ADD VALUE in the same script is safe.
--
--   * payment_platform gains 'stripe' (ALTER TYPE ADD VALUE is the only safe
--     path; mirrored into the CREATE TYPE list in scripts/schema.sql).
--   * member_billing: one row per member with a Stripe customer/subscription.
--     Webhook (service client) is the only writer; SELECT = admin/board/
--     treasurer (mirrors payments visibility). Member self-view of their own
--     billing is a validated service-client action, not an RLS path.
--   * stripe_webhook_events: idempotency ledger keyed by Stripe's stable
--     event id. Service-client only; no client policy.
--
-- Idempotent: ADD VALUE IF NOT EXISTS, CREATE TABLE/INDEX IF NOT EXISTS,
-- DROP POLICY IF EXISTS then CREATE.
--
-- Apply this file as-is (Supabase SQL editor / psql). Do NOT wrap it in a
-- manual BEGIN/COMMIT: `ALTER TYPE ... ADD VALUE` historically could not run
-- inside a transaction block (fine on Supabase PG15 unwrapped). The new
-- value is not used by any statement here, so a single implicit transaction
-- is safe and re-runs are no-ops.
-- =============================================================================

ALTER TYPE public.payment_platform ADD VALUE IF NOT EXISTS 'stripe';

CREATE TABLE IF NOT EXISTS public.member_billing (
  id                     uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id               uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id              uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  stripe_customer_id     text,
  stripe_subscription_id text,
  subscription_status    text,
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_billing_member   ON public.member_billing (space_id, member_id);
CREATE INDEX IF NOT EXISTS        idx_member_billing_customer ON public.member_billing (stripe_customer_id);
CREATE INDEX IF NOT EXISTS        idx_member_billing_space    ON public.member_billing (space_id);

ALTER TABLE public.member_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_billing_select ON public.member_billing;
CREATE POLICY member_billing_select ON public.member_billing FOR SELECT
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
-- No INSERT/UPDATE/DELETE policy: the validated service-client webhook/actions
-- are the only writers.

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id    text        PRIMARY KEY,
  space_id    uuid        REFERENCES public.spaces(id) ON DELETE CASCADE,
  type        text,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policy at all: service-client (webhook) only; opaque idempotency ledger.

DROP TRIGGER IF EXISTS trg_member_billing_touch ON public.member_billing;
CREATE TRIGGER trg_member_billing_touch
  BEFORE UPDATE ON public.member_billing
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
