// Pure decision + mapping logic for the Stripe webhook. No Stripe SDK, no
// Supabase, no I/O — structural input types only, so every branch is unit-
// testable in isolation. The route handler keeps only signature verify,
// network calls, and DB writes; all "what should we derive/record" logic
// lives here. Status mapping itself stays in lib/stripe-logic.ts
// (duesMemberStatus / graceExceeded); this module is the webhook-shaped glue
// around it, including the Stripe Basil (2025-03-31 / 2026-04-22.dahlia)
// field relocations that are easy to get wrong and must be tested.

import { isZeroDecimalCurrency } from '@/lib/notifications-logic'

type CustomerRef = string | { id?: string | null } | null | undefined

type SubscriptionLike = {
  items?: { data?: Array<{ current_period_end?: number } | null | undefined> }
}

type InvoiceLike = {
  id?: string | null
  amount_paid?: number | null
  amount_due?: number | null
  currency?: string | null
  description?: string | null
  customer_email?: string | null
  parent?: { subscription_details?: { metadata?: Record<string, string> | null } | null } | null
  lines?: { data?: Array<{ period?: { end?: number } | null } | null> } | null
}

export function isoFromUnix(s: number | null | undefined): string | null {
  return typeof s === 'number' && s > 0 ? new Date(s * 1000).toISOString() : null
}

// Stripe customer is either an id string or an expanded object.
export function customerIdOf(customer: CustomerRef): string | null {
  if (typeof customer === 'string') return customer || null
  return customer?.id ?? null
}

// Basil moved the billing period off the top-level Subscription onto each
// item. Dues are a single-price subscription, so item 0 carries it.
export function subscriptionPeriodEnd(sub: SubscriptionLike | null | undefined): string | null {
  return isoFromUnix(sub?.items?.data?.[0]?.current_period_end)
}

// Basil moved invoice subscription metadata under
// invoice.parent.subscription_details.metadata.
export function invoiceMetadataMemberId(inv: InvoiceLike | null | undefined): string | undefined {
  return inv?.parent?.subscription_details?.metadata?.member_id || undefined
}

// Next renewal date for the renewal receipt: the paid invoice line's period
// end. Absent on some invoices -> null (email simply omits the date).
export function invoiceLinePeriodEnd(inv: InvoiceLike | null | undefined): string | null {
  return isoFromUnix(inv?.lines?.data?.[0]?.period?.end)
}

// Build the space_members patch for a billing-driven status change. Only
// current<->late ever moves (the route additionally constrains the UPDATE to
// rows already in those states, so inactive/unverified are never touched).
// Returns null when there is no status to apply.
export function memberStatusPatch(
  desired: 'current' | 'late' | null | undefined,
  nowIso: string,
): { status: 'current' | 'late'; last_paid_at?: string } | null {
  if (!desired) return null
  if (desired === 'current') return { status: 'current', last_paid_at: nowIso }
  return { status: 'late' }
}

// Stripe amounts are in minor units; the payments ledger stores major units
// (numeric, matching the existing PayPal/CSV rows). Centralized so the cents
// division + currency casing + link status can be tested once.
export function stripeInvoiceToPaymentRow(args: {
  inv: InvoiceLike
  spaceId: string
  memberId: string | null
  eventId: string
  nowIso: string
}) {
  const { inv, spaceId, memberId, eventId, nowIso } = args
  const linked = memberId ? 'linked' : 'unlinked'
  return {
    space_id: spaceId,
    member_id: memberId,
    platform: 'stripe' as const,
    amount: minorToMajor(inv.amount_paid, inv.currency),
    currency: (inv.currency ?? 'usd').toUpperCase(),
    description: inv.description ?? 'Stripe membership dues',
    status: linked,
    link_status: linked,
    external_id: inv.id ?? null,
    payer_email: inv.customer_email ?? null,
    from_identifier: inv.customer_email ?? null,
    transaction_date: nowIso,
    raw_data: { event_id: eventId, invoice: inv.id ?? null },
  }
}

// Stripe sends most amounts in minor units (cents) but zero-decimal
// currencies (JPY, KRW, ...) already in the major unit — dividing those by
// 100 would understate the ledger + receipt 100x. Currency-aware.
export function minorToMajor(
  amount: number | null | undefined,
  currency: string | null | undefined,
): number {
  const a = amount ?? 0
  return isZeroDecimalCurrency(currency) ? a : a / 100
}

// Stripe does not guarantee webhook ordering. A stale/late
// customer.subscription.updated carrying an OLDER period must never rewind
// the stored current_period_end (that would make graceExceeded flip a paid
// member to 'late' and fire a false "dues lapsed" email). Keep the later of
// stored vs incoming. ISO-8601 UTC ('...Z') strings sort lexically ==
// chronologically, so string compare is correct here.
export function laterPeriodEnd(
  stored: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  if (!stored) return incoming ?? null
  if (!incoming) return stored
  return stored >= incoming ? stored : incoming
}
