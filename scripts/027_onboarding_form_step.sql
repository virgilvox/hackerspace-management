-- =============================================================================
-- 027: Allow an onboarding step to embed a custom form / waiver
-- =============================================================================
-- Adds 'form' to the space_onboarding_steps.step_type CHECK so a space can
-- require a custom form or waiver as an onboarding step. The referenced form
-- is stored in the step's existing `config` jsonb as { "form_id": "<uuid>" };
-- no new column is needed.
--
-- step_type is a TEXT column with a column-level CHECK, not a Postgres enum,
-- so this is a constraint replacement (the only safe path for a CHECK), done
-- by the auto-generated constraint name. Idempotent: DROP CONSTRAINT IF EXISTS
-- then ADD.
-- =============================================================================

ALTER TABLE public.space_onboarding_steps
  DROP CONSTRAINT IF EXISTS space_onboarding_steps_step_type_check;

ALTER TABLE public.space_onboarding_steps
  ADD CONSTRAINT space_onboarding_steps_step_type_check
  CHECK (step_type IN ('welcome','code_of_conduct','profile','payment','content','form'));
