-- =============================================================================
-- 022: Configurable member onboarding
-- =============================================================================
-- A space defines an ordered list of onboarding steps. A member who joins
-- walks through the enabled steps before they land on the dashboard. Founders
-- (created via createSpace) skip member onboarding: their onboarding is the
-- admin configuration surface, not this flow.
--
-- Step types:
--   welcome          info screen (markdown body), never blocking
--   code_of_conduct  markdown body + required acknowledgement checkbox
--   profile          prompts the member to fill display_name/handle/bio/skills
--   payment          dues setup nudge: markdown body + optional link button
--   content          fully custom sanitized markdown/HTML, optional ack
--
-- Built-in steps are is_system = true: they can be disabled and reordered but
-- not deleted. Custom content steps are is_system = false and deletable.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.space_onboarding_steps (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  step_key    text        NOT NULL CHECK (char_length(step_key) BETWEEN 1 AND 60),
  step_type   text        NOT NULL CHECK (step_type IN ('welcome','code_of_conduct','profile','payment','content')),
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body        text,
  config      jsonb       NOT NULL DEFAULT '{}',
  is_enabled  boolean     NOT NULL DEFAULT true,
  is_required boolean     NOT NULL DEFAULT false,
  is_system   boolean     NOT NULL DEFAULT false,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_space
  ON public.space_onboarding_steps (space_id, sort_order);

ALTER TABLE public.space_members
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE public.space_members
  ADD COLUMN IF NOT EXISTS onboarding_progress jsonb NOT NULL DEFAULT '{}';

-- Seed the four default steps on space creation.
CREATE OR REPLACE FUNCTION public.seed_default_onboarding_steps()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.space_onboarding_steps
    (space_id, step_key, step_type, title, body, config, is_enabled, is_required, is_system, sort_order)
  VALUES
    (NEW.id, 'welcome', 'welcome',
     'Welcome to ' || NEW.name,
     E'We are glad you are here.\n\nThis short setup gets you ready to use the space. It takes about a minute.',
     '{}'::jsonb, true, false, true, 0),
    (NEW.id, 'code_of_conduct', 'code_of_conduct',
     'Code of Conduct',
     E'Be excellent to each other.\n\n- Treat people and tools with respect.\n- Clean up after yourself.\n- Ask before using equipment you have not been trained on.\n\nAn admin can edit this text in Settings, Onboarding.',
     '{"require_ack": true, "ack_label": "I have read and agree to the code of conduct"}'::jsonb,
     true, true, true, 1),
    (NEW.id, 'profile', 'profile',
     'Complete your profile',
     E'Tell the space who you are. You can change this anytime from your profile.',
     '{}'::jsonb, true, false, true, 2),
    (NEW.id, 'payment', 'payment',
     'Set up your dues',
     E'Membership dues keep the space running. Set up your recurring payment now so you do not lose access.\n\nAn admin can put the payment link and instructions here in Settings, Onboarding.',
     '{}'::jsonb, true, false, true, 3)
  ON CONFLICT (space_id, step_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_onboarding_steps ON public.spaces;
CREATE TRIGGER trg_seed_default_onboarding_steps
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_onboarding_steps();

-- Backfill default steps for existing spaces.
INSERT INTO public.space_onboarding_steps
  (space_id, step_key, step_type, title, body, config, is_enabled, is_required, is_system, sort_order)
SELECT
  s.id,
  d.step_key,
  d.step_type,
  CASE WHEN d.step_key = 'welcome' THEN 'Welcome to ' || s.name ELSE d.title END,
  d.body,
  d.config::jsonb,
  true,
  d.is_required,
  true,
  d.sort_order
FROM public.spaces s
CROSS JOIN LATERAL (
  VALUES
    ('welcome', 'welcome', 'Welcome',
       'We are glad you are here. This short setup gets you ready to use the space.',
       '{}', false, 0),
    ('code_of_conduct', 'code_of_conduct', 'Code of Conduct',
       'Be excellent to each other. An admin can edit this in Settings, Onboarding.',
       '{"require_ack": true, "ack_label": "I have read and agree to the code of conduct"}', true, 1),
    ('profile', 'profile', 'Complete your profile',
       'Tell the space who you are.',
       '{}', false, 2),
    ('payment', 'payment', 'Set up your dues',
       'Membership dues keep the space running. An admin can add the payment link in Settings, Onboarding.',
       '{}', false, 3)
) AS d(step_key, step_type, title, body, config, is_required, sort_order)
ON CONFLICT (space_id, step_key) DO NOTHING;

-- Existing members have already been using the app: mark their onboarding done
-- so the new gate does not trap them.
UPDATE public.space_members
SET onboarding_completed_at = now()
WHERE onboarding_completed_at IS NULL;

ALTER TABLE public.space_onboarding_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onboarding_steps_select ON public.space_onboarding_steps;
DROP POLICY IF EXISTS onboarding_steps_insert ON public.space_onboarding_steps;
DROP POLICY IF EXISTS onboarding_steps_update ON public.space_onboarding_steps;
DROP POLICY IF EXISTS onboarding_steps_delete ON public.space_onboarding_steps;
-- Any member of the space can read steps (the joining member needs them).
CREATE POLICY onboarding_steps_select ON public.space_onboarding_steps FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY onboarding_steps_insert ON public.space_onboarding_steps FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY onboarding_steps_update ON public.space_onboarding_steps FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY onboarding_steps_delete ON public.space_onboarding_steps FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']) AND NOT is_system);

DROP TRIGGER IF EXISTS trg_onboarding_steps_touch ON public.space_onboarding_steps;
CREATE TRIGGER trg_onboarding_steps_touch
  BEFORE UPDATE ON public.space_onboarding_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
