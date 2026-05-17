import { describe, it, expect } from 'vitest'
import {
  computeExpiry,
  isCertificationActive,
  certificationStatus,
  EXPIRING_SOON_DAYS,
} from '@/lib/certifications-logic'

describe('computeExpiry', () => {
  it('returns null when the cert never expires', () => {
    expect(computeExpiry('2026-05-16T00:00:00.000Z', null)).toBeNull()
    expect(computeExpiry('2026-05-16T00:00:00.000Z', undefined)).toBeNull()
  })

  it('returns null for non-positive or non-integer validity', () => {
    expect(computeExpiry('2026-05-16T00:00:00.000Z', 0)).toBeNull()
    expect(computeExpiry('2026-05-16T00:00:00.000Z', -3)).toBeNull()
    expect(computeExpiry('2026-05-16T00:00:00.000Z', 1.5)).toBeNull()
  })

  it('returns null for an unparseable grant date', () => {
    expect(computeExpiry('not-a-date', 12)).toBeNull()
  })

  it('adds whole months', () => {
    expect(computeExpiry('2026-01-15T00:00:00.000Z', 1)).toBe('2026-02-15T00:00:00.000Z')
    expect(computeExpiry('2026-01-15T00:00:00.000Z', 12)).toBe('2027-01-15T00:00:00.000Z')
  })

  it('rolls the year over correctly', () => {
    expect(computeExpiry('2026-11-10T00:00:00.000Z', 3)).toBe('2027-02-10T00:00:00.000Z')
  })

  it('clamps the day when the target month is shorter (Jan 31 + 1mo)', () => {
    // 2026 is not a leap year -> February has 28 days.
    expect(computeExpiry('2026-01-31T12:00:00.000Z', 1)).toBe('2026-02-28T12:00:00.000Z')
  })

  it('clamps to Feb 29 in a leap year', () => {
    expect(computeExpiry('2028-01-31T00:00:00.000Z', 1)).toBe('2028-02-29T00:00:00.000Z')
  })
})

describe('isCertificationActive', () => {
  const now = '2026-05-16T00:00:00.000Z'

  it('is false when revoked, regardless of expiry', () => {
    expect(isCertificationActive({ revoked_at: now, expires_at: null }, now)).toBe(false)
    expect(isCertificationActive({ revoked_at: now, expires_at: '2099-01-01T00:00:00.000Z' }, now)).toBe(false)
  })

  it('is true when not revoked and no expiry', () => {
    expect(isCertificationActive({ revoked_at: null, expires_at: null }, now)).toBe(true)
  })

  it('respects the expiry boundary', () => {
    expect(isCertificationActive({ expires_at: '2026-05-17T00:00:00.000Z' }, now)).toBe(true)
    expect(isCertificationActive({ expires_at: '2026-05-15T00:00:00.000Z' }, now)).toBe(false)
  })

  it('treats an unparseable expiry as non-expiring', () => {
    expect(isCertificationActive({ expires_at: 'garbage' }, now)).toBe(true)
  })
})

describe('certificationStatus', () => {
  const now = new Date('2026-05-16T00:00:00.000Z')

  it('revoked wins even past expiry', () => {
    expect(
      certificationStatus({ revoked_at: '2026-01-01T00:00:00.000Z', expires_at: '2025-01-01T00:00:00.000Z' }, now),
    ).toBe('revoked')
  })

  it('no expiry is active', () => {
    expect(certificationStatus({ expires_at: null }, now)).toBe('active')
  })

  it('past expiry is expired', () => {
    expect(certificationStatus({ expires_at: '2026-05-15T00:00:00.000Z' }, now)).toBe('expired')
  })

  it('within the soon window is expiring_soon', () => {
    const soon = new Date(now.getTime() + (EXPIRING_SOON_DAYS - 1) * 86400000).toISOString()
    expect(certificationStatus({ expires_at: soon }, now)).toBe('expiring_soon')
  })

  it('comfortably in the future is active', () => {
    const far = new Date(now.getTime() + (EXPIRING_SOON_DAYS + 10) * 86400000).toISOString()
    expect(certificationStatus({ expires_at: far }, now)).toBe('active')
  })
})
