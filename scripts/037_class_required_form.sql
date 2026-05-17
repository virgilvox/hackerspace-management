-- =============================================================================
-- 037: A class can optionally require a form
-- =============================================================================
-- A class may point at one form in the same space (a waiver or intake form).
-- When set, signing up for any session of that class requires the member to
-- have a completed submission of that form on file (the "waiver on file"
-- model). The gate is enforced in the application
-- (lib/classes-logic.ts + lib/actions/classes.ts), mirroring the existing
-- equipment required-certification gate: a classes.manage holder can override
-- and sign a member up on their behalf. The submission check reads
-- form_submissions via the service client (boolean only) since a class
-- manager need not hold forms.manage.
--
-- ON DELETE SET NULL: deleting the form just drops the requirement; existing
-- signups are unaffected.
--
-- No RLS change: classes already has additive default-deny policies and this
-- is an additional nullable column on it.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS required_form_id uuid
  REFERENCES public.forms(id) ON DELETE SET NULL;
