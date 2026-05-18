import { describe, it, expect } from 'vitest'
import {
  mapPayPalTransactions,
  filterUnseenByExternalId,
  externalIdsOf,
  type PayPalPaymentRow,
} from '@/lib/paypal-logic'

const NOW = '2026-01-01T00:00:00.000Z'

describe('mapPayPalTransactions', () => {
  it('keeps only incoming (amount > 0) and maps fields', () => {
    const rows = mapPayPalTransactions(
      [
        {
          transaction_info: {
            transaction_id: 't1',
            transaction_amount: { value: '25.00' },
            transaction_subject: 'Dues',
            transaction_initiation_date: '2026-02-03T10:00:00Z',
          },
          payer_info: { email_address: 'p@x.test' },
        },
        { transaction_info: { transaction_id: 't2', transaction_amount: { value: '-9.00' } } },
        { transaction_info: { transaction_id: 't3', transaction_amount: { value: '0' } } },
      ],
      's1',
      NOW,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual<PayPalPaymentRow>({
      space_id: 's1',
      platform: 'paypal',
      amount: 25,
      from_identifier: 'p@x.test',
      from_note: 'Dues',
      transaction_date: new Date('2026-02-03T10:00:00Z').toISOString(),
      link_status: 'unlinked',
      external_id: 't1',
    })
  })

  it('falls back through name then a literal, and note then subject then null', () => {
    const [a, b] = mapPayPalTransactions(
      [
        {
          transaction_info: { transaction_id: 'a', transaction_amount: { value: '1' }, transaction_note: 'n' },
          payer_info: { payer_name: { alternate_full_name: 'Jane' } },
        },
        { transaction_info: { transaction_id: 'b', transaction_amount: { value: '2' } } },
      ],
      's1',
      NOW,
    )
    expect(a.from_identifier).toBe('Jane')
    expect(a.from_note).toBe('n')
    expect(b.from_identifier).toBe('PayPal User')
    expect(b.from_note).toBeNull()
  })

  it('uses nowIso when the date is missing or invalid (never throws)', () => {
    const [a, b] = mapPayPalTransactions(
      [
        { transaction_info: { transaction_id: 'a', transaction_amount: { value: '1' } } },
        {
          transaction_info: {
            transaction_id: 'b',
            transaction_amount: { value: '1' },
            transaction_initiation_date: 'not-a-date',
          },
        },
      ],
      's1',
      NOW,
    )
    expect(a.transaction_date).toBe(NOW)
    expect(b.transaction_date).toBe(NOW)
  })

  it('handles empty / nullish input', () => {
    expect(mapPayPalTransactions([], 's1', NOW)).toEqual([])
    expect(mapPayPalTransactions(undefined as unknown as [], 's1', NOW)).toEqual([])
  })
})

describe('filterUnseenByExternalId', () => {
  const rows = [
    { external_id: 'a' },
    { external_id: 'b' },
    { external_id: null },
  ] as PayPalPaymentRow[]

  it('drops already-seen ids, keeps unseen and null-id rows', () => {
    const out = filterUnseenByExternalId(rows, new Set(['a']))
    expect(out.map(r => r.external_id)).toEqual(['b', null])
  })
  it('keeps everything when nothing seen', () => {
    expect(filterUnseenByExternalId(rows, new Set())).toHaveLength(3)
  })
})

describe('externalIdsOf', () => {
  it('returns only non-null external ids', () => {
    expect(
      externalIdsOf([{ external_id: 'a' }, { external_id: null }, { external_id: 'c' }] as PayPalPaymentRow[]),
    ).toEqual(['a', 'c'])
  })
})
