// Pure, dependency-free decision logic for the equipment feature. No
// Supabase, no React, no Next. Unit-tested directly so the overlap and
// reservation-eligibility rules cannot silently drift.

function ms(value: string): number | null {
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? null : t
}

// Half-open [start, end): two windows overlap iff each starts before the
// other ends. Touching end-to-start (a.end === b.start) does NOT overlap.
export function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const as = ms(aStart)
  const ae = ms(aEnd)
  const bs = ms(bStart)
  const be = ms(bEnd)
  if (as == null || ae == null || bs == null || be == null) return false
  return as < be && bs < ae
}

// Does a requested window conflict with any blocking reservation? Only
// 'reserved' rows block; 'cancelled' and 'completed' never do.
export function hasConflict(
  reqStart: string,
  reqEnd: string,
  existing: Array<{ starts_at: string; ends_at: string; status: string }>,
): boolean {
  return existing.some(
    r =>
      r.status === 'reserved' &&
      intervalsOverlap(reqStart, reqEnd, r.starts_at, r.ends_at),
  )
}

export type ReservationEligibility = { ok: true } | { ok: false; reason: string }

// Whether a reservation may be created. managerOverride bypasses only the
// required-certification gate (and is also how a manager books on someone
// else's behalf); it does NOT override an operational status block.
export function reservationEligibility(input: {
  equipmentStatus: string
  equipmentActive: boolean
  startsAt: string
  endsAt: string
  now?: Date | string
  conflict: boolean
  requiresCert: boolean
  memberHasCert: boolean
  managerOverride: boolean
}): ReservationEligibility {
  if (!input.equipmentActive) return { ok: false, reason: 'This equipment is archived.' }
  if (input.equipmentStatus === 'retired') return { ok: false, reason: 'This equipment is retired.' }
  if (input.equipmentStatus === 'maintenance') {
    return { ok: false, reason: 'This equipment is under maintenance and cannot be reserved.' }
  }
  if (input.equipmentStatus !== 'available') {
    return { ok: false, reason: 'This equipment is not available.' }
  }

  const start = ms(input.startsAt)
  const end = ms(input.endsAt)
  if (start == null || end == null) return { ok: false, reason: 'Invalid reservation time.' }
  if (end <= start) return { ok: false, reason: 'The end time must be after the start time.' }
  const t = input.now == null ? Date.now() : new Date(input.now).getTime()
  if (start < t) return { ok: false, reason: 'The reservation cannot start in the past.' }

  if (input.conflict) {
    return { ok: false, reason: 'That time overlaps an existing reservation for this equipment.' }
  }
  if (input.requiresCert && !input.memberHasCert && !input.managerOverride) {
    return { ok: false, reason: 'You are not certified to reserve this equipment.' }
  }
  return { ok: true }
}

export const EQUIPMENT_STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  maintenance: 'Under maintenance',
  retired: 'Retired',
}

export const RESERVATION_STATUS_LABEL: Record<string, string> = {
  reserved: 'Reserved',
  cancelled: 'Cancelled',
  completed: 'Completed',
}
