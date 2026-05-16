-- =============================================================================
-- 026: Custom forms and waivers (Phase 1 — schema + RLS only)
-- =============================================================================
-- Two tables:
--
--   forms             a per-space form/waiver definition with a globally
--                     unique public slug, a jsonb field schema, optional
--                     legal text, a version counter, and a lifecycle status.
--   form_submissions  an append-only record of a single submission. It
--                     snapshots the form schema, legal text, and version at
--                     submit time so a waiver stays valid against exactly what
--                     the signer saw, regardless of later edits.
--
-- RLS posture (this is the security-sensitive part, kept additive and
-- default-deny):
--
--   * forms SELECT: forms.manage holders see every form in the space; ordinary
--     members see only published ones (drafts/closed are not exposed to
--     non-managers). The public unauthenticated /f/[slug] page does NOT read
--     this table directly; it is served by a server action using the service
--     client, so the anon Postgres role gets no grant here.
--   * forms INSERT/UPDATE/DELETE: user_has_permission(..., 'forms.manage').
--     Additive — with no space_role_permissions rows, only admin (implicit-all)
--     can manage, which is the pre-feature behavior.
--   * form_submissions SELECT: user_has_permission(..., 'forms.manage') only.
--     Anonymous clients can never read submissions.
--   * form_submissions has NO INSERT/UPDATE/DELETE policy. With RLS enabled
--     that is a hard default-deny for every normal client. Every submission
--     (anon, public-auth, members) is written by one validated server action
--     using the service client (which bypasses RLS) AFTER server-side schema
--     validation and snapshotting. The absence of an UPDATE/DELETE policy also
--     makes submissions immutable for everyone except the service role, which
--     is the waiver-record guarantee enforced at the storage layer.
--
-- forms.manage is a new code in lib/permissions-catalog.ts. This migration
-- extends seed_default_role_permissions() so new spaces seed it to board, and
-- backfills board -> forms.manage for every existing space.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DROP POLICY IF EXISTS then CREATE, CREATE OR REPLACE FUNCTION, and an
-- ON CONFLICT DO NOTHING backfill.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.forms (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  slug        text        NOT NULL UNIQUE
                          CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
                                 AND char_length(slug) BETWEEN 1 AND 80),
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text,
  kind        text        NOT NULL DEFAULT 'form'
                          CHECK (kind IN ('form','waiver')),
  visibility  text        NOT NULL DEFAULT 'members'
                          CHECK (visibility IN ('public_anon','public_auth','members')),
  status      text        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','published','closed')),
  schema      jsonb       NOT NULL DEFAULT '[]',
  legal_text  text,
  version     integer     NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by  uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- slug already has a UNIQUE btree index from the column constraint; no extra
-- index on slug is needed.
CREATE INDEX IF NOT EXISTS idx_forms_space  ON public.forms (space_id, status);

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id            uuid        NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  space_id           uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id          uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  submitter_email    text,
  answers            jsonb       NOT NULL DEFAULT '{}',
  form_snapshot      jsonb       NOT NULL,
  legal_text_snapshot text,
  form_version       integer     NOT NULL,
  ip                 inet,
  user_agent         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form  ON public.form_submissions (form_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_space ON public.form_submissions (space_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_email ON public.form_submissions (submitter_email) WHERE submitter_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_submissions_member ON public.form_submissions (member_id) WHERE member_id IS NOT NULL;

ALTER TABLE public.forms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forms_select ON public.forms;
DROP POLICY IF EXISTS forms_insert ON public.forms;
DROP POLICY IF EXISTS forms_update ON public.forms;
DROP POLICY IF EXISTS forms_delete ON public.forms;
-- Managers (forms.manage) see every form in the space; ordinary members see
-- only published ones. Drafts/closed forms are not exposed to non-managers via
-- raw PostgREST. anon (auth.uid() NULL) matches neither branch.
CREATE POLICY forms_select ON public.forms FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'forms.manage')
    OR (
      space_id IN (SELECT public.get_user_space_ids(auth.uid()))
      AND status = 'published'
    )
  );
CREATE POLICY forms_insert ON public.forms FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'forms.manage'));
CREATE POLICY forms_update ON public.forms FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'forms.manage'));
CREATE POLICY forms_delete ON public.forms FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'forms.manage'));

-- SELECT only. No INSERT/UPDATE/DELETE policy is intentional: with RLS enabled
-- that denies every non-service client, which both funnels all writes through
-- the validated service-client server action and makes submissions immutable.
DROP POLICY IF EXISTS form_submissions_select ON public.form_submissions;
CREATE POLICY form_submissions_select ON public.form_submissions FOR SELECT
  USING (public.user_has_permission(auth.uid(), space_id, 'forms.manage'));

DROP TRIGGER IF EXISTS trg_forms_touch ON public.forms;
CREATE TRIGGER trg_forms_touch
  BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Extend the per-space default-permission seed with forms.manage for board.
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
    ('board','customize.manage'),('board','settings.manage'),
    ('treasurer','payments.manage'),('treasurer','ops.kb.read'),('treasurer','ops.process.read'),
    ('member','ops.kb.read'),('member','ops.process.read'),
    ('associate','ops.kb.read')
  ) AS d(subject, permission)
  ON CONFLICT (space_id, subject, permission) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill the new grant for spaces that already exist.
INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'forms.manage' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;
