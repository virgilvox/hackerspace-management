import { describe, it, expect } from 'vitest'
import {
  MAX_NOTIFICATION_ATTEMPTS,
  isTerminalAttempt,
  notificationDedupeKey,
  duesDedupeKey,
  formatMoney,
  renderDuesEmail,
} from '@/lib/notifications-logic'

describe('isTerminalAttempt', () => {
  it('is terminal only once the attempt budget is exhausted', () => {
    expect(isTerminalAttempt(0)).toBe(false)
    expect(isTerminalAttempt(MAX_NOTIFICATION_ATTEMPTS - 1)).toBe(false)
    expect(isTerminalAttempt(MAX_NOTIFICATION_ATTEMPTS)).toBe(true)
    expect(isTerminalAttempt(MAX_NOTIFICATION_ATTEMPTS + 3)).toBe(true)
  })
  it('respects a custom max', () => {
    expect(isTerminalAttempt(2, 3)).toBe(false)
    expect(isTerminalAttempt(3, 3)).toBe(true)
  })
})

describe('notificationDedupeKey', () => {
  it('joins non-empty parts and drops nullish/empty', () => {
    expect(notificationDedupeKey(['a', 'b', 'c'])).toBe('a:b:c')
    expect(notificationDedupeKey(['a', null, undefined, '', 'd'])).toBe('a:d')
    expect(notificationDedupeKey([1, 'x'])).toBe('1:x')
  })
  it('is deterministic for the same input', () => {
    expect(notificationDedupeKey(['dues_renewed', 'in_1'])).toBe(
      notificationDedupeKey(['dues_renewed', 'in_1']),
    )
  })
})

describe('duesDedupeKey', () => {
  it('renewed/failed key by invoice; a Stripe event-id replay collapses', () => {
    expect(duesDedupeKey('dues_renewed', { invoiceId: 'in_1' })).toBe('dues_renewed:in_1')
    expect(duesDedupeKey('dues_payment_failed', { invoiceId: 'in_9' })).toBe(
      'dues_payment_failed:in_9',
    )
  })
  it('lapse keys by member + period so next cycle can lapse again', () => {
    const a = duesDedupeKey('dues_lapsed', { memberId: 'm1', periodEnd: '2026-06-01' })
    const b = duesDedupeKey('dues_lapsed', { memberId: 'm1', periodEnd: '2026-07-01' })
    expect(a).toBe('dues_lapsed:m1:2026-06-01')
    expect(a).not.toBe(b)
  })
})

describe('formatMoney', () => {
  it('formats known currencies with a symbol, others with the code', () => {
    expect(formatMoney(12, 'usd')).toBe('$12.00 USD')
    expect(formatMoney(12, 'eur')).toBe('€12.00 EUR')
    expect(formatMoney(5.5, 'AUD')).toBe('5.50 AUD')
  })
  it('returns empty string when amount is missing', () => {
    expect(formatMoney(null, 'usd')).toBe('')
    expect(formatMoney(undefined, 'usd')).toBe('')
    expect(formatMoney(NaN, 'usd')).toBe('')
  })
})

describe('renderDuesEmail', () => {
  it('renewed: subject + amount + manage link, both bodies', () => {
    const r = renderDuesEmail({
      type: 'dues_renewed',
      spaceName: 'HeatSync Labs',
      memberName: 'Ada',
      amount: 25,
      currency: 'USD',
      periodEnd: '2026-06-15',
      manageUrl: 'https://hackerspace.sh/me',
    })
    expect(r.subject).toBe('Your HeatSync Labs dues renewed')
    expect(r.text).toContain('Hi Ada,')
    expect(r.text).toContain('$25.00 USD')
    expect(r.text).toContain('https://hackerspace.sh/me')
    expect(r.html).toContain('<a href="https://hackerspace.sh/me"')
  })

  it('payment_failed: action-needed subject and update-method copy', () => {
    const r = renderDuesEmail({
      type: 'dues_payment_failed',
      spaceName: 'Acme',
      manageUrl: 'https://x.test/me',
    })
    expect(r.subject).toBe('Action needed: Acme dues payment failed')
    expect(r.text).toContain('Hi,')
    expect(r.text.toLowerCase()).toContain('update your payment method')
  })

  it('lapsed: late subject and restore copy', () => {
    const r = renderDuesEmail({
      type: 'dues_lapsed',
      spaceName: 'Acme',
      memberName: '  ',
      manageUrl: 'https://x.test/me',
    })
    expect(r.subject).toBe('Your Acme membership is now marked late')
    expect(r.text).toContain('Hi,')
    expect(r.text.toLowerCase()).toContain('marked late')
  })

  it('escapes HTML in injected names to prevent email markup injection', () => {
    const r = renderDuesEmail({
      type: 'dues_renewed',
      spaceName: '<script>evil</script>',
      memberName: 'a<b>c',
      manageUrl: 'https://x.test/me',
    })
    expect(r.html).not.toContain('<script>evil</script>')
    expect(r.html).toContain('&lt;script&gt;')
    expect(r.html).toContain('a&lt;b&gt;c')
  })

  it('falls back to a neutral space name and generic greeting', () => {
    const r = renderDuesEmail({
      type: 'dues_renewed',
      spaceName: '',
      manageUrl: 'https://x.test/me',
    })
    expect(r.subject).toBe('Your your hackerspace dues renewed')
    expect(r.text).toContain('Hi,')
  })
})
