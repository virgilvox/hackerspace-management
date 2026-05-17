import { describe, it, expect } from 'vitest'
import {
  intervalsOverlap,
  hasConflict,
  reservationEligibility,
} from '@/lib/equipment-logic'

describe('intervalsOverlap', () => {
  it('detects overlap and treats touching as non-overlap', () => {
    expect(intervalsOverlap('2026-01-01T10:00Z', '2026-01-01T12:00Z', '2026-01-01T11:00Z', '2026-01-01T13:00Z')).toBe(true)
    expect(intervalsOverlap('2026-01-01T10:00Z', '2026-01-01T12:00Z', '2026-01-01T12:00Z', '2026-01-01T13:00Z')).toBe(false)
    expect(intervalsOverlap('2026-01-01T10:00Z', '2026-01-01T12:00Z', '2026-01-01T08:00Z', '2026-01-01T09:00Z')).toBe(false)
  })
  it('is false on unparseable input', () => {
    expect(intervalsOverlap('x', 'y', 'a', 'b')).toBe(false)
  })
})

describe('hasConflict', () => {
  const req = ['2026-02-01T10:00Z', '2026-02-01T12:00Z'] as const
  it('only reserved rows block', () => {
    expect(hasConflict(req[0], req[1], [{ starts_at: '2026-02-01T11:00Z', ends_at: '2026-02-01T13:00Z', status: 'reserved' }])).toBe(true)
    expect(hasConflict(req[0], req[1], [{ starts_at: '2026-02-01T11:00Z', ends_at: '2026-02-01T13:00Z', status: 'cancelled' }])).toBe(false)
    expect(hasConflict(req[0], req[1], [{ starts_at: '2026-02-01T11:00Z', ends_at: '2026-02-01T13:00Z', status: 'completed' }])).toBe(false)
  })
  it('no conflict when disjoint', () => {
    expect(hasConflict(req[0], req[1], [{ starts_at: '2026-02-01T12:00Z', ends_at: '2026-02-01T14:00Z', status: 'reserved' }])).toBe(false)
  })
})

describe('reservationEligibility', () => {
  const base = {
    equipmentStatus: 'available',
    equipmentActive: true,
    startsAt: '2026-06-01T10:00:00Z',
    endsAt: '2026-06-01T12:00:00Z',
    now: '2026-05-16T00:00:00Z',
    conflict: false,
    requiresCert: false,
    memberHasCert: false,
    managerOverride: false,
  }
  it('allows a clean future reservation', () => {
    expect(reservationEligibility(base).ok).toBe(true)
  })
  it('blocks archived/retired/maintenance', () => {
    expect(reservationEligibility({ ...base, equipmentActive: false }).ok).toBe(false)
    expect(reservationEligibility({ ...base, equipmentStatus: 'retired' }).ok).toBe(false)
    expect(reservationEligibility({ ...base, equipmentStatus: 'maintenance' }).ok).toBe(false)
  })
  it('blocks past start and end<=start', () => {
    expect(reservationEligibility({ ...base, startsAt: '2026-05-01T10:00:00Z' }).ok).toBe(false)
    expect(reservationEligibility({ ...base, endsAt: '2026-06-01T10:00:00Z' }).ok).toBe(false)
  })
  it('blocks on conflict', () => {
    expect(reservationEligibility({ ...base, conflict: true }).ok).toBe(false)
  })
  it('enforces the cert gate with manager override', () => {
    expect(reservationEligibility({ ...base, requiresCert: true, memberHasCert: false }).ok).toBe(false)
    expect(reservationEligibility({ ...base, requiresCert: true, memberHasCert: true }).ok).toBe(true)
    expect(reservationEligibility({ ...base, requiresCert: true, memberHasCert: false, managerOverride: true }).ok).toBe(true)
  })
})
