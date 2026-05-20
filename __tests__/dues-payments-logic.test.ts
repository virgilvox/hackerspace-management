import { describe, it, expect } from 'vitest'
import {
  DUES_LINK_PLATFORMS,
  DUES_PLATFORM_LABEL,
  isDuesLinkPlatform,
  isSafeDuesUrl,
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
})
