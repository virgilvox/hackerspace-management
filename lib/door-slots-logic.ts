// Pure, dependency-free slot allocation for the Door epic. No Supabase/React.
// Some controllers key cards by an integer "slot" (the verified HeatSync/23b
// firmware: 0-200). The slot space is per door connection. This decides which
// slot a newly granted card should take; the action layer holds the actual
// allocation state (door_card_slots) and the DB unique constraint arbitrates
// concurrent grants. Kept adapter-generic: the range is a parameter, not a
// HeatSync constant, even though HeatSync is the first caller.

// Default range matches the HeatSync firmware (slots 0-200 inclusive, 201
// usable). The user chose the full range with no reserved slots.
export const HEATSYNC_SLOT_MIN = 0
export const HEATSYNC_SLOT_MAX = 200

export type SlotPick =
  | { ok: true; slot: number }
  | { ok: false; reason: 'slot_exhausted' }

// Lowest free slot first: deterministic (testable), compact, and predictable
// for an admin reading the controller's user list. `used` may contain
// duplicates or out-of-range values; both are ignored.
export function pickLowestFreeSlot(
  used: number[],
  min: number = HEATSYNC_SLOT_MIN,
  max: number = HEATSYNC_SLOT_MAX,
): SlotPick {
  const taken = new Set<number>()
  for (const n of used) {
    if (Number.isInteger(n)) taken.add(n)
  }
  for (let slot = min; slot <= max; slot++) {
    if (!taken.has(slot)) return { ok: true, slot }
  }
  return { ok: false, reason: 'slot_exhausted' }
}

// Total addressable slots for a range, for capacity messaging
// ("controller is full, 201/201 slots used").
export function slotCapacity(
  min: number = HEATSYNC_SLOT_MIN,
  max: number = HEATSYNC_SLOT_MAX,
): number {
  return max < min ? 0 : max - min + 1
}
