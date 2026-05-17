// Per-space Stripe webhook (per-space OWN keys, NOT Connect — so we route by
// path to know which signing secret to verify with). Raw body, signature
// verify, idempotency on Stripe's stable event id, then map the subscription
// lifecycle onto member_billing + member status (grace -> late, never auto-
// inactive). Unauthenticated by design (Stripe calls it); there is no auth
// middleware in this app, and every DB write is post-signature-verify.
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import { getStripeConfig, readStripeSecret } from '@/lib/stripe/config'
import { duesMemberStatus, graceExceeded } from '@/lib/stripe-logic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isoFromUnix(s: number | null | undefined): string | null {
  return typeof s === 'number' && s > 0 ? new Date(s * 1000).toISOString() : null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ space: string }> },
) {
  const { space: spaceId } = await params
  const admin = createAdminClient()

  const cfg = await getStripeConfig(admin, spaceId)
  const secret = cfg ? await readStripeSecret(admin, spaceId, cfg.secret_key_ref) : null
  const webhookSecret = cfg ? await readStripeSecret(admin, spaceId, cfg.webhook_secret_ref) : null
  if (!secret || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured for this space' }, { status: 400 })
  }

  const raw = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const stripe = getStripe(secret)
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid signature' },
      { status: 400 },
    )
  }

  // Idempotency: the unique PK rejects a replay; treat that as already-done.
  const dedupe = await admin
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, space_id: spaceId, type: event.type })
  if (dedupe.error) {
    if (/duplicate key|already exists|unique/i.test(dedupe.error.message)) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    return NextResponse.json({ error: dedupe.error.message }, { status: 500 })
  }

  const graceDays = cfg?.grace_days ?? 7

  // Resolve our member: prefer metadata (set on the subscription + session),
  // else map the Stripe customer id back via member_billing. Always confirm
  // the member is in THIS space.
  async function resolveMemberId(
    metaMemberId: string | undefined,
    customerId: string | null | undefined,
  ): Promise<string | null> {
    if (metaMemberId) {
      const { data } = await admin
        .from('space_members')
        .select('id')
        .eq('id', metaMemberId)
        .eq('space_id', spaceId)
        .maybeSingle()
      if (data) return data.id as string
    }
    if (customerId) {
      const { data } = await admin
        .from('member_billing')
        .select('member_id')
        .eq('space_id', spaceId)
        .eq('stripe_customer_id', customerId)
        .maybeSingle()
      if (data) return data.member_id as string
    }
    return null
  }

  async function applySubscription(sub: Stripe.Subscription) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null
    const memberId = await resolveMemberId(
      (sub.metadata?.member_id as string | undefined) || undefined,
      customerId,
    )
    if (!memberId) return
    const periodEnd = isoFromUnix((sub as unknown as { current_period_end?: number }).current_period_end)

    await admin.from('member_billing').upsert(
      {
        space_id: spaceId,
        member_id: memberId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'space_id,member_id' },
    )

    const desired = duesMemberStatus(sub.status, graceExceeded(periodEnd, graceDays))
    if (desired) {
      // Only move between current<->late; never resurrect inactive or
      // auto-approve unverified via billing.
      const patch: Record<string, unknown> = { status: desired }
      if (desired === 'current') patch.last_paid_at = new Date().toISOString()
      await admin
        .from('space_members')
        .update(patch)
        .eq('id', memberId)
        .eq('space_id', spaceId)
        .in('status', ['current', 'late'])
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          await applySubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await applySubscription(event.data.object as Stripe.Subscription)
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice
        const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null
        const memberId = await resolveMemberId(
          (inv.subscription_details?.metadata?.member_id as string | undefined) || undefined,
          customerId,
        )
        await admin.from('payments').insert({
          space_id: spaceId,
          member_id: memberId,
          platform: 'stripe',
          amount: (inv.amount_paid ?? 0) / 100,
          currency: (inv.currency ?? 'usd').toUpperCase(),
          description: inv.description ?? 'Stripe membership dues',
          status: memberId ? 'linked' : 'unlinked',
          link_status: memberId ? 'linked' : 'unlinked',
          external_id: inv.id,
          payer_email: inv.customer_email ?? null,
          from_identifier: inv.customer_email ?? null,
          transaction_date: new Date().toISOString(),
          raw_data: { event_id: event.id, invoice: inv.id },
        })
        if (memberId) {
          await admin
            .from('space_members')
            .update({ last_paid_at: new Date().toISOString() })
            .eq('id', memberId)
            .eq('space_id', spaceId)
            .in('status', ['current', 'late'])
        }
        break
      }
      // invoice.payment_failed: the subsequent customer.subscription.updated
      // (status past_due) drives the lapse logic; nothing to record here.
      default:
        break
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'handler error' },
      { status: 500 },
    )
  }

  return NextResponse.json({ received: true })
}
