import { describe, it, expect } from 'vitest'
import {
  MAX_NOTIFICATION_ATTEMPTS,
  isTerminalAttempt,
  notificationDedupeKey,
  duesDedupeKey,
  formatMoney,
  renderDuesEmail,
  bookingDedupeKey,
  renderBookingEmail,
  classDedupeKey,
  renderClassEmail,
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
  it('lapse falls back to subscription id when periodEnd is null', () => {
    // canceled/deleted subs carry no item period; without the fallback every
    // lapse would collapse to dues_lapsed:m1 and suppress future notices.
    const k = duesDedupeKey('dues_lapsed', {
      memberId: 'm1',
      periodEnd: null,
      subscriptionId: 'sub_A',
    })
    expect(k).toBe('dues_lapsed:m1:sub_A')
    // A comeback subscription has a new id, so a later lapse stays distinct.
    const k2 = duesDedupeKey('dues_lapsed', {
      memberId: 'm1',
      periodEnd: null,
      subscriptionId: 'sub_B',
    })
    expect(k2).not.toBe(k)
    // periodEnd still wins when present (stable per billing period).
    expect(
      duesDedupeKey('dues_lapsed', {
        memberId: 'm1',
        periodEnd: '2026-06-01',
        subscriptionId: 'sub_A',
      }),
    ).toBe('dues_lapsed:m1:2026-06-01')
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
  it('renders zero-decimal currencies with no fractional part', () => {
    expect(formatMoney(3000, 'jpy')).toBe('3000 JPY')
    expect(formatMoney(50000, 'KRW')).toBe('50000 KRW')
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

describe('bookingDedupeKey', () => {
  it('keys by type + reservation id; per-reservation per-event', () => {
    expect(bookingDedupeKey('booking_confirmed', 'r1')).toBe('booking_confirmed:r1')
    expect(bookingDedupeKey('booking_cancelled', 'r1')).toBe('booking_cancelled:r1')
    expect(bookingDedupeKey('booking_confirmed', 'r1')).not.toBe(
      bookingDedupeKey('booking_confirmed', 'r2'),
    )
  })
})

describe('renderBookingEmail', () => {
  const base = {
    spaceName: 'Acme',
    memberName: 'Ada',
    equipmentName: 'Laser Cutter',
    location: 'Bay 3',
    startsAt: '2026-05-22T15:00:00Z',
    endsAt: '2026-05-22T17:00:00Z',
    manageUrl: 'https://x.test/me',
  } as const

  it('confirmed: subject names equipment + space; body has range, location, link', () => {
    const r = renderBookingEmail({ type: 'booking_confirmed', ...base })
    expect(r.subject).toBe('Reservation confirmed: Laser Cutter at Acme')
    expect(r.text).toContain('Hi Ada,')
    expect(r.text).toContain('Laser Cutter at Acme')
    expect(r.text).toContain('Bay 3')
    expect(r.text).toContain('https://x.test/me')
    expect(r.html).toContain('<a href="https://x.test/me"')
  })

  it('cancelled: subject + body acknowledge the cancel', () => {
    const r = renderBookingEmail({ type: 'booking_cancelled', ...base })
    expect(r.subject).toBe('Reservation cancelled: Laser Cutter at Acme')
    expect(r.text.toLowerCase()).toContain('was cancelled')
  })

  it('omits the location line when not provided', () => {
    const r = renderBookingEmail({ ...base, type: 'booking_confirmed', location: null })
    expect(r.text).not.toContain('Location:')
  })

  it('falls back to a generic greeting + equipment label when names missing', () => {
    const r = renderBookingEmail({
      ...base,
      type: 'booking_confirmed',
      memberName: '',
      equipmentName: '',
    })
    expect(r.text).toContain('Hi,')
    expect(r.subject).toBe('Reservation confirmed: the equipment at Acme')
  })

  it('escapes HTML in injected names', () => {
    const r = renderBookingEmail({
      ...base,
      type: 'booking_confirmed',
      memberName: 'a<b>',
      equipmentName: '<img>',
    })
    expect(r.html).not.toContain('<img>')
    expect(r.html).toContain('&lt;img&gt;')
    expect(r.html).toContain('a&lt;b&gt;')
  })
})

describe('classDedupeKey', () => {
  it('signup-keyed events use signup_id (stable across promotion)', () => {
    expect(classDedupeKey('class_signup_registered', { signupId: 's1' })).toBe(
      'class_signup_registered:s1',
    )
    expect(classDedupeKey('class_signup_waitlisted', { signupId: 's1' })).toBe(
      'class_signup_waitlisted:s1',
    )
    // Same signup_id, different type after a promotion: distinct dedupe.
    expect(classDedupeKey('class_signup_promoted', { signupId: 's1' })).not.toBe(
      classDedupeKey('class_signup_waitlisted', { signupId: 's1' }),
    )
  })
  it('session-cancelled fans out by (session, member)', () => {
    expect(
      classDedupeKey('class_session_cancelled', { sessionId: 'sess1', memberId: 'm1' }),
    ).toBe('class_session_cancelled:sess1:m1')
    expect(
      classDedupeKey('class_session_cancelled', { sessionId: 'sess1', memberId: 'm1' }),
    ).not.toBe(
      classDedupeKey('class_session_cancelled', { sessionId: 'sess1', memberId: 'm2' }),
    )
  })
})

describe('renderClassEmail', () => {
  const base = {
    spaceName: 'Acme',
    memberName: 'Ada',
    className: 'Intro to Welding',
    location: 'Bay 1',
    startsAt: '2026-05-22T15:00:00Z',
    endsAt: '2026-05-22T17:00:00Z',
    manageUrl: 'https://x.test/me',
  } as const

  it('registered: confirmation subject + body', () => {
    const r = renderClassEmail({ type: 'class_signup_registered', ...base })
    expect(r.subject).toBe('Signed up for Intro to Welding at Acme')
    expect(r.text).toContain('Hi Ada,')
    expect(r.text).toContain('registered for Intro to Welding at Acme')
    expect(r.text).toContain('Bay 1')
    expect(r.text).toContain('https://x.test/me')
  })

  it('waitlisted: subject + reassurance copy about being moved up', () => {
    const r = renderClassEmail({ type: 'class_signup_waitlisted', ...base })
    expect(r.subject).toBe('Waitlisted for Intro to Welding at Acme')
    expect(r.text.toLowerCase()).toContain('waitlist')
    expect(r.text.toLowerCase()).toContain('if a spot opens up')
  })

  it('promoted: distinctive subject + "moved from the waitlist" copy', () => {
    const r = renderClassEmail({ type: 'class_signup_promoted', ...base })
    expect(r.subject).toBe("You're in: Intro to Welding at Acme")
    expect(r.text.toLowerCase()).toContain('moved from the waitlist')
  })

  it('session_cancelled: cancellation subject + message', () => {
    const r = renderClassEmail({ type: 'class_session_cancelled', ...base })
    expect(r.subject).toBe('Cancelled: Intro to Welding at Acme')
    expect(r.text.toLowerCase()).toContain('has been cancelled')
  })

  it('omits the location line when not provided', () => {
    const r = renderClassEmail({ ...base, type: 'class_signup_registered', location: null })
    expect(r.text).not.toContain('Location:')
  })

  it('falls back to a generic class label when title is missing', () => {
    const r = renderClassEmail({ ...base, type: 'class_signup_registered', className: '' })
    expect(r.subject).toBe('Signed up for the class at Acme')
  })

  it('escapes HTML in injected fields', () => {
    const r = renderClassEmail({
      ...base,
      type: 'class_signup_registered',
      className: '<b>x</b>',
    })
    expect(r.html).not.toContain('<b>x</b>')
    expect(r.html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
