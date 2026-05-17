import { describe, it, expect } from 'vitest'
import {
  pickLowestFreeSlot,
  slotCapacity,
  HEATSYNC_SLOT_MIN,
  HEATSYNC_SLOT_MAX,
} from '@/lib/door-slots-logic'

describe('pickLowestFreeSlot', () => {
  it('picks 0 on an empty controller (default HeatSync range)', () => {
    expect(pickLowestFreeSlot([])).toEqual({ ok: true, slot: 0 })
  })

  it('returns the lowest free slot, filling gaps before extending', () => {
    expect(pickLowestFreeSlot([0, 1, 3])).toEqual({ ok: true, slot: 2 })
    expect(pickLowestFreeSlot([0, 1, 2, 3])).toEqual({ ok: true, slot: 4 })
  })

  it('ignores duplicates, out-of-range and non-integer entries', () => {
    expect(pickLowestFreeSlot([0, 0, 1, 1, 999, -5, 2.5])).toEqual({ ok: true, slot: 2 })
  })

  it('reports slot_exhausted when every slot in range is taken', () => {
    const full = Array.from({ length: 201 }, (_, i) => i) // 0..200
    expect(pickLowestFreeSlot(full)).toEqual({ ok: false, reason: 'slot_exhausted' })
  })

  it('frees a revoked slot for reuse (lowest-first reclaims it)', () => {
    const full = Array.from({ length: 201 }, (_, i) => i)
    const afterRevoke = full.filter(s => s !== 57)
    expect(pickLowestFreeSlot(afterRevoke)).toEqual({ ok: true, slot: 57 })
  })

  it('honours a custom range for non-HeatSync controllers', () => {
    expect(pickLowestFreeSlot([10, 11], 10, 12)).toEqual({ ok: true, slot: 12 })
    expect(pickLowestFreeSlot([10, 11, 12], 10, 12)).toEqual({ ok: false, reason: 'slot_exhausted' })
  })
})

describe('slotCapacity', () => {
  it('counts the HeatSync range as 201 inclusive slots', () => {
    expect(slotCapacity()).toBe(201)
    expect(slotCapacity(HEATSYNC_SLOT_MIN, HEATSYNC_SLOT_MAX)).toBe(201)
  })
  it('handles custom and degenerate ranges', () => {
    expect(slotCapacity(1, 200)).toBe(200)
    expect(slotCapacity(5, 5)).toBe(1)
    expect(slotCapacity(10, 9)).toBe(0)
  })
})
