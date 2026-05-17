-- =============================================================================
-- 036: Door card slot allocation (Door epic, phase 3)
-- =============================================================================
-- A door controller may key cards by an integer "slot" (the verified
-- HeatSync/23b firmware uses slots 0-200: grant ?m<slot>..., revoke ?r<slot>).
-- The slot space is PER CONNECTION, not global: the same member_card pushed to
-- two controllers can occupy different slots on each. door_card_slots is the
-- platform's allocation map.
--
--   * One row = one card occupying one slot on one connection.
--   * UNIQUE (connection_id, slot)    -> the DB arbitrates concurrent grants
--     racing onto the same slot (the action retries on conflict).
--   * UNIQUE (connection_id, card_id) -> a card holds at most one slot per
--     controller, so re-granting is idempotent (no double-spend).
--   * The allocation policy (lowest free slot, range bounds) lives in pure
--     unit-tested logic (lib/door-slots-logic.ts), not in SQL, so it stays
--     adapter-generic (HeatSync passes 0-200; another slot controller can
--     pass its own range).
--
-- No new permission codes (door.manage / door.operate from migration 034).
-- RLS (additive, default-deny; the guarded surface):
--   * SELECT = door.manage OR door.operate (operators need to see/allocate).
--   * NO INSERT/UPDATE/DELETE policy: only the validated service-client
--     executor writes here, in lockstep with the controller call.
-- No anonymous path.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS then
-- CREATE.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.door_card_slots (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id      uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  connection_id uuid        NOT NULL REFERENCES public.door_connections(id) ON DELETE CASCADE,
  card_id       uuid        NOT NULL REFERENCES public.member_cards(id) ON DELETE CASCADE,
  slot          integer     NOT NULL CHECK (slot >= 0),
  created_by    uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_door_card_slots_slot ON public.door_card_slots (connection_id, slot);
CREATE UNIQUE INDEX IF NOT EXISTS idx_door_card_slots_card ON public.door_card_slots (connection_id, card_id);
CREATE INDEX IF NOT EXISTS        idx_door_card_slots_space ON public.door_card_slots (space_id);

ALTER TABLE public.door_card_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS door_card_slots_select ON public.door_card_slots;
CREATE POLICY door_card_slots_select ON public.door_card_slots FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'door.manage')
    OR public.user_has_permission(auth.uid(), space_id, 'door.operate')
  );
-- No INSERT/UPDATE/DELETE policy: the validated service-client executor is the
-- only writer, kept in lockstep with the physical controller.

DROP TRIGGER IF EXISTS trg_door_card_slots_touch ON public.door_card_slots;
CREATE TRIGGER trg_door_card_slots_touch
  BEFORE UPDATE ON public.door_card_slots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
