'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { startDuesCheckout, startBillingPortal } from '@/lib/actions'
import { DUES_PLATFORM_LABEL, type DuesLinkPlatform } from '@/lib/dues-payments-logic'

type Billing = {
  status: string | null
  currentPeriodEnd: string | null
  hasCustomer: boolean
  configured: boolean
} | null

export type DuesMethod = {
  platform: string
  url: string
  instructions: string | null
}

const PAID = new Set(['active', 'trialing'])

const platformLabel = (p: string) =>
  DUES_PLATFORM_LABEL[p as DuesLinkPlatform] ?? p

export function DuesCard({ billing, methods = [] }: { billing: Billing; methods?: DuesMethod[] }) {
  const [busy, setBusy] = useState(false)
  const paid = !!billing?.status && PAID.has(billing.status)
  const stripeReady = !!billing?.configured
  const hasAltMethods = methods.length > 0

  async function go(fn: () => Promise<{ error?: string } | { data: { url: string } }>) {
    setBusy(true)
    const res = await fn()
    if ('error' in res && res.error) {
      setBusy(false)
      return toast.error(res.error)
    }
    window.location.href = (res as { data: { url: string } }).data.url
  }

  return (
    <div className="bg-card rounded border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-sans text-sm font-medium text-foreground">Membership dues</p>
          {billing?.status ? (
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              {billing.status}
              {billing.currentPeriodEnd
                ? ` · renews ${new Date(billing.currentPeriodEnd).toLocaleDateString()}`
                : ''}
            </p>
          ) : stripeReady ? (
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">No active dues subscription.</p>
          ) : null}
        </div>
        {billing?.status && (
          <Badge variant={paid ? 'default' : 'outline'}>{paid ? 'Current' : 'Action needed'}</Badge>
        )}
      </div>

      {/* Stripe Checkout / Portal: only when the space has Stripe set up. */}
      {(stripeReady && (!paid || billing?.hasCustomer)) && (
        <div className="flex gap-2">
          {!paid && (
            <Button size="sm" disabled={busy} onClick={() => go(startDuesCheckout)}>
              {busy ? 'Opening…' : 'Pay dues with card'}
            </Button>
          )}
          {billing?.hasCustomer && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => go(startBillingPortal)}>
              Manage billing
            </Button>
          )}
        </div>
      )}

      {/* Admin-configured external links. Shown when the member still owes dues. */}
      {!paid && hasAltMethods && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {stripeReady ? 'Other ways to pay' : 'Pay your dues'}
          </p>
          <div className="flex flex-col gap-2">
            {methods.map(m => (
              <a
                key={m.platform}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded border border-border bg-background px-3 py-2 hover:border-primary transition"
              >
                <div className="min-w-0">
                  <span className="font-sans text-sm text-foreground">Pay with {platformLabel(m.platform)}</span>
                  {m.instructions && (
                    <p className="font-sans text-xs text-muted-foreground mt-0.5">{m.instructions}</p>
                  )}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">open ↗</span>
              </a>
            ))}
          </div>
          <p className="font-sans text-xs text-muted-foreground">
            These open an external payment page. Your payment is recorded by a treasurer after it
            clears.
          </p>
        </div>
      )}

      {/* Nothing set up at all. */}
      {!paid && !stripeReady && !hasAltMethods && (
        <p className="font-sans text-sm text-muted-foreground">
          Online dues payment isn&rsquo;t set up for this space yet. Contact an admin to pay your dues.
        </p>
      )}
    </div>
  )
}
