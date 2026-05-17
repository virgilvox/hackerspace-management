-- =============================================================================
-- 034: Member access cards + door permissions (Door epic, phase 1)
-- =============================================================================
-- member_cards associates an RFID/NFC card UID with a member. The card UID is
-- a physical-access CREDENTIAL: it is treated like a secret. RLS exposes the
-- table only to door.manage holders; the owning member never reads the raw
-- UID through PostgREST -- a member's "my cards" view is served by a server
-- action that returns only a count and the last 4 characters.
--
-- Two new permission codes (lib/permissions-catalog.ts, group "Access"),
-- introduced now because the whole Door epic uses them:
--
--   door.manage   configure door connections + the API-call buttons, and
--                 manage member cards.
--   door.operate  perform live actions (open/lock/unlock, push/revoke a
--                  card, run a configured button). The Host/Champion
--                  capability.
--
-- Both are assignable to any role via the existing additive model (NOT new
-- built-in roles), seeded to board and backfilled for existing spaces.
--
-- RLS posture (additive, default-deny; the guarded surface):
--
--   * member_cards SELECT/INSERT/UPDATE/DELETE: door.manage only. There is
--     deliberately no member-facing SELECT policy -- the raw UID is a
--     credential. The masked self-view goes through a validated server
--     action using the service client.
--
-- No anonymous path. No controller calls in this phase.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS then
-- CREATE, CREATE OR REPLACE FUNCTION, ON CONFLICT DO NOTHING backfill.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.member_cards (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id   uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  member_id  uuid        NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  card_uid   text        NOT NULL CHECK (char_length(card_uid) BETWEEN 1 AND 200),
  card_type  text        NOT NULL DEFAULT 'rfid' CHECK (card_type IN ('rfid','nfc')),
  label      text,
  is_active  boolean     NOT NULL DEFAULT true,
  created_by uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- A physical card UID maps to at most one record per space.
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_cards_uid    ON public.member_cards (space_id, card_uid);
CREATE INDEX IF NOT EXISTS        idx_member_cards_space  ON public.member_cards (space_id);
CREATE INDEX IF NOT EXISTS        idx_member_cards_member ON public.member_cards (member_id);

ALTER TABLE public.member_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_cards_select ON public.member_cards;
DROP POLICY IF EXISTS member_cards_insert ON public.member_cards;
DROP POLICY IF EXISTS member_cards_update ON public.member_cards;
DROP POLICY IF EXISTS member_cards_delete ON public.member_cards;
CREATE POLICY member_cards_select ON public.member_cards FOR SELECT
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY member_cards_insert ON public.member_cards FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY member_cards_update ON public.member_cards FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY member_cards_delete ON public.member_cards FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));

DROP TRIGGER IF EXISTS trg_member_cards_touch ON public.member_cards;
CREATE TRIGGER trg_member_cards_touch
  BEFORE UPDATE ON public.member_cards
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
    ('board','door.manage'),('board','door.operate'),
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
SELECT id, 'board', 'door.manage' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;
INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT id, 'board', 'door.operate' FROM public.spaces
ON CONFLICT (space_id, subject, permission) DO NOTHING;
