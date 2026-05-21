-- =============================================================================
-- 054: Universal API-call UI builder (Door epic, phase 5)
-- =============================================================================
-- Admins (door.manage, which the catalog already scopes to "door integrations,
-- buttons, and member cards") define named buttons that, when pressed by an
-- authorized member, fire a configured HTTP call through the SAME hardened
-- egress as the door executor (per-button pinned_host SSRF pin, always-block
-- metadata/link-local, resolve-once-then-connect-by-IP, no redirects, time/body
-- caps, secret from the AES vault injected server-side, redacted audit).
--
-- Authorization (the user-chosen model): managing buttons = door.manage; each
-- button carries its own required_permission (any catalog code, default the new
-- generic apicall.invoke) and a member may press only buttons whose permission
-- they hold. One new permission code, additive + backfilled exactly like the
-- door.* codes in 034: apicall.invoke (group Access). Manage stays door.manage.
--
--   api_buttons   per-space button definition. The secret (if any) is NOT
--                 stored here: secret_ref -> the AES-256-GCM secrets vault,
--                 decrypted server-side only. RLS: all CRUD = door.manage
--                 (members get a curated list via a service-client action that
--                 filters by each button's required_permission).
--   api_call_log  append-only audit of every press (who/what/result), secrets
--                 redacted before write. SELECT = door.manage; NO client write
--                 policy (validated service-client invoker only; immutable).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS then
-- CREATE, CREATE OR REPLACE the seed function, ON CONFLICT DO NOTHING backfill.
-- =============================================================================

-- 1) New permission code seeded for new spaces (CREATE OR REPLACE the seeder).
CREATE OR REPLACE FUNCTION public.seed_default_role_permissions()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.space_role_permissions (space_id, subject, permission)
  SELECT NEW.id, d.subject, d.permission
  FROM (VALUES
    ('board','ops.kb.read'),('board','ops.kb.write'),('board','ops.process.read'),
    ('board','ops.process.write'),('board','ops.secrets.read'),('board','ops.secrets.write'),
    ('board','ops.arealeads.manage'),('board','members.manage'),('board','payments.manage'),
    ('board','governance.manage'),('board','forum.moderate'),('board','forms.manage'),
    ('board','certifications.manage'),('board','certifications.grant'),
    ('board','classes.manage'),('board','classes.instruct'),
    ('board','equipment.manage'),
    ('board','door.manage'),('board','door.operate'),('board','apicall.invoke'),
    ('board','customize.manage'),('board','settings.manage'),
    ('treasurer','payments.manage'),('treasurer','ops.kb.read'),('treasurer','ops.process.read'),
    ('member','ops.kb.read'),('member','ops.process.read'),
    ('associate','ops.kb.read')
  ) AS d(subject, permission)
  ON CONFLICT (space_id, subject, permission) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2) Backfill existing spaces (board gets apicall.invoke; admin holds it
--    implicitly and is never stored).
INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'apicall.invoke' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;

-- 3) Tables.
CREATE TABLE IF NOT EXISTS public.api_buttons (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id            uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  label               text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  button_group        text        NOT NULL DEFAULT 'General' CHECK (char_length(button_group) BETWEEN 1 AND 60),
  sort_order          integer     NOT NULL DEFAULT 0,
  method              text        NOT NULL DEFAULT 'POST'
                                  CHECK (method IN ('GET','POST','PUT','PATCH','DELETE')),
  base_url            text        NOT NULL CHECK (base_url ~ '^https?://'),
  pinned_host         text        NOT NULL CHECK (char_length(pinned_host) BETWEEN 1 AND 255),
  url_template        text,
  headers             jsonb       NOT NULL DEFAULT '{}',
  body_template       text,
  auth_mode           text        NOT NULL DEFAULT 'none'
                                  CHECK (auth_mode IN ('none','query','header','bearer')),
  auth_param          text,
  secret_ref          uuid        REFERENCES public.secrets(id) ON DELETE SET NULL,
  required_permission text        NOT NULL DEFAULT 'apicall.invoke'
                                  CHECK (char_length(required_permission) BETWEEN 1 AND 60),
  confirm             boolean     NOT NULL DEFAULT true,
  is_enabled          boolean     NOT NULL DEFAULT true,
  created_by          uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_buttons_space ON public.api_buttons (space_id, button_group, sort_order);

CREATE TABLE IF NOT EXISTS public.api_call_log (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id         uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  button_id        uuid        REFERENCES public.api_buttons(id) ON DELETE SET NULL,
  actor_member_id  uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  action           text        NOT NULL,
  success          boolean     NOT NULL DEFAULT false,
  detail           text,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_call_log_space ON public.api_call_log (space_id, occurred_at DESC);

ALTER TABLE public.api_buttons  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_call_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_buttons_select ON public.api_buttons;
DROP POLICY IF EXISTS api_buttons_insert ON public.api_buttons;
DROP POLICY IF EXISTS api_buttons_update ON public.api_buttons;
DROP POLICY IF EXISTS api_buttons_delete ON public.api_buttons;
CREATE POLICY api_buttons_select ON public.api_buttons FOR SELECT
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY api_buttons_insert ON public.api_buttons FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY api_buttons_update ON public.api_buttons FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY api_buttons_delete ON public.api_buttons FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));

DROP POLICY IF EXISTS api_call_log_select ON public.api_call_log;
CREATE POLICY api_call_log_select ON public.api_call_log FOR SELECT
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
-- No INSERT/UPDATE/DELETE policy: the validated service-client invoker is the
-- only writer, and the audit trail is immutable.

DROP TRIGGER IF EXISTS trg_api_buttons_touch ON public.api_buttons;
CREATE TRIGGER trg_api_buttons_touch
  BEFORE UPDATE ON public.api_buttons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
