import { describe, it, expect } from 'vitest'
import {
  effectiveCapacity,
  computeSignupStatus,
  sessionTiming,
  canSignUp,
  signupFormEligibility,
  pickPromotion,
} from '@/lib/classes-logic'

describe('effectiveCapacity', () => {
  it('session override wins, else class, else unlimited', () => {
    expect(effectiveCapacity(5, 10)).toBe(5)
    expect(effectiveCapacity(null, 10)).toBe(10)
    expect(effectiveCapacity(undefined, undefined)).toBeNull()
    expect(effectiveCapacity(0 as unknown as number, 10)).toBe(0)
  })
})

describe('computeSignupStatus', () => {
  it('unlimited capacity always registers', () => {
    expect(computeSignupStatus(null, 999)).toBe('registered')
  })
  it('registers under capacity, waitlists at/over', () => {
    expect(computeSignupStatus(3, 2)).toBe('registered')
    expect(computeSignupStatus(3, 3)).toBe('waitlisted')
    expect(computeSignupStatus(3, 4)).toBe('waitlisted')
  })
})

describe('sessionTiming', () => {
  const now = '2026-05-16T12:00:00.000Z'
  it('classifies relative to now', () => {
    expect(sessionTiming('2026-05-17T00:00:00.000Z', null, now)).toBe('upcoming')
    expect(sessionTiming('2026-05-15T00:00:00.000Z', '2026-05-15T01:00:00.000Z', now)).toBe('past')
    expect(sessionTiming('2026-05-16T11:00:00.000Z', '2026-05-16T13:00:00.000Z', now)).toBe('in_progress')
  })
  it('with no end, a started session is past once now exceeds start', () => {
    expect(sessionTiming('2026-05-16T11:59:59.000Z', null, now)).toBe('past')
  })
})

describe('canSignUp', () => {
  const now = '2026-05-16T12:00:00.000Z'
  it('rejects cancelled/completed/past', () => {
    expect(canSignUp({ sessionStatus: 'cancelled', startsAt: '2026-06-01T00:00:00Z', now }).ok).toBe(false)
    expect(canSignUp({ sessionStatus: 'completed', startsAt: '2026-06-01T00:00:00Z', now }).ok).toBe(false)
    expect(canSignUp({ sessionStatus: 'scheduled', startsAt: '2026-05-01T00:00:00Z', endsAt: '2026-05-01T01:00:00Z', now }).ok).toBe(false)
  })
  it('allows an upcoming scheduled session', () => {
    expect(canSignUp({ sessionStatus: 'scheduled', startsAt: '2026-06-01T00:00:00Z', now }).ok).toBe(true)
  })
})

describe('pickPromotion', () => {
  it('promotes the earliest waitlisted when a seat is free', () => {
    const s = [
      { id: 'r1', status: 'registered', signed_up_at: '2026-01-01T00:00:00Z' },
      { id: 'w2', status: 'waitlisted', signed_up_at: '2026-01-03T00:00:00Z' },
      { id: 'w1', status: 'waitlisted', signed_up_at: '2026-01-02T00:00:00Z' },
    ]
    expect(pickPromotion(s, 3)).toBe('w1')
  })
  it('returns null when still at capacity', () => {
    const s = [
      { id: 'r1', status: 'registered', signed_up_at: '2026-01-01T00:00:00Z' },
      { id: 'r2', status: 'registered', signed_up_at: '2026-01-01T00:00:00Z' },
      { id: 'w1', status: 'waitlisted', signed_up_at: '2026-01-02T00:00:00Z' },
    ]
    expect(pickPromotion(s, 2)).toBeNull()
  })
  it('returns null when nobody is waiting', () => {
    expect(pickPromotion([{ id: 'r1', status: 'registered', signed_up_at: 'x' }], 5)).toBeNull()
  })
})

describe('signupFormEligibility', () => {
  it('passes when no form is required', () => {
    expect(signupFormEligibility({ requiresForm: false, memberHasForm: false, managerOverride: false }).ok).toBe(true)
  })
  it('passes when the form is on file', () => {
    expect(signupFormEligibility({ requiresForm: true, memberHasForm: true, managerOverride: false }).ok).toBe(true)
  })
  it('blocks when required and not on file', () => {
    const r = signupFormEligibility({ requiresForm: true, memberHasForm: false, managerOverride: false })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/requires a form/i)
  })
  it('a manager override bypasses the form requirement', () => {
    expect(signupFormEligibility({ requiresForm: true, memberHasForm: false, managerOverride: true }).ok).toBe(true)
  })
})
