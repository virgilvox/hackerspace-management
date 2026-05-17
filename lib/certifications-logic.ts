// Pure, dependency-free decision logic for the certifications feature.
// No Supabase, no React, no Next imports. Everything here is unit-tested
// directly so the expiry/active rules cannot silently drift.

export const EXPIRING_SOON_DAYS = 30

export type CertStatus = 'active' | 'expiring_soon' | 'expired' | 'revoked'

// Add a whole number of months to an ISO timestamp, clamping the day so that
// e.g. Jan 31 + 1 month is the last day of February rather than rolling into
// March. Returns an ISO string, or null when the cert type never expires
// (validityMonths null/undefined) or the inputs are unusable.
export function computeExpiry(
  grantedAtISO: string,
  validityMonths: number | null | undefined,
): string | null {
  if (validityMonths == null) return null
  if (!Number.isInteger(validityMonths) || validityMonths <= 0) return null
  const granted = new Date(grantedAtISO)
  if (Number.isNaN(granted.getTime())) return null

  const y = granted.getUTCFullYear()
  const m = granted.getUTCMonth()
  const d = granted.getUTCDate()

  const targetMonthIndex = m + validityMonths
  const targetYear = y + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12

  // Last day of the target month (day 0 of the next month).
  const lastDayOfTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const day = Math.min(d, lastDayOfTarget)

  const result = new Date(granted.getTime())
  result.setUTCFullYear(targetYear, targetMonth, day)
  return result.toISOString()
}

type GrantTimes = {
  revoked_at?: string | null
  expires_at?: string | null
}

function nowMs(now?: Date | string): number {
  if (now == null) return Date.now()
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime()
  return Number.isNaN(t) ? Date.now() : t
}

export function isCertificationActive(g: GrantTimes, now?: Date | string): boolean {
  if (g.revoked_at) return false
  if (!g.expires_at) return true
  const exp = new Date(g.expires_at).getTime()
  if (Number.isNaN(exp)) return true
  return exp > nowMs(now)
}

// Single source of truth for the badge a grant should show. Revoked always
// wins (even if also past expiry); then expired; then expiring-soon within
// EXPIRING_SOON_DAYS; otherwise active.
export function certificationStatus(g: GrantTimes, now?: Date | string): CertStatus {
  if (g.revoked_at) return 'revoked'
  if (!g.expires_at) return 'active'
  const exp = new Date(g.expires_at).getTime()
  if (Number.isNaN(exp)) return 'active'
  const t = nowMs(now)
  if (exp <= t) return 'expired'
  if (exp - t <= EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000) return 'expiring_soon'
  return 'active'
}

export const CERT_STATUS_LABEL: Record<CertStatus, string> = {
  active: 'Active',
  expiring_soon: 'Expiring soon',
  expired: 'Expired',
  revoked: 'Revoked',
}
