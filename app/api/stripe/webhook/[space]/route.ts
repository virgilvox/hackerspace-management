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
  customerIdOf,
  subscriptionPeriodEnd,
  invoiceMetadataMemberId,
  invoiceLinePeriodEnd,
  memberStatusPatch,
  stripeInvoiceToPaymentRow,
  minorToMajor,
  laterPeriodEnd,
} from '@/lib/stripe/webhook-logic'
import {
  renderDuesEmail,
  duesDedupeKey,
  type DuesNotificationType,
} from '@/lib/notifications-logic'
import {
  enqueueNotification,
  resolveMemberContact,
  getSpaceName as readSpaceName,
  buildManageUrl,
} from '@/lib/notifications/enqueue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    // Do not echo the verification library's message to an unauthenticated
    // caller; log server-side for debugging.
    console.error('[stripe webhook] signature verify failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency: the unique PK rejects a replay; treat that as already-done.
  const dedupe = await admin
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, space_id: spaceId, type: event.type })
  if (dedupe.error) {
    if (/duplicate key|already exists|unique/i.test(dedupe.error.message)) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('[stripe webhook] dedupe insert failed:', dedupe.error.message)
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
  }

  const graceDays = cfg?.grace_days ?? 7

  // Stripe sets Host to the configured webhook URL's host; fall back to the
  // app URL. Used only to build the "manage billing" link in the email.
  const manageUrl = buildManageUrl(
    req.headers.get('x-forwarded-host') ?? req.headers.get('host'),
    req.headers.get('x-forwarded-proto') ?? 'https',
  )

  let spaceNameMemo: string | null = null
  async function getSpaceName(): Promise<string> {
    if (spaceNameMemo !== null) return spaceNameMemo
    spaceNameMemo = await readSpaceName(admin, spaceId)
    return spaceNameMemo
  }

  // Enqueue a dues-lifecycle email into the notifications outbox. NEVER sends
  // inline (keeps this money path fast + retry-safe); the dispatcher cron
  // sends. Goes through the shared outbox helper: best-effort wrapped, so a
  // notifications-table or render failure can never throw into the money path.
  // Idempotent via (space_id, dedupe_key) so a Stripe event replay collapses.
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
    if (!args.memberId) return
    const contact = await resolveMemberContact(admin, spaceId, args.memberId)
    const recipient = ((contact?.email ?? null) || args.fallbackEmail || '').trim()
    if (!recipient) return
    const { subject, html, text } = renderDuesEmail({
      type,
      spaceName: await getSpaceName(),
      memberName: contact?.displayName ?? null,
      amount: args.amount ?? null,
      currency: args.currency ?? null,
      periodEnd: args.periodEnd ?? null,
      manageUrl,
    })
    await enqueueNotification(admin, {
      spaceId,
      memberId: args.memberId,
      type,
      recipient,
      subject,
      bodyHtml: html,
      bodyText: text,
      dedupeKey: duesDedupeKey(type, {
        invoiceId: args.invoiceId,
        memberId: args.memberId,
        periodEnd: args.periodEnd,
        subscriptionId: args.subscriptionId,
      }),
    })
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
    const customerId = customerIdOf(sub.customer)
    const memberId = await resolveMemberId(
      (sub.metadata?.member_id as string | undefined) || undefined,
      customerId,
    )
    if (!memberId) return
    const incomingPeriodEnd = subscriptionPeriodEnd(sub)

    // Never rewind the period on a stale/out-of-order event. Status still
    // reflects the latest sub.status, but graceExceeded is computed from the
    // monotonic (non-rewound) period so a late event can't false-lapse a
    // paid member.
    const { data: existingBilling } = await admin
      .from('member_billing')
      .select('current_period_end')
      .eq('space_id', spaceId)
      .eq('member_id', memberId)
      .maybeSingle()
    const periodEnd = laterPeriodEnd(
      (existingBilling?.current_period_end as string | null) ?? null,
      incomingPeriodEnd,
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
    const patch = memberStatusPatch(desired, new Date().toISOString())
    if (patch) {
      // Only move between current<->late; never resurrect inactive or
      // auto-approve unverified via billing.
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
        const customerId = customerIdOf(inv.customer)
        const memberId = await resolveMemberId(invoiceMetadataMemberId(inv), customerId)
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
          await admin.from('payments').insert(
            stripeInvoiceToPaymentRow({
              inv,
              spaceId,
              memberId,
              eventId: event.id,
              nowIso: new Date().toISOString(),
            }),
          )
        }
        if (memberId) {
          await admin
            .from('space_members')
            .update({ last_paid_at: new Date().toISOString() })
            .eq('id', memberId)
            .eq('space_id', spaceId)
            .in('status', ['current', 'late'])
        }
        await enqueueDues('dues_renewed', {
          memberId,
          fallbackEmail: inv.customer_email ?? null,
          amount: minorToMajor(inv.amount_paid, inv.currency),
          currency: (inv.currency ?? 'usd').toUpperCase(),
          periodEnd: invoiceLinePeriodEnd(inv),
          invoiceId: inv.id,
        })
        break
      }
      // The card failed. Send the "payment failed" notice now; the lapse-to-
      // late email is driven separately by the later customer.subscription.
      // updated (status past_due past grace) through applySubscription.
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        const memberId = await resolveMemberId(
          invoiceMetadataMemberId(inv),
          customerIdOf(inv.customer),
        )
        await enqueueDues('dues_payment_failed', {
          memberId,
          fallbackEmail: inv.customer_email ?? null,
          amount: minorToMajor(inv.amount_due, inv.currency),
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
    console.error('[stripe webhook] handler error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
