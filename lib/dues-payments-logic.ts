// Pure logic for admin-configured alternate dues payment methods. These are
// external pay-here links (PayPal, Zeffy, Venmo) a member clicks to pay dues
// off-platform; a treasurer reconciles the payment manually later through the
// existing payments flow, which is why each method carries a payment_platform
// tag. No I/O here: the platform set + labels are shared by the admin settings
// UI and the member /me UI; URL validation is exercised by the Zod schema.

// The url-based subset of the payment_platform enum. 'cash' has no link and
// 'stripe' is the in-app integration, so neither is an external dues link.
export const DUES_LINK_PLATFORMS = ['paypal', 'zeffy', 'venmo'] as const

export type DuesLinkPlatform = (typeof DUES_LINK_PLATFORMS)[number]

export const DUES_PLATFORM_LABEL: Record<DuesLinkPlatform, string> = {
  paypal: 'PayPal',
  zeffy: 'Zeffy',
  venmo: 'Venmo',
}

export function isDuesLinkPlatform(p: string): p is DuesLinkPlatform {
  return (DUES_LINK_PLATFORMS as readonly string[]).includes(p)
}

// Advance-only dues state for a logged/linked payment. A payment — especially a
// backdated or historical one being reconciled — must never move a member's
// dues state backward. Given the member's current last_paid_at and the incoming
// payment's transaction_date, keep whichever date is later, and only mark the
// member 'current' when the incoming payment is actually the most recent one on
// file. A payment older than what's already recorded changes nothing: we return
// the existing date and omit payment_status so the caller leaves it untouched.
// Both inputs are full ISO timestamps; comparison is by instant, not string,
// so PostgREST offsets (`+00:00`) and toISOString `Z` never disagree.
export function resolveDuesAdvance(
  existing: string | null,
  incoming: string,
): { last_paid_at: string; payment_status?: 'current' } {
  if (existing !== null) {
    const existingT = new Date(existing).getTime()
    const incomingT = new Date(incoming).getTime()
    if (Number.isFinite(existingT) && Number.isFinite(incomingT) && incomingT < existingT) {
      return { last_paid_at: existing }
    }
  }
  return { last_paid_at: incoming, payment_status: 'current' }
}

// A payment link is only safe to render as a member-clickable anchor if it is
// an absolute https URL. http (plaintext) and any non-web scheme
// (javascript:, data:, mailto:, etc.) are rejected so an admin-entered value
// cannot become an XSS or a downgrade vector when shown to members.
export function isSafeDuesUrl(url: string): boolean {
  // Require the literal https:// prefix AND a parseable URL. The prefix check
  // keeps this in lockstep with the DB CHECK (`url ~* '^https://'`, migration
  // 050) so the app and data layers never disagree (e.g. `https:example.com`
  // parses to https: but lacks `//`, which the DB rejects); the parse check
  // rejects a bare `https://` with no host.
  if (!/^https:\/\//i.test(url)) return false
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}
