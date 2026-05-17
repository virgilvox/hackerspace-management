import { describe, it, expect } from 'vitest'
import { last4, maskCardUid } from '@/lib/door-logic'

describe('last4', () => {
  it('returns the last 4 chars, or the whole short value', () => {
    expect(last4('0123456789')).toBe('6789')
    expect(last4('ABCD')).toBe('ABCD')
    expect(last4('AB')).toBe('AB')
  })
})

describe('maskCardUid', () => {
  it('reveals only the last 4 characters', () => {
    expect(maskCardUid('0123456789')).toBe('••••••6789')
    expect(maskCardUid('AABBCCDD')).toBe('••••CCDD')
  })
  it('reveals nothing for short UIDs', () => {
    expect(maskCardUid('ABCD')).toBe('••••')
    expect(maskCardUid('AB')).toBe('••')
    expect(maskCardUid('')).toBe('••••')
  })
})
