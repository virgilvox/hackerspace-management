-- =============================================================================
-- 033: Equipment registry + reservations
-- =============================================================================
-- Two tables:
--
--   equipment              a per-space tool/equipment record: name,
--                          description, location, operational status
--                          (available/maintenance/retired), optional
--                          required_certification_id (reserving a cert-gated
--                          tool requires the member hold that certification),
--                          asset_tag, is_active archive flag.
--   equipment_reservations a member's time-window reservation of one piece of
--                          equipment (reserved/cancelled/completed).
--                          space_id is denormalized for RLS without a join.
--                          Active reservations for the same equipment may not
--                          overlap (enforced in the validated action).
--
-- One new permission code (lib/permissions-catalog.ts, group "Equipment"):
--
--   equipment.manage  registry CRUD, status/maintenance, and adjusting or
--                     cancelling any reservation (the override).
--
-- Reserving needs no permission, only space membership: it is gated by the
-- equipment being available and, when set, by the member holding the
-- required certification (manager override allowed). The cert check uses the
-- normal certifications data; no service-role bypass of that surface.
--
-- RLS posture (additive, default-deny; the guarded surface):
--
--   * equipment SELECT: equipment.manage holders see all; ordinary members
--     see only is_active (mirrors classes_select). Writes: equipment.manage.
--   * equipment_reservations SELECT: equipment.manage (all in space) or the
--     member (own). UPDATE: equipment.manage. NO INSERT/DELETE policy:
--     reserve/cancel funnels through one validated service-client action
--     that enforces status, the no-overlap rule and the required-cert gate
--     (same pattern as class_signups / form_submissions). No anonymous path.
--
-- Extends seed_default_role_permissions() so new spaces seed the code to
-- board, and backfills board -> equipment.manage for existing spaces.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS then
-- CREATE, CREATE OR REPLACE FUNCTION, ON CONFLICT DO NOTHING backfill.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.equipment (
  id                       uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id                 uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name                     text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description              text,
  location                 text,
  status                   text        NOT NULL DEFAULT 'available'
                                       CHECK (status IN ('available','maintenance','retired')),
  required_certification_id uuid       REFERENCES public.certifications(id) ON DELETE SET NULL,
  asset_tag                text,
  is_active                boolean     NOT NULL DEFAULT true,
  created_by               uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipment_space ON public.equipment (space_id, is_active);

CREATE TABLE IF NOT EXISTS public.equipment_reservations (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid        NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  space_id     uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id    uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL CHECK (ends_at > starts_at),
  status       text        NOT NULL DEFAULT 'reserved'
                           CHECK (status IN ('reserved','cancelled','completed')),
  notes        text,
  created_by   uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipment_res_space     ON public.equipment_reservations (space_id);
CREATE INDEX IF NOT EXISTS idx_equipment_res_equipment ON public.equipment_reservations (equipment_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_equipment_res_member    ON public.equipment_reservations (member_id);

ALTER TABLE public.equipment              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_select ON public.equipment;
DROP POLICY IF EXISTS equipment_insert ON public.equipment;
DROP POLICY IF EXISTS equipment_update ON public.equipment;
DROP POLICY IF EXISTS equipment_delete ON public.equipment;
CREATE POLICY equipment_select ON public.equipment FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'equipment.manage')
    OR (
      space_id IN (SELECT public.get_user_space_ids(auth.uid()))
      AND is_active
    )
  );
CREATE POLICY equipment_insert ON public.equipment FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'equipment.manage'));
CREATE POLICY equipment_update ON public.equipment FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'equipment.manage'));
CREATE POLICY equipment_delete ON public.equipment FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'equipment.manage'));

DROP POLICY IF EXISTS equipment_reservations_select ON public.equipment_reservations;
DROP POLICY IF EXISTS equipment_reservations_update ON public.equipment_reservations;
CREATE POLICY equipment_reservations_select ON public.equipment_reservations FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'equipment.manage')
    OR member_id IN (
      SELECT id FROM public.space_members
      WHERE user_id = auth.uid() AND space_id = equipment_reservations.space_id
    )
  );
CREATE POLICY equipment_reservations_update ON public.equipment_reservations FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'equipment.manage'));
-- No INSERT/DELETE policy: reserve/cancel via a validated service-client action.

DROP TRIGGER IF EXISTS trg_equipment_touch ON public.equipment;
CREATE TRIGGER trg_equipment_touch
  BEFORE UPDATE ON public.equipment
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
    ('board','equipment.manage'),
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
SELECT id, 'board', 'equipment.manage' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;
