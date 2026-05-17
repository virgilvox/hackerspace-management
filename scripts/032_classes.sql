-- =============================================================================
-- 032: Classes (offerings, scheduled sessions, member signups)
-- =============================================================================
-- Three tables:
--
--   classes        a per-space class offering: title, description, an
--                  optional generic payment_link (no live payment
--                  integration; manual link only), an optional default
--                  capacity, an is_active archive flag, and an optional
--                  grants_certification_id so completing the class can award
--                  a certification (module 030).
--   class_sessions a scheduled occurrence of a class (starts/ends, location,
--                  capacity override, status scheduled/cancelled/completed).
--                  space_id is denormalized for RLS without a join.
--   class_signups  a member's signup for a session (registered/waitlisted/
--                  cancelled, attended). space_id denormalized. A partial
--                  unique index allows one non-cancelled signup per member
--                  per session (re-signup after cancel is allowed).
--
-- Two new permission codes (lib/permissions-catalog.ts, group "Classes"):
--
--   classes.manage    create/edit/archive classes; schedule/cancel sessions.
--   classes.instruct  run a class: mark attendance, complete a session, see
--                     the attendee list.
--
-- Member signup needs no permission, only space membership (same stance as
-- forms/onboarding). Cert-on-completion is issued through the normal
-- certifications path and therefore still requires the acting instructor to
-- hold certifications.grant; the application skips the award (and says so)
-- when they do not. No service-role bypass of the guarded certifications
-- surface.
--
-- RLS posture (additive, default-deny; the guarded surface):
--
--   * classes SELECT: classes.manage holders see all; ordinary members see
--     only is_active (mirrors forms_select). Writes: classes.manage.
--   * class_sessions SELECT: any space member (the schedule is not
--     sensitive; the UI filters cancelled/past). Writes: classes.manage.
--   * class_signups SELECT: classes.manage OR classes.instruct (all in
--     space) OR the member (own rows). UPDATE: classes.instruct (attendance
--     / status). NO INSERT or DELETE policy: member signup/cancel funnels
--     through one validated service-client server action that enforces
--     capacity, waitlisting and de-duplication (same pattern as
--     form_submissions / finishOnboarding). Nothing here is world-writable
--     and there is no anonymous path.
--
-- Extends seed_default_role_permissions() so new spaces seed both codes to
-- board, and backfills board -> both for existing spaces.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS then
-- CREATE, CREATE OR REPLACE FUNCTION, ON CONFLICT DO NOTHING backfill.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.classes (
  id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id                uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title                   text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description             text,
  payment_link            text        CHECK (payment_link IS NULL OR payment_link ~ '^https?://'),
  capacity                integer     CHECK (capacity IS NULL OR capacity > 0),
  is_active               boolean     NOT NULL DEFAULT true,
  grants_certification_id uuid        REFERENCES public.certifications(id) ON DELETE SET NULL,
  created_by              uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_classes_space ON public.classes (space_id, is_active);

CREATE TABLE IF NOT EXISTS public.class_sessions (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id   uuid        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  space_id   uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz CHECK (ends_at IS NULL OR ends_at >= starts_at),
  location   text,
  capacity   integer     CHECK (capacity IS NULL OR capacity > 0),
  status     text        NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','cancelled','completed')),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_sessions_space ON public.class_sessions (space_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class ON public.class_sessions (class_id);

CREATE TABLE IF NOT EXISTS public.class_signups (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   uuid        NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  space_id     uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id    uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'registered'
                           CHECK (status IN ('registered','waitlisted','cancelled')),
  attended     boolean     NOT NULL DEFAULT false,
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- One active (non-cancelled) signup per member per session; a cancelled row
-- stays as history and a re-signup is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_signups_active
  ON public.class_signups (session_id, member_id)
  WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_class_signups_space   ON public.class_signups (space_id);
CREATE INDEX IF NOT EXISTS idx_class_signups_session ON public.class_signups (session_id);
CREATE INDEX IF NOT EXISTS idx_class_signups_member  ON public.class_signups (member_id);

ALTER TABLE public.classes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_signups  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classes_select ON public.classes;
DROP POLICY IF EXISTS classes_insert ON public.classes;
DROP POLICY IF EXISTS classes_update ON public.classes;
DROP POLICY IF EXISTS classes_delete ON public.classes;
CREATE POLICY classes_select ON public.classes FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'classes.manage')
    OR (
      space_id IN (SELECT public.get_user_space_ids(auth.uid()))
      AND is_active
    )
  );
CREATE POLICY classes_insert ON public.classes FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));
CREATE POLICY classes_update ON public.classes FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));
CREATE POLICY classes_delete ON public.classes FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));

DROP POLICY IF EXISTS class_sessions_select ON public.class_sessions;
DROP POLICY IF EXISTS class_sessions_insert ON public.class_sessions;
DROP POLICY IF EXISTS class_sessions_update ON public.class_sessions;
DROP POLICY IF EXISTS class_sessions_delete ON public.class_sessions;
CREATE POLICY class_sessions_select ON public.class_sessions FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY class_sessions_insert ON public.class_sessions FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));
CREATE POLICY class_sessions_update ON public.class_sessions FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));
CREATE POLICY class_sessions_delete ON public.class_sessions FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'classes.manage'));

DROP POLICY IF EXISTS class_signups_select ON public.class_signups;
DROP POLICY IF EXISTS class_signups_update ON public.class_signups;
CREATE POLICY class_signups_select ON public.class_signups FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'classes.manage')
    OR public.user_has_permission(auth.uid(), space_id, 'classes.instruct')
    OR member_id IN (
      SELECT id FROM public.space_members
      WHERE user_id = auth.uid() AND space_id = class_signups.space_id
    )
  );
CREATE POLICY class_signups_update ON public.class_signups FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'classes.instruct'));
-- No INSERT/DELETE policy: member signup/cancel goes through one validated
-- service-client server action (capacity/waitlist/dedupe enforced there).

DROP TRIGGER IF EXISTS trg_classes_touch ON public.classes;
CREATE TRIGGER trg_classes_touch
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_class_sessions_touch ON public.class_sessions;
CREATE TRIGGER trg_class_sessions_touch
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

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
    ('board','customize.manage'),('board','settings.manage'),
    ('treasurer','payments.manage'),('treasurer','ops.kb.read'),('treasurer','ops.process.read'),
    ('member','ops.kb.read'),('member','ops.process.read'),
    ('associate','ops.kb.read')
  ) AS d(subject, permission)
  ON CONFLICT (space_id, subject, permission) DO NOTHING;
  RETURN NEW;
END;
$$;

INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'classes.manage' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;
INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'classes.instruct' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;
