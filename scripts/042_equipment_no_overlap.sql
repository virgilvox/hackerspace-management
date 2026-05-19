-- =============================================================================
-- 042: Equipment reservation overlap — database-enforced (P0 fix)
-- =============================================================================
-- reserveEquipment() did a check-then-insert with no DB guard: two concurrent
-- requests both pass the in-memory overlap check and both insert, double-
-- booking a physical machine. A GiST exclusion constraint makes the database
-- the arbiter. Only 'reserved' rows conflict (cancelled/completed do not).
-- btree_gist provides the `uuid WITH =` operator class for the composite.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS then ADD (ADD CONSTRAINT has no
-- IF NOT EXISTS form).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.equipment_reservations
  DROP CONSTRAINT IF EXISTS equipment_reservations_no_overlap;
ALTER TABLE public.equipment_reservations
  ADD CONSTRAINT equipment_reservations_no_overlap
  EXCLUDE USING gist (
    equipment_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status = 'reserved');
