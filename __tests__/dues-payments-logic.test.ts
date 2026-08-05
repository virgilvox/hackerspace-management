import { describe, it, expect } from 'vitest'
import {
  DUES_LINK_PLATFORMS,
  DUES_PLATFORM_LABEL,
  isDuesLinkPlatform,
  isSafeDuesUrl,
  resolveDuesAdvance,
} from '@/lib/dues-payments-logic'

describe('DUES_LINK_PLATFORMS', () => {
  it('is the url-based subset, excluding cash and stripe', () => {
    expect(DUES_LINK_PLATFORMS).toEqual(['paypal', 'zeffy', 'venmo'])
    expect((DUES_LINK_PLATFORMS as readonly string[]).includes('cash')).toBe(false)
    expect((DUES_LINK_PLATFORMS as readonly string[]).includes('stripe')).toBe(false)
  })

  it('has a label for every platform', () => {
    for (const p of DUES_LINK_PLATFORMS) expect(DUES_PLATFORM_LABEL[p]).toBeTruthy()
  })
})

describe('isDuesLinkPlatform', () => {
  it('accepts the link platforms', () => {
    expect(isDuesLinkPlatform('paypal')).toBe(true)
    expect(isDuesLinkPlatform('venmo')).toBe(true)
  })
  it('rejects cash, stripe, and junk', () => {
    expect(isDuesLinkPlatform('cash')).toBe(false)
    expect(isDuesLinkPlatform('stripe')).toBe(false)
    expect(isDuesLinkPlatform('bogus')).toBe(false)
  })
})

describe('isSafeDuesUrl', () => {
  it('accepts absolute https URLs', () => {
    expect(isSafeDuesUrl('https://paypal.me/myspace')).toBe(true)
    expect(isSafeDuesUrl('https://www.zeffy.com/en-US/donation-form/abc')).toBe(true)
  })
  it('rejects http (plaintext downgrade)', () => {
    expect(isSafeDuesUrl('http://paypal.me/myspace')).toBe(false)
  })
  it('rejects javascript:, data:, and other schemes (XSS)', () => {
    expect(isSafeDuesUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeDuesUrl('data:text/html,<script>')).toBe(false)
    expect(isSafeDuesUrl('mailto:treasurer@space.org')).toBe(false)
  })
  it('rejects relative or unparseable input', () => {
    expect(isSafeDuesUrl('/paypal')).toBe(false)
    expect(isSafeDuesUrl('paypal.me/x')).toBe(false)
    expect(isSafeDuesUrl('')).toBe(false)
  })

  it('rejects https without // (stays in lockstep with the DB CHECK)', () => {
    // these parse to protocol https: but lack the // the DB CHECK requires
    expect(isSafeDuesUrl('https:example.com')).toBe(false)
    expect(isSafeDuesUrl('https:/x')).toBe(false)
    // bare scheme with no host
    expect(isSafeDuesUrl('https://')).toBe(false)
  })
})

describe('resolveDuesAdvance', () => {
  const older = '2026-01-01T00:00:00.000Z'
  const newer = '2026-06-01T00:00:00.000Z'

  it('advances when there is no prior payment and marks current', () => {
    expect(resolveDuesAdvance(null, newer)).toEqual({
      last_paid_at: newer,
      payment_status: 'current',
    })
  })

  it('advances (and marks current) when the new payment is more recent', () => {
    expect(resolveDuesAdvance(older, newer)).toEqual({
      last_paid_at: newer,
      payment_status: 'current',
    })
  })

  it('advances (and marks current) when dates are equal — the common re-pay case', () => {
    expect(resolveDuesAdvance(newer, newer)).toEqual({
      last_paid_at: newer,
      payment_status: 'current',
    })
  })

  it('does NOT regress: a backdated payment keeps the newer date and omits payment_status', () => {
    const result = resolveDuesAdvance(newer, older)
    expect(result.last_paid_at).toBe(newer)
    expect(result).not.toHaveProperty('payment_status')
  })

  it('compares by instant, so a +00:00 offset and a Z suffix for the same time still advance', () => {
    // existing came back from PostgREST with an offset; incoming is toISOString()
    expect(resolveDuesAdvance('2026-06-01T00:00:00+00:00', newer)).toEqual({
      last_paid_at: newer,
      payment_status: 'current',
    })
    // and a backdated one expressed with an offset still does not regress
    const back = resolveDuesAdvance(newer, '2026-01-01T00:00:00+00:00')
    expect(back.last_paid_at).toBe(newer)
    expect(back).not.toHaveProperty('payment_status')
  })
})
