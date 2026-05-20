-- =============================================================================
-- 050: dues_payment_methods.url must be an absolute https URL (CHECK constraint)
-- =============================================================================
-- The url is rendered to MEMBERS as a clickable <a href>. The admin Zod schema
-- (duesPaymentMethodSchema / isSafeDuesUrl) enforces https, but RLS lets an
-- admin/board write the row directly via PostgREST, bypassing the app-layer
-- validation. Without a data-layer constraint a malicious admin could store a
-- `javascript:` URL and XSS members who click it. Enforce https at the DB so
-- the schema is the single source of truth for what can ever be stored.
--
-- Case-insensitive prefix match (`~*`) so `HTTPS://` (which new URL() accepts)
-- is allowed too; the member-read action additionally re-validates with
-- isSafeDuesUrl. Existing prod rows: none yet, so the constraint adds cleanly.
--
-- Idempotent: only adds the constraint if it is not already present. Apply
-- as-is (Supabase SQL editor / psql); re-runs are no-ops.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dues_payment_methods_url_https'
  ) THEN
    ALTER TABLE public.dues_payment_methods
      ADD CONSTRAINT dues_payment_methods_url_https CHECK (url ~* '^https://');
  END IF;
END $$;
