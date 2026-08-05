import { describe, it, expect } from 'vitest'
import { parsePaymentRow } from '@/lib/import-logic'

describe('parsePaymentRow', () => {
  it('parses a well-formed row into a normalized payment', () => {
    const r = parsePaymentRow(
      { amount: '$1,200.50', from_identifier: 'Ada', from_note: 'dues', transaction_date: '2026-01-15', platform: 'venmo' },
      2,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.amount).toBe(1200.5)
      expect(r.value.platform).toBe('venmo')
      expect(r.value.from_identifier).toBe('Ada')
      expect(r.value.transaction_date).toBe(new Date('2026-01-15').toISOString())
    }
  })

  it('defaults platform to csv when unmapped', () => {
    const r = parsePaymentRow({ amount: '10', from_identifier: 'Bo', transaction_date: '2026-02-01' }, 3)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.platform).toBe('csv')
  })

  // The bug: a non-empty but unparseable date passed presence validation, then
  // new Date(str).toISOString() threw RangeError mid-map, wedging the import.
  it('reports an error (never throws) for a non-empty unparseable date', () => {
    expect(() =>
      parsePaymentRow({ amount: '10', from_identifier: 'Cy', transaction_date: 'N/A' }, 4),
    ).not.toThrow()
    const r = parsePaymentRow({ amount: '10', from_identifier: 'Cy', transaction_date: 'N/A' }, 4)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Row 4: unparseable date "N/A"')
  })

  it('reports missing required fields', () => {
    expect(parsePaymentRow({ amount: 'nope', from_identifier: 'Di', transaction_date: '2026-01-01' }, 5)).toEqual({
      ok: false,
      error: 'Row 5: missing required fields',
    })
    expect(parsePaymentRow({ amount: '10', from_identifier: '', transaction_date: '2026-01-01' }, 6).ok).toBe(false)
    expect(parsePaymentRow({ amount: '10', from_identifier: 'Di', transaction_date: '' }, 7).ok).toBe(false)
  })
})
