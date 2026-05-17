import { describe, it, expect } from 'vitest'
import {
  presenceStatus,
  hostEligibility,
  summarizePresence,
  PRESENCE_MAX_OPEN_HOURS,
} from '@/lib/presence-logic'

const NOW = '2026-05-17T20:00:00Z'
const hoursAgo = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString()

describe('presenceStatus', () => {
  it('an explicit checkout short-circuits to checked_out', () => {
    expect(presenceStatus(hoursAgo(1), hoursAgo(0.5), NOW)).toBe('checked_out')
    // even a stale-age open-then-closed visit is checked_out
    expect(presenceStatus(hoursAgo(50), hoursAgo(40), NOW)).toBe('checked_out')
  })
  it('open and fresh = present', () => {
    expect(presenceStatus(hoursAgo(0), null, NOW)).toBe('present')
    expect(presenceStatus(hoursAgo(PRESENCE_MAX_OPEN_HOURS - 0.1), null, NOW)).toBe('present')
  })
  it('open at/over the window = stale (>= boundary)', () => {
    expect(presenceStatus(hoursAgo(PRESENCE_MAX_OPEN_HOURS), null, NOW)).toBe('stale')
    expect(presenceStatus(hoursAgo(PRESENCE_MAX_OPEN_HOURS + 5), null, NOW)).toBe('stale')
  })
  it('respects a custom window', () => {
    expect(presenceStatus(hoursAgo(3), null, NOW, 2)).toBe('stale')
    expect(presenceStatus(hoursAgo(1), null, NOW, 2)).toBe('present')
  })
  it('an unparseable check-in time is treated as not-present (stale), never present', () => {
    expect(presenceStatus('not-a-date', null, NOW)).toBe('stale')
  })
})

describe('hostEligibility', () => {
  it('a non-host check-in is always allowed', () => {
    expect(hostEligibility({ asHost: false, hasActiveCard: false, hostRequiresCard: true }).ok).toBe(true)
  })
  it('host requires a card when the space requires it and there is none', () => {
    const r = hostEligibility({ asHost: true, hasActiveCard: false, hostRequiresCard: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/active access card/i)
  })
  it('host with a card is allowed', () => {
    expect(hostEligibility({ asHost: true, hasActiveCard: true, hostRequiresCard: true }).ok).toBe(true)
  })
  it('host without a card is allowed when the space does not require one', () => {
    expect(hostEligibility({ asHost: true, hasActiveCard: false, hostRequiresCard: false }).ok).toBe(true)
  })
})

describe('summarizePresence', () => {
  it('counts only present rows and the hosts among them', () => {
    const rows = [
      { checked_in_at: hoursAgo(1), checked_out_at: null, is_host: true },   // present host
      { checked_in_at: hoursAgo(2), checked_out_at: null, is_host: false },  // present
      { checked_in_at: hoursAgo(3), checked_out_at: hoursAgo(1), is_host: true }, // checked out
      { checked_in_at: hoursAgo(40), checked_out_at: null, is_host: true },  // stale
    ]
    expect(summarizePresence(rows, NOW)).toEqual({ present: 2, hosts: 1 })
  })
  it('empty list = zero', () => {
    expect(summarizePresence([], NOW)).toEqual({ present: 0, hosts: 0 })
  })
})
