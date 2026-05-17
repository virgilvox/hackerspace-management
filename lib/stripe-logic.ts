// Pure, dependency-free decision logic for Stripe recurring dues. No Stripe
// SDK, no Supabase, no React. Unit-tested directly so the money-critical
// status mapping cannot silently drift. The locked rules (owner, 2026-05):
// per-space OWN keys; subscriptions; lapse = grace -> `late`, NEVER auto-
// inactive.

// Pin deliberately so an SDK/API bump is a conscious change (see
// integration-api-facts memory). Consumed by the server Stripe client.
export const STRIPE_API_VERSION = '2026-04-22.dahlia'

// Stripe subscription.status values that mean "the member has paid access".
const PAID = new Set(['active', 'trialing'])
// Terminal/failed states: access is gone. `past_due` is handled separately
// (grace window) and is deliberately NOT in either set here.
const LAPSED = new Set(['canceled', 'unpaid', 'incomplete', 'incomplete_expired'])

export function stripeStatusIsPaid(status: string | null | undefined): boolean {
  return !!status && PAID.has(status)
}

// Map a Stripe subscription status to the member status we should set.
// Returns `null` when no change is warranted (unknown/irrelevant status), so
// the caller never blindly overwrites. NEVER returns 'inactive' — lapse tops
// out at 'late' and an admin decides inactivation manually (locked decision).
// `graceExceeded` is computed by the caller (now past current_period_end +
// grace days); only relevant while `past_due`.
export function duesMemberStatus(
  stripeStatus: string | null | undefined,
  graceExceeded: boolean,
): 'current' | 'late' | null {
  if (!stripeStatus) return null
  if (PAID.has(stripeStatus)) return 'current'
  if (stripeStatus === 'past_due') return graceExceeded ? 'late' : 'current'
  if (LAPSED.has(stripeStatus)) return 'late'
  return null
}

// Whether `now` is past the grace window after the period end.
export function graceExceeded(
  currentPeriodEnd: string | null | undefined,
  graceDays: number,
  now?: Date | string,
): boolean {
  if (!currentPeriodEnd) return false
  const end = new Date(currentPeriodEnd).getTime()
  if (Number.isNaN(end)) return false
  const t = now == null ? Date.now() : new Date(now).getTime()
  return t > end + Math.max(0, graceDays) * 86_400_000
}

type StripeConfig = {
  mode?: string
  publishable_key?: string
  secret_key_ref?: string
  webhook_secret_ref?: string
  prices?: Record<string, string | null | undefined>
} | null | undefined

// The Stripe Price id mapped to a membership tier, or null if unmapped.
export function priceIdForTier(config: StripeConfig, tier: string | null | undefined): string | null {
  const p = config?.prices
  if (!p || !tier) return null
  const v = p[tier]
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

// Enough config to actually run Checkout: a publishable key, a secret-key
// vault ref, and at least one tier price mapped.
export function isStripeConfigured(config: StripeConfig): boolean {
  if (!config?.publishable_key || !config?.secret_key_ref) return false
  const prices = config.prices ?? {}
  return Object.values(prices).some(v => typeof v === 'string' && v.trim() !== '')
}
