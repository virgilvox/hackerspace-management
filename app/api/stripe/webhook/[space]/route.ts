// Per-space Stripe webhook (per-space OWN keys, NOT Connect — so we route by
// path to know which signing secret to verify with). Raw body, signature
// verify, idempotency on Stripe's stable event id, then map the subscription
// lifecycle onto member_billing + member status (grace -> late, never auto-
// inactive). Unauthenticated by design (Stripe calls it). proxy.ts auth-
// gates everything by default and redirects to /login, which Stripe would
// NOT follow — so this exact path is whitelisted in proxy.ts PUBLIC_ROUTES.
// Trust is the per-space webhook signature; every DB write is
// post-signature-verify.
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import { getStripeConfig, readStripeSecret } from '@/lib/stripe/config'
import { duesMemberStatus, graceExceeded } from '@/lib/stripe-logic'
import {
  renderDuesEmail,
  duesDedupeKey,
  type DuesNotificationType,
} from '@/lib/notifications-logic'

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

  // Stripe sets Host to the configured webhook URL's host; fall back to the
  // app URL. Used only to build the "manage billing" link in the email.
  const hookHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const hookProto = req.headers.get('x-forwarded-proto') ?? 'https'
  const manageUrl = `${
    hookHost ? `${hookProto}://${hookHost}` : process.env.NEXT_PUBLIC_APP_URL || 'https://hackerspace.sh'
  }/me`

  let spaceNameMemo: string | null = null
  async function getSpaceName(): Promise<string> {
    if (spaceNameMemo !== null) return spaceNameMemo
    const { data } = await admin.from('spaces').select('name').eq('id', spaceId).maybeSingle()
    spaceNameMemo = (data?.name as string | null) ?? ''
    return spaceNameMemo
  }

  // Enqueue a dues-lifecycle email into the notifications outbox. NEVER sends
  // inline (keeps this money path fast + retry-safe); the dispatcher cron
  // sends. ignoreDuplicates + the (space_id, dedupe_key) unique index make a
  // Stripe event replay (new event id, same invoice/period) a no-op.
  //
  // BEST-EFFORT: the entire body is wrapped so a notifications-table or
  // render failure can NEVER throw into the money path. The Stripe ledger /
  // member_billing / status writes must finalize even if email infra is
  // down; a missed enqueue is acceptable, a wedged money path is not.
  async function enqueueDues(
    type: DuesNotificationType,
    args: {
      memberId: string | null
      fallbackEmail?: string | null
      amount?: number | null
      currency?: string | null
      periodEnd?: string | null
      invoiceId?: string | null
      subscriptionId?: string | null
    },
  ): Promise<void> {
    try {
      if (!args.memberId) return
      const { data: mem } = await admin
        .from('space_members')
        .select('email, display_name')
        .eq('id', args.memberId)
        .eq('space_id', spaceId)
        .maybeSingle()
      const recipient = ((mem?.email as string | null) || args.fallbackEmail || '').trim()
      if (!recipient) return
      const { subject, html, text } = renderDuesEmail({
        type,
        spaceName: await getSpaceName(),
        memberName: (mem?.display_name as string | null) ?? null,
        amount: args.amount ?? null,
        currency: args.currency ?? null,
        periodEnd: args.periodEnd ?? null,
        manageUrl,
      })
      const { error: enqErr } = await admin.from('notifications').upsert(
        {
          space_id: spaceId,
          member_id: args.memberId,
          type,
          channel: 'email',
          recipient,
          subject,
          body_html: html,
          body_text: text,
          status: 'pending',
          dedupe_key: duesDedupeKey(type, {
            invoiceId: args.invoiceId,
            memberId: args.memberId,
            periodEnd: args.periodEnd,
            subscriptionId: args.subscriptionId,
          }),
        },
        { onConflict: 'space_id,dedupe_key', ignoreDuplicates: true },
      )
      if (enqErr) console.error(`[stripe webhook] enqueue ${type} failed:`, enqErr.message)
    } catch (e) {
      console.error(
        `[stripe webhook] enqueue ${type} threw:`,
        e instanceof Error ? e.message : e,
      )
    }
  }

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
    // API 2026-04-22.dahlia (Basil 2025-03-31): the billing period moved off
    // the top-level Subscription onto each subscription item. Dues are a
    // single-price subscription, so item 0 carries the period end.
    const periodEnd = isoFromUnix(
      (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)
        ?.current_period_end,
    )

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

    // Dues lapsed past grace -> one "marked late" email per lapsed period
    // (dedupe is member + periodEnd, so next cycle can lapse again).
    if (desired === 'late') {
      await enqueueDues('dues_lapsed', { memberId, periodEnd, subscriptionId: sub.id })
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
      // Handle ONLY invoice.paid (Stripe also fires invoice.payment_succeeded
      // for the same invoice — handling both would double the ledger).
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice
        const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null
        // API 2026-04-22.dahlia (Basil): invoice subscription + its metadata
        // moved under invoice.parent.subscription_details.
        const invParent = (inv as unknown as {
          parent?: { subscription_details?: { metadata?: Record<string, string> } }
        }).parent
        const memberId = await resolveMemberId(
          invParent?.subscription_details?.metadata?.member_id || undefined,
          customerId,
        )
        // Ledger idempotency: invoice.paid + a retry are distinct event ids
        // but the same invoice; never double-record one charge.
        const { data: dupe } = await admin
          .from('payments')
          .select('id')
          .eq('space_id', spaceId)
          .eq('platform', 'stripe')
          .eq('external_id', inv.id)
          .maybeSingle()
        if (!dupe) {
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
        }
        if (memberId) {
          await admin
            .from('space_members')
            .update({ last_paid_at: new Date().toISOString() })
            .eq('id', memberId)
            .eq('space_id', spaceId)
            .in('status', ['current', 'late'])
        }
        const paidPeriodEnd = isoFromUnix(
          (inv as unknown as {
            lines?: { data?: Array<{ period?: { end?: number } }> }
          }).lines?.data?.[0]?.period?.end,
        )
        await enqueueDues('dues_renewed', {
          memberId,
          fallbackEmail: inv.customer_email ?? null,
          amount: (inv.amount_paid ?? 0) / 100,
          currency: (inv.currency ?? 'usd').toUpperCase(),
          periodEnd: paidPeriodEnd,
          invoiceId: inv.id,
        })
        break
      }
      // The card failed. Send the "payment failed" notice now; the lapse-to-
      // late email is driven separately by the later customer.subscription.
      // updated (status past_due past grace) through applySubscription.
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null
        const invParent = (inv as unknown as {
          parent?: { subscription_details?: { metadata?: Record<string, string> } }
        }).parent
        const memberId = await resolveMemberId(
          invParent?.subscription_details?.metadata?.member_id || undefined,
          customerId,
        )
        await enqueueDues('dues_payment_failed', {
          memberId,
          fallbackEmail: inv.customer_email ?? null,
          amount: (inv.amount_due ?? 0) / 100,
          currency: (inv.currency ?? 'usd').toUpperCase(),
          invoiceId: inv.id,
        })
        break
      }
      default:
        break
    }
  } catch (e) {
    // The dedupe row was written BEFORE processing; if processing failed,
    // remove it so Stripe's retry of this same event is reprocessed rather
    // than silently short-circuited as a duplicate (no lost events).
    await admin.from('stripe_webhook_events').delete().eq('event_id', event.id)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'handler error' },
      { status: 500 },
    )
  }

  return NextResponse.json({ received: true })
}
