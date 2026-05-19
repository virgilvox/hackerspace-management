import { describe, it, expect } from 'vitest'
import {
  isoFromUnix,
  customerIdOf,
  subscriptionPeriodEnd,
  invoiceMetadataMemberId,
  invoiceLinePeriodEnd,
  memberStatusPatch,
  stripeInvoiceToPaymentRow,
  minorToMajor,
  laterPeriodEnd,
} from '@/lib/stripe/webhook-logic'

describe('isoFromUnix', () => {
  it('converts a positive unix seconds value to ISO', () => {
    expect(isoFromUnix(1_700_000_000)).toBe(new Date(1_700_000_000_000).toISOString())
  })
  it('returns null for 0, negative, null, undefined, NaN', () => {
    for (const v of [0, -1, null, undefined, NaN]) {
      expect(isoFromUnix(v as number)).toBeNull()
    }
  })
})

describe('customerIdOf', () => {
  it('handles string id, expanded object, empty, and nullish', () => {
    expect(customerIdOf('cus_1')).toBe('cus_1')
    expect(customerIdOf({ id: 'cus_2' })).toBe('cus_2')
    expect(customerIdOf('')).toBeNull()
    expect(customerIdOf(null)).toBeNull()
    expect(customerIdOf(undefined)).toBeNull()
    expect(customerIdOf({ id: null })).toBeNull()
  })
})

describe('subscriptionPeriodEnd (Basil: period on item, not subscription)', () => {
  it('reads item 0 current_period_end', () => {
    expect(subscriptionPeriodEnd({ items: { data: [{ current_period_end: 1_700_000_000 }] } })).toBe(
      new Date(1_700_000_000_000).toISOString(),
    )
  })
  it('null when no items / no field', () => {
    expect(subscriptionPeriodEnd({ items: { data: [] } })).toBeNull()
    expect(subscriptionPeriodEnd({})).toBeNull()
    expect(subscriptionPeriodEnd(null)).toBeNull()
    expect(subscriptionPeriodEnd({ items: { data: [null] } })).toBeNull()
  })
})

describe('invoiceMetadataMemberId (Basil: under parent.subscription_details)', () => {
  it('reads the relocated metadata', () => {
    expect(
      invoiceMetadataMemberId({ parent: { subscription_details: { metadata: { member_id: 'm1' } } } }),
    ).toBe('m1')
  })
  it('undefined when any level is missing or empty', () => {
    expect(invoiceMetadataMemberId({})).toBeUndefined()
    expect(invoiceMetadataMemberId({ parent: null })).toBeUndefined()
    expect(invoiceMetadataMemberId({ parent: { subscription_details: { metadata: { member_id: '' } } } })).toBeUndefined()
  })
})

describe('invoiceLinePeriodEnd', () => {
  it('reads line 0 period end, null when absent', () => {
    expect(invoiceLinePeriodEnd({ lines: { data: [{ period: { end: 1_700_000_000 } }] } })).toBe(
      new Date(1_700_000_000_000).toISOString(),
    )
    expect(invoiceLinePeriodEnd({ lines: { data: [] } })).toBeNull()
    expect(invoiceLinePeriodEnd({ lines: null })).toBeNull()
    expect(invoiceLinePeriodEnd({})).toBeNull()
  })
})

describe('memberStatusPatch (only current<->late)', () => {
  it('current adds last_paid_at; late does not; null/undefined -> no patch', () => {
    expect(memberStatusPatch('current', '2026-01-01T00:00:00.000Z')).toEqual({
      status: 'current',
      last_paid_at: '2026-01-01T00:00:00.000Z',
    })
    expect(memberStatusPatch('late', '2026-01-01T00:00:00.000Z')).toEqual({ status: 'late' })
    expect(memberStatusPatch(null, 'x')).toBeNull()
    expect(memberStatusPatch(undefined, 'x')).toBeNull()
  })
})

describe('stripeInvoiceToPaymentRow', () => {
  it('maps minor->major, upcases currency, links by member presence', () => {
    const row = stripeInvoiceToPaymentRow({
      inv: { id: 'in_1', amount_paid: 2500, currency: 'usd', customer_email: 'a@b.test' },
      spaceId: 's1',
      memberId: 'm1',
      eventId: 'evt_1',
      nowIso: '2026-01-01T00:00:00.000Z',
    })
    expect(row).toMatchObject({
      space_id: 's1',
      member_id: 'm1',
      platform: 'stripe',
      amount: 25,
      currency: 'USD',
      status: 'linked',
      link_status: 'linked',
      external_id: 'in_1',
      payer_email: 'a@b.test',
      from_identifier: 'a@b.test',
      transaction_date: '2026-01-01T00:00:00.000Z',
      raw_data: { event_id: 'evt_1', invoice: 'in_1' },
    })
  })
  it('unlinked + safe defaults when member/amount/currency/email missing', () => {
    const row = stripeInvoiceToPaymentRow({
      inv: { id: 'in_2' },
      spaceId: 's1',
      memberId: null,
      eventId: 'evt_2',
      nowIso: '2026-01-01T00:00:00.000Z',
    })
    expect(row.status).toBe('unlinked')
    expect(row.link_status).toBe('unlinked')
    expect(row.amount).toBe(0)
    expect(row.currency).toBe('USD')
    expect(row.description).toBe('Stripe membership dues')
    expect(row.payer_email).toBeNull()
  })
})

describe('laterPeriodEnd (never rewind on out-of-order events)', () => {
  const older = '2026-05-01T00:00:00.000Z'
  const newer = '2026-06-01T00:00:00.000Z'
  it('keeps the later of stored vs incoming regardless of arrival order', () => {
    expect(laterPeriodEnd(newer, older)).toBe(newer) // stale event arrives late
    expect(laterPeriodEnd(older, newer)).toBe(newer) // normal advance
    expect(laterPeriodEnd(newer, newer)).toBe(newer)
  })
  it('handles nulls (first event / canceled sub with no period)', () => {
    expect(laterPeriodEnd(null, newer)).toBe(newer)
    expect(laterPeriodEnd(newer, null)).toBe(newer)
    expect(laterPeriodEnd(null, null)).toBeNull()
    expect(laterPeriodEnd(undefined, undefined)).toBeNull()
  })
})

describe('minorToMajor (currency-aware)', () => {
  it('divides by 100 for normal 2-decimal currencies', () => {
    expect(minorToMajor(2500, 'usd')).toBe(25)
    expect(minorToMajor(2500, 'EUR')).toBe(25)
    expect(minorToMajor(null, 'usd')).toBe(0)
    expect(minorToMajor(undefined, undefined)).toBe(0)
  })
  it('does NOT divide zero-decimal currencies (JPY/KRW already major)', () => {
    expect(minorToMajor(3000, 'jpy')).toBe(3000)
    expect(minorToMajor(50000, 'KRW')).toBe(50000)
    expect(minorToMajor(1000, 'VND')).toBe(1000)
  })
})
