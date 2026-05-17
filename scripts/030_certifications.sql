-- =============================================================================
-- 030: Certifications + Instructor capability
-- =============================================================================
-- Two tables:
--
--   certifications         a per-space certification *type* (e.g. "Laser
--                          Cutter", "Forklift"). Optional validity_months: if
--                          set, a grant expires that many months after it is
--                          awarded; null = never expires.
--   member_certifications  a single award of a certification to a member.
--                          expires_at is computed and stored AT GRANT TIME
--                          from the cert's validity_months, so later edits to
--                          the cert type never retroactively change an
--                          existing grant's expiry (audit stability, same
--                          spirit as the forms snapshot). A grant is never
--                          hard-deleted by clients: revoking sets revoked_at
--                          (soft revoke) so the safety record is preserved.
--
-- Two new permission codes (lib/permissions-catalog.ts, group "Certifications"):
--
--   certifications.manage  create/edit/archive certification *types*.
--   certifications.grant   award/revoke a certification to a member. This code
--                          IS the "Instructor" capability: it is assignable to
--                          any role or area-lead through the existing additive
--                          space_role_permissions model. No new built-in role.
--
-- RLS posture (additive, default-deny; the guarded surface):
--
--   * certifications SELECT: any member of the space (members need to see
--     which certs exist; managers are members too). anon (auth.uid() NULL)
--     matches nothing.
--   * certifications INSERT/UPDATE/DELETE: certifications.manage. Additive:
--     with no space_role_permissions rows only admin (implicit-all) manages,
--     which is the pre-feature behavior.
--   * member_certifications SELECT: a manager (certifications.manage) or a
--     granter (certifications.grant) sees every grant in the space; a member
--     sees their OWN grants. No cross-tenant exposure (space_id scoped).
--   * member_certifications INSERT/UPDATE: certifications.grant. UPDATE is how
--     a revoke or a renew is written.
--   * member_certifications has NO DELETE policy. With RLS enabled that hard-
--     denies deletes for every non-service client, so a grant/revoke history
--     is immutable at the storage layer (same stance as form_submissions).
--     FK ON DELETE CASCADE from space_members / certifications still works:
--     cascades run at the engine level, independent of RLS.
--
-- There is intentionally NO anonymous path here (unlike forms). All writes go
-- through certifications.grant holders; nothing is world-readable.
--
-- This migration extends seed_default_role_permissions() so new spaces seed
-- both new codes to board, and backfills board -> both for existing spaces.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS then
-- CREATE, CREATE OR REPLACE FUNCTION, ON CONFLICT DO NOTHING backfill.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.certifications (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id        uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name            text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description     text,
  validity_months integer     CHECK (validity_months IS NULL OR validity_months > 0),
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- One certification type per name per space, case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS idx_certifications_space_name
  ON public.certifications (space_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_certifications_space
  ON public.certifications (space_id, is_active);

CREATE TABLE IF NOT EXISTS public.member_certifications (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id         uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id        uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  certification_id uuid        NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
  granted_by       uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  granted_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,
  revoked_at       timestamptz,
  revoked_by       uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  revoked_reason   text,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- At most one ACTIVE (non-revoked) grant of a given cert to a given member.
-- Revoked rows stay as history and a re-grant is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_certifications_active
  ON public.member_certifications (member_id, certification_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_member_certifications_space
  ON public.member_certifications (space_id);
CREATE INDEX IF NOT EXISTS idx_member_certifications_member
  ON public.member_certifications (member_id);
CREATE INDEX IF NOT EXISTS idx_member_certifications_cert
  ON public.member_certifications (certification_id);

ALTER TABLE public.certifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS certifications_select ON public.certifications;
DROP POLICY IF EXISTS certifications_insert ON public.certifications;
DROP POLICY IF EXISTS certifications_update ON public.certifications;
DROP POLICY IF EXISTS certifications_delete ON public.certifications;
CREATE POLICY certifications_select ON public.certifications FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY certifications_insert ON public.certifications FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'certifications.manage'));
CREATE POLICY certifications_update ON public.certifications FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'certifications.manage'));
CREATE POLICY certifications_delete ON public.certifications FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'certifications.manage'));

DROP POLICY IF EXISTS member_certifications_select ON public.member_certifications;
DROP POLICY IF EXISTS member_certifications_insert ON public.member_certifications;
DROP POLICY IF EXISTS member_certifications_update ON public.member_certifications;
-- Managers and granters see all grants in the space; a member sees their own.
CREATE POLICY member_certifications_select ON public.member_certifications FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'certifications.manage')
    OR public.user_has_permission(auth.uid(), space_id, 'certifications.grant')
    OR member_id IN (
      SELECT id FROM public.space_members
      WHERE user_id = auth.uid() AND space_id = member_certifications.space_id
    )
  );
CREATE POLICY member_certifications_insert ON public.member_certifications FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'certifications.grant'));
CREATE POLICY member_certifications_update ON public.member_certifications FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'certifications.grant'));
-- No DELETE policy: grants/revocations are immutable to non-service clients.

DROP TRIGGER IF EXISTS trg_certifications_touch ON public.certifications;
CREATE TRIGGER trg_certifications_touch
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Extend the per-space default-permission seed with the two new codes.
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
    ('board','customize.manage'),('board','settings.manage'),
    ('treasurer','payments.manage'),('treasurer','ops.kb.read'),('treasurer','ops.process.read'),
    ('member','ops.kb.read'),('member','ops.process.read'),
    ('associate','ops.kb.read')
  ) AS d(subject, permission)
  ON CONFLICT (space_id, subject, permission) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill the new grants for spaces that already exist.
INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'certifications.manage' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;
INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'certifications.grant' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;
