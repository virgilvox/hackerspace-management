-- =============================================================================
-- 049: Alternate dues payment methods (admin-configured external links)
-- =============================================================================
-- A space can take dues off-platform (PayPal, Zeffy, Venmo) in addition to (or
-- instead of) the integrated Stripe dues. An admin sets one external pay-here
-- URL per platform; members see them as click-out buttons on /me; a treasurer
-- reconciles the resulting payment manually through the existing payments flow.
-- Each row carries a payment_platform tag so that manual reconcile is
-- pre-typed. There is NO automated payment record on click: this table is link
-- configuration only.
--
-- One row per (space, platform): UNIQUE (space_id, platform) so the admin
-- upsert is idempotent. RLS: every space member may SELECT (members need to
-- render the pay options); writes are admin/board only (mirrors the Stripe
-- settings gate). url is validated https-only at the server-action boundary.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
-- then CREATE. Apply as-is (Supabase SQL editor / psql); re-runs are no-ops.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dues_payment_methods (
  id           uuid                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     uuid                   NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  platform     public.payment_platform NOT NULL,
  url          text                   NOT NULL,
  instructions text,
  is_active    boolean                NOT NULL DEFAULT true,
  sort_order   integer                NOT NULL DEFAULT 0,
  created_at   timestamptz            NOT NULL DEFAULT now(),
  updated_at   timestamptz            NOT NULL DEFAULT now(),
  UNIQUE (space_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_dues_payment_methods_space
  ON public.dues_payment_methods (space_id);

ALTER TABLE public.dues_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dues_payment_methods_select ON public.dues_payment_methods;
DROP POLICY IF EXISTS dues_payment_methods_insert ON public.dues_payment_methods;
DROP POLICY IF EXISTS dues_payment_methods_update ON public.dues_payment_methods;
DROP POLICY IF EXISTS dues_payment_methods_delete ON public.dues_payment_methods;

-- Any member of the space may read (they render the pay buttons).
CREATE POLICY dues_payment_methods_select ON public.dues_payment_methods FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));

-- Writes: admin/board only.
CREATE POLICY dues_payment_methods_insert ON public.dues_payment_methods FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY dues_payment_methods_update ON public.dues_payment_methods FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']))
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY dues_payment_methods_delete ON public.dues_payment_methods FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

DROP TRIGGER IF EXISTS trg_dues_payment_methods_touch ON public.dues_payment_methods;
CREATE TRIGGER trg_dues_payment_methods_touch
  BEFORE UPDATE ON public.dues_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
