// Pure, dependency-free decision logic for the classes feature. No Supabase,
// no React, no Next. Unit-tested directly so capacity/waitlist/eligibility
// rules cannot silently drift.

export type SignupOutcome = 'registered' | 'waitlisted'
export type SessionTiming = 'upcoming' | 'in_progress' | 'past'

// A session-level capacity overrides the class default; null at both levels
// means unlimited.
export function effectiveCapacity(
  sessionCapacity: number | null | undefined,
  classCapacity: number | null | undefined,
): number | null {
  if (sessionCapacity != null) return sessionCapacity
  if (classCapacity != null) return classCapacity
  return null
}

// Where a new signup lands given the effective capacity and how many are
// already registered (not counting waitlisted/cancelled).
export function computeSignupStatus(
  capacity: number | null,
  currentRegistered: number,
): SignupOutcome {
  if (capacity == null) return 'registered'
  return currentRegistered < capacity ? 'registered' : 'waitlisted'
}

function ms(value: string | null | undefined): number | null {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? null : t
}

export function sessionTiming(
  startsAt: string,
  endsAt: string | null | undefined,
  now?: Date | string,
): SessionTiming {
  const t = now == null ? Date.now() : new Date(now).getTime()
  const start = ms(startsAt)
  if (start == null) return 'upcoming'
  const end = ms(endsAt) ?? start
  if (t < start) return 'upcoming'
  if (t > end) return 'past'
  return 'in_progress'
}

export type SignupEligibility = { ok: true } | { ok: false; reason: string }

// Whether a member may newly sign up for a session.
export function canSignUp(input: {
  sessionStatus: string
  startsAt: string
  endsAt?: string | null
  now?: Date | string
}): SignupEligibility {
  if (input.sessionStatus === 'cancelled') return { ok: false, reason: 'This session was cancelled.' }
  if (input.sessionStatus === 'completed') return { ok: false, reason: 'This session is already completed.' }
  if (sessionTiming(input.startsAt, input.endsAt, input.now) === 'past') {
    return { ok: false, reason: 'This session has already ended.' }
  }
  return { ok: true }
}

// When a registered member cancels and a seat frees, the earliest-signed-up
// waitlisted member is promoted. Returns that signup id, or null if there is
// no free seat or no one waiting.
export function pickPromotion(
  signups: Array<{ id: string; status: string; signed_up_at: string }>,
  capacity: number | null,
): string | null {
  if (capacity == null) {
    // Unlimited: anyone waitlisted (shouldn't normally happen) can move up;
    // promote the earliest to be safe.
    const waiting = signups
      .filter(s => s.status === 'waitlisted')
      .sort((a, b) => a.signed_up_at.localeCompare(b.signed_up_at))
    return waiting[0]?.id ?? null
  }
  const registered = signups.filter(s => s.status === 'registered').length
  if (registered >= capacity) return null
  const waiting = signups
    .filter(s => s.status === 'waitlisted')
    .sort((a, b) => a.signed_up_at.localeCompare(b.signed_up_at))
  return waiting[0]?.id ?? null
}

export const SESSION_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

export const SIGNUP_STATUS_LABEL: Record<string, string> = {
  registered: 'Registered',
  waitlisted: 'Waitlisted',
  cancelled: 'Cancelled',
}
