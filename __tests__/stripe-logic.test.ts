import { describe, it, expect } from 'vitest'
import {
  STRIPE_API_VERSION,
  stripeStatusIsPaid,
  duesMemberStatus,
  graceExceeded,
  priceIdForTier,
  isStripeConfigured,
} from '@/lib/stripe-logic'

describe('STRIPE_API_VERSION', () => {
  it('is pinned (conscious upgrades only)', () => {
    expect(STRIPE_API_VERSION).toBe('2026-04-22.dahlia')
  })
})

describe('stripeStatusIsPaid', () => {
  it('active/trialing are paid; everything else is not', () => {
    expect(stripeStatusIsPaid('active')).toBe(true)
    expect(stripeStatusIsPaid('trialing')).toBe(true)
    for (const s of ['past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', '', null, undefined]) {
      expect(stripeStatusIsPaid(s as string)).toBe(false)
    }
  })
})

describe('duesMemberStatus', () => {
  it('paid statuses -> current', () => {
    expect(duesMemberStatus('active', false)).toBe('current')
    expect(duesMemberStatus('trialing', true)).toBe('current')
  })
  it('past_due respects the grace window', () => {
    expect(duesMemberStatus('past_due', false)).toBe('current')
    expect(duesMemberStatus('past_due', true)).toBe('late')
  })
  it('terminal/failed statuses -> late, NEVER inactive', () => {
    for (const s of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired']) {
      expect(duesMemberStatus(s, false)).toBe('late')
    }
  })
  it('unknown/empty -> null (no change, never blind overwrite)', () => {
    expect(duesMemberStatus(undefined, true)).toBeNull()
    expect(duesMemberStatus('something_new', true)).toBeNull()
  })
})

describe('graceExceeded', () => {
  const end = '2026-05-01T00:00:00Z'
  it('false within the window, true past it', () => {
    expect(graceExceeded(end, 7, '2026-05-05T00:00:00Z')).toBe(false)
    expect(graceExceeded(end, 7, '2026-05-08T00:01:00Z')).toBe(true)
    expect(graceExceeded(end, 0, '2026-05-01T00:00:01Z')).toBe(true)
  })
  it('missing/invalid period end is never "exceeded" (fail safe)', () => {
    expect(graceExceeded(null, 7, '2030-01-01T00:00:00Z')).toBe(false)
    expect(graceExceeded('nope', 7, '2030-01-01T00:00:00Z')).toBe(false)
  })
})

describe('priceIdForTier', () => {
  const cfg = { prices: { plus: 'price_1', basic: ' ', associate: undefined } }
  it('returns the mapped non-empty price or null', () => {
    expect(priceIdForTier(cfg, 'plus')).toBe('price_1')
    expect(priceIdForTier(cfg, 'basic')).toBeNull()
    expect(priceIdForTier(cfg, 'associate')).toBeNull()
    expect(priceIdForTier(cfg, 'missing')).toBeNull()
    expect(priceIdForTier(null, 'plus')).toBeNull()
  })
})

describe('isStripeConfigured', () => {
  it('needs publishable key + secret ref + >=1 mapped price', () => {
    expect(isStripeConfigured(null)).toBe(false)
    expect(isStripeConfigured({ publishable_key: 'pk', secret_key_ref: 's', prices: {} })).toBe(false)
    expect(isStripeConfigured({ publishable_key: 'pk', prices: { plus: 'price_1' } })).toBe(false)
    expect(isStripeConfigured({ publishable_key: 'pk', secret_key_ref: 's', prices: { plus: 'price_1' } })).toBe(true)
  })
})
