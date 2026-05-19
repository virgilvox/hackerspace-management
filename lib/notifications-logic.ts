// Pure notification logic: dedupe-key construction, dues email rendering,
// and the dispatcher's terminal-attempt rule. No I/O, no Supabase, no Stripe
// imports so this stays unit-testable in isolation. The Stripe webhook builds
// rows with these helpers; the dispatcher cron sends them.

export type DuesNotificationType =
  | 'dues_renewed'
  | 'dues_payment_failed'
  | 'dues_lapsed'

// After this many failed send attempts the dispatcher gives up and marks the
// row 'failed' so it stops being retried every minute forever.
export const MAX_NOTIFICATION_ATTEMPTS = 5

// A row is terminal once it has burned through its attempt budget. The
// dispatcher uses this to decide 'failed' vs leaving it 'pending' for retry.
export function isTerminalAttempt(
  attempts: number,
  max: number = MAX_NOTIFICATION_ATTEMPTS,
): boolean {
  return attempts >= max
}

// Deterministic dedupe key. The (space_id, dedupe_key) unique index makes the
// webhook's enqueue idempotent: the same Stripe event replayed (different
// event id, same invoice) collapses to one notification. Empty/nullish parts
// are dropped so callers can pass optional ids without changing the shape.
export function notificationDedupeKey(
  parts: Array<string | number | null | undefined>,
): string {
  return parts
    .filter(p => p !== null && p !== undefined && String(p).length > 0)
    .map(String)
    .join(':')
}

// Renewal + payment-failed are keyed by the Stripe invoice (one mail per
// invoice outcome). Lapse is keyed by member + the period it lapsed for, so a
// member can lapse again next cycle but not be re-mailed for the same one.
// periodEnd can be absent (canceled/deleted subscriptions carry no item
// current_period_end); without a fallback every lapse would collapse to
// `dues_lapsed:<member>` and suppress every future lapse notice. Fall back to
// the subscription id (a new comeback subscription has a new id, so distinct
// lapses stay distinct).
export function duesDedupeKey(
  type: DuesNotificationType,
  ref: {
    invoiceId?: string | null
    memberId?: string | null
    periodEnd?: string | null
    subscriptionId?: string | null
  },
): string {
  if (type === 'dues_lapsed') {
    return notificationDedupeKey([
      'dues_lapsed',
      ref.memberId,
      ref.periodEnd || ref.subscriptionId,
    ])
  }
  return notificationDedupeKey([type, ref.invoiceId])
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', CAD: '$', EUR: '€', GBP: '£' }

// Stripe zero-decimal currencies: the smallest unit IS the major unit, so
// amounts are NOT scaled by 100 and have no fractional display. Source:
// Stripe "zero-decimal currencies" list.
export const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF',
  'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

export function isZeroDecimalCurrency(currency: string | null | undefined): boolean {
  return ZERO_DECIMAL_CURRENCIES.has((currency || 'USD').toUpperCase())
}

// amount is in major units, matching how the payments ledger stores it.
// Zero-decimal currencies render with no fractional part.
export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return ''
  const code = (currency || 'USD').toUpperCase()
  const sym = CURRENCY_SYMBOL[code]
  const n = isZeroDecimalCurrency(code) ? String(Math.round(amount)) : amount.toFixed(2)
  return sym ? `${sym}${n} ${code}` : `${n} ${code}`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// "Friday, May 22, 2026, 3:00 PM to 5:00 PM" if both sides parse; else best
// effort with whichever side is available. Used by booking + class renders.
function formatRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string {
  const start = formatDateTime(startIso)
  const end = formatDateTime(endIso)
  if (start && end) return `${start} to ${end}`
  return start || end || ''
}

function renderShell(lines: string[]): { html: string; text: string } {
  const text = lines.join('\n').trim() + '\n'
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;color:#111">` +
    lines
      .map(l => {
        if (l === '') return '<br/>'
        const safe = escapeHtml(l)
        const linked = safe.replace(
          /(https?:\/\/[^\s]+)/g,
          '<a href="$1" style="color:#2563eb">$1</a>',
        )
        return `<p style="margin:0 0 8px">${linked}</p>`
      })
      .join('') +
    `</div>`
  return { html, text }
}

export type DuesEmailInput = {
  type: DuesNotificationType
  spaceName: string
  memberName?: string | null
  amount?: number | null
  currency?: string | null
  periodEnd?: string | null
  manageUrl: string
}

export type RenderedEmail = { subject: string; html: string; text: string }

// Brand-neutral copy: this is a generic multi-space platform, the space name
// is injected, never hard-coded. Returns both an HTML and a plain-text body
// (Resend will also auto-generate text, but we send an explicit one).
export function renderDuesEmail(input: DuesEmailInput): RenderedEmail {
  const space = input.spaceName || 'your hackerspace'
  const name = input.memberName?.trim() || null
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const money = formatMoney(input.amount, input.currency)
  const renews = formatDate(input.periodEnd)

  let subject: string
  const lines: string[] = [greeting, '']

  if (input.type === 'dues_renewed') {
    subject = `Your ${space} dues renewed`
    lines.push(
      `Your membership dues at ${space} were charged${money ? ` (${money})` : ''} and your membership is current.`,
    )
    if (renews) lines.push(`Your next renewal is ${renews}.`)
    lines.push('', `Manage your billing: ${input.manageUrl}`)
  } else if (input.type === 'dues_payment_failed') {
    subject = `Action needed: ${space} dues payment failed`
    lines.push(
      `We could not process your latest membership dues payment at ${space}${money ? ` (${money})` : ''}.`,
      'Please update your payment method so your membership stays active. There is a short grace period before your membership is marked late.',
      '',
      `Update your payment method: ${input.manageUrl}`,
    )
  } else {
    subject = `Your ${space} membership is now marked late`
    lines.push(
      `Your membership dues at ${space} were not paid within the grace period, so your membership is now marked late.`,
      'You can restore it at any time by paying your dues.',
      '',
      `Pay your dues: ${input.manageUrl}`,
    )
  }

  const { html, text } = renderShell(lines)
  return { subject, html, text }
}

// ─── Booking (equipment reservation) ─────────────────────────────────────────

export type BookingNotificationType = 'booking_confirmed' | 'booking_cancelled'

// One row per reservation per event. A cancel-then-re-reserve produces a new
// reservation_id, so confirmation + cancel of the same reservation each fire
// once and never collide.
export function bookingDedupeKey(
  type: BookingNotificationType,
  reservationId: string,
): string {
  return notificationDedupeKey([type, reservationId])
}

export type BookingEmailInput = {
  type: BookingNotificationType
  spaceName: string
  memberName?: string | null
  equipmentName: string
  location?: string | null
  startsAt: string
  endsAt: string
  manageUrl: string
}

export function renderBookingEmail(input: BookingEmailInput): RenderedEmail {
  const space = input.spaceName || 'your hackerspace'
  const name = input.memberName?.trim() || null
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const equipment = input.equipmentName || 'the equipment'
  const range = formatRange(input.startsAt, input.endsAt)
  const location = (input.location || '').trim()

  let subject: string
  const lines: string[] = [greeting, '']

  if (input.type === 'booking_confirmed') {
    subject = `Reservation confirmed: ${equipment} at ${space}`
    lines.push(
      `Your reservation for ${equipment} at ${space} is confirmed${range ? ` for ${range}` : ''}.`,
    )
    if (location) lines.push(`Location: ${location}.`)
    lines.push('', `View your reservations: ${input.manageUrl}`)
  } else {
    subject = `Reservation cancelled: ${equipment} at ${space}`
    lines.push(
      `Your reservation for ${equipment} at ${space}${range ? ` for ${range}` : ''} was cancelled.`,
    )
    lines.push('', `View your reservations: ${input.manageUrl}`)
  }

  const { html, text } = renderShell(lines)
  return { subject, html, text }
}
