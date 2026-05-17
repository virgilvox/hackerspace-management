'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember, requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'
import { stripeSettingsSchema } from '@/lib/validations'
import { isStripeConfigured, priceIdForTier } from '@/lib/stripe-logic'
import { getStripeConfig, storeStripeSecret, readStripeSecret, type StripeConfig } from '@/lib/stripe/config'
import { getStripe } from '@/lib/stripe/client'

async function appOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : 'https://hackerspace.sh'
}

// Admin-facing settings view. NEVER returns secret values, only whether they
// are set, so the config screen can show status without exposing keys.
export async function getStripeSettings() {
  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const cfg = (await getStripeConfig(createAdminClient(), member.space_id)) ?? {}
  return {
    data: {
      mode: cfg.mode ?? 'test',
      publishable_key: cfg.publishable_key ?? '',
      grace_days: cfg.grace_days ?? 7,
      prices: cfg.prices ?? {},
      hasSecretKey: !!cfg.secret_key_ref,
      hasWebhookSecret: !!cfg.webhook_secret_ref,
      configured: isStripeConfigured(cfg),
    },
  }
}

export async function saveStripeSettings(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const v = parseInput(stripeSettingsSchema, input)
  if (!v.ok) return { error: v.error }
  const s = v.data

  const admin = createAdminClient()
  const existing = (await getStripeConfig(admin, member.space_id)) ?? {}

  // Secret fields are write-only: a provided non-blank value rotates the
  // stored secret; blank/omitted keeps the existing ref.
  let secretKeyRef = existing.secret_key_ref
  if (s.secret_key && s.secret_key.trim()) {
    const id = await storeStripeSecret(admin, member.space_id, 'Stripe secret key', s.secret_key.trim(), user?.id ?? null)
    if (!id) return { error: 'Could not store the Stripe secret key.' }
    secretKeyRef = id
  }
  let webhookRef = existing.webhook_secret_ref
  if (s.webhook_secret && s.webhook_secret.trim()) {
    const id = await storeStripeSecret(admin, member.space_id, 'Stripe webhook signing secret', s.webhook_secret.trim(), user?.id ?? null)
    if (!id) return { error: 'Could not store the Stripe webhook secret.' }
    webhookRef = id
  }

  const prices: Record<string, string> = {}
  for (const [k, val] of Object.entries(s.prices ?? {})) {
    if (typeof val === 'string' && val.trim()) prices[k] = val.trim()
  }

  const config: StripeConfig = {
    mode: s.mode,
    publishable_key: s.publishable_key?.trim() || undefined,
    secret_key_ref: secretKeyRef,
    webhook_secret_ref: webhookRef,
    grace_days: s.grace_days ?? 7,
    prices,
  }

  const { error } = await admin.from('integrations').upsert(
    {
      space_id: member.space_id,
      platform: 'stripe',
      name: 'Stripe',
      is_connected: isStripeConfigured(config),
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'space_id,platform' },
  )
  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { data: { ok: true, configured: isStripeConfigured(config) } }
}

// ─── Member dues: checkout + portal + own status ─────────────────────────────

// Start a hosted Checkout in subscription mode for the caller's membership
// tier. Self-only: the member + tier are resolved server-side; metadata is
// set on BOTH the session and the subscription (session metadata does not
// propagate to the subscription — verified gotcha).
export async function startDuesCheckout() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const admin = createAdminClient()
  const cfg = await getStripeConfig(admin, member.space_id)
  if (!cfg || !isStripeConfigured(cfg)) return { error: 'Online dues are not set up for this space yet.' }
  const secret = await readStripeSecret(admin, member.space_id, cfg.secret_key_ref)
  if (!secret) return { error: 'Stripe is misconfigured (no secret key). Ask an admin.' }

  const { data: m } = await admin
    .from('space_members')
    .select('tier, email, display_name')
    .eq('id', member.id)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!m) return { error: 'Member not found' }
  const price = priceIdForTier(cfg, m.tier as string | null)
  if (!price) return { error: 'No dues plan is configured for your membership tier yet.' }

  try {
    const stripe = getStripe(secret)
    const { data: billing } = await admin
      .from('member_billing')
      .select('stripe_customer_id')
      .eq('space_id', member.space_id)
      .eq('member_id', member.id)
      .maybeSingle()

    let customerId = billing?.stripe_customer_id as string | undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (m.email as string | null) ?? undefined,
        name: (m.display_name as string | null) ?? undefined,
        metadata: { space_id: member.space_id, member_id: member.id },
      })
      customerId = customer.id
      await admin
        .from('member_billing')
        .upsert(
          { space_id: member.space_id, member_id: member.id, stripe_customer_id: customerId },
          { onConflict: 'space_id,member_id' },
        )
    }

    const origin = await appOrigin()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      client_reference_id: member.id,
      metadata: { space_id: member.space_id, member_id: member.id },
      subscription_data: { metadata: { space_id: member.space_id, member_id: member.id } },
      success_url: `${origin}/me?dues=success`,
      cancel_url: `${origin}/me?dues=cancelled`,
    })
    if (!session.url) return { error: 'Stripe did not return a checkout URL.' }
    return { data: { url: session.url } }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not start checkout.' }
  }
}

// Stripe-hosted Billing Portal so the member manages card/plan/cancel.
export async function startBillingPortal() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const admin = createAdminClient()
  const cfg = await getStripeConfig(admin, member.space_id)
  const secret = cfg ? await readStripeSecret(admin, member.space_id, cfg.secret_key_ref) : null
  if (!secret) return { error: 'Billing is not set up for this space.' }

  const { data: billing } = await admin
    .from('member_billing')
    .select('stripe_customer_id')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .maybeSingle()
  const customerId = billing?.stripe_customer_id as string | undefined
  if (!customerId) return { error: 'No billing on file yet — pay your dues first.' }

  try {
    const stripe = getStripe(secret)
    const origin = await appOrigin()
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/me`,
    })
    return { data: { url: portal.url } }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not open the billing portal.' }
  }
}

// The caller's own billing status (member_billing is admin-readable via RLS,
// so the self-view goes through the service client, like getMyCards).
export async function getMyBilling() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data } = await createAdminClient()
    .from('member_billing')
    .select('subscription_status, current_period_end, stripe_customer_id')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .maybeSingle()
  return {
    data: data
      ? {
          status: (data.subscription_status as string | null) ?? null,
          currentPeriodEnd: (data.current_period_end as string | null) ?? null,
          hasCustomer: !!data.stripe_customer_id,
        }
      : null,
  }
}

// Admin dues view: every member's billing status.
export async function listMemberBilling() {
  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ['admin', 'board', 'treasurer'], 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await createAdminClient()
    .from('member_billing')
    .select('member_id, subscription_status, current_period_end, space_members!member_billing_member_id_fkey(display_name, email, tier)')
    .eq('space_id', member.space_id)
    .order('updated_at', { ascending: false })
  if (error) return { error: error.message }
  return {
    data: (data ?? []).map(r => {
      const sm = r.space_members as { display_name: string | null; email: string | null; tier: string | null } | { display_name: string | null; email: string | null; tier: string | null }[] | null
      const mem = Array.isArray(sm) ? sm[0] : sm
      return {
        memberId: r.member_id as string,
        name: mem?.display_name ?? 'Member',
        email: mem?.email ?? null,
        tier: mem?.tier ?? null,
        status: (r.subscription_status as string | null) ?? null,
        currentPeriodEnd: (r.current_period_end as string | null) ?? null,
      }
    }),
  }
}
