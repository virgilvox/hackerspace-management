// Pure, dependency-free logic for the presence/attendance feature. No
// Supabase/React/Next. Unit-tested directly so the "who is present" and
// host-eligibility rules cannot silently drift.

// An open visit older than this is treated as a forgotten check-out: the
// member is no longer counted as present and the next check-in auto-closes
// it. Chosen over a cron job (no background infra, deterministic, testable).
export const PRESENCE_MAX_OPEN_HOURS = 18

export type PresenceState = 'present' | 'checked_out' | 'stale'

// `present`      = open and within the freshness window (currently here)
// `checked_out`  = explicitly checked out
// `stale`        = open but past the window (forgotten check-out; not present)
export function presenceStatus(
  checkedInAt: string,
  checkedOutAt: string | null | undefined,
  now?: Date | string,
  maxOpenHours: number = PRESENCE_MAX_OPEN_HOURS,
): PresenceState {
  if (checkedOutAt) return 'checked_out'
  const inMs = new Date(checkedInAt).getTime()
  if (Number.isNaN(inMs)) return 'stale'
  const t = now == null ? Date.now() : new Date(now).getTime()
  const ageHours = (t - inMs) / 3_600_000
  return ageHours >= maxOpenHours ? 'stale' : 'present'
}

export type HostEligibility = { ok: true } | { ok: false; reason: string }

// Checking in as a host may require an active access card on file, depending
// on the per-space `host_requires_card` setting (default true). A plain
// (non-host) check-in is always allowed.
export function hostEligibility(input: {
  asHost: boolean
  hasActiveCard: boolean
  hostRequiresCard: boolean
}): HostEligibility {
  if (!input.asHost) return { ok: true }
  if (input.hostRequiresCard && !input.hasActiveCard) {
    return {
      ok: false,
      reason:
        'Hosting requires an active access card on file. Ask a door manager to add one, or check in without hosting.',
    }
  }
  return { ok: true }
}

// Count how many visits are currently present, and how many of those are
// hosting. Stale/checked-out rows are excluded.
export function summarizePresence(
  rows: Array<{ checked_in_at: string; checked_out_at: string | null; is_host: boolean }>,
  now?: Date | string,
): { present: number; hosts: number } {
  let present = 0
  let hosts = 0
  for (const r of rows) {
    if (presenceStatus(r.checked_in_at, r.checked_out_at, now) === 'present') {
      present++
      if (r.is_host) hosts++
    }
  }
  return { present, hosts }
}
