'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { startDuesCheckout, startBillingPortal } from '@/lib/actions'

type Billing = { status: string | null; currentPeriodEnd: string | null; hasCustomer: boolean } | null

const PAID = new Set(['active', 'trialing'])

export function DuesCard({ billing }: { billing: Billing }) {
  const [busy, setBusy] = useState(false)
  const paid = !!billing?.status && PAID.has(billing.status)

  async function go(fn: () => Promise<{ error?: string } | { data: { url: string } }>) {
    setBusy(true)
    const res = await fn()
    if ('error' in res && res.error) { setBusy(false); return toast.error(res.error) }
    window.location.href = (res as { data: { url: string } }).data.url
  }

  return (
    <div className="bg-card rounded border border-border p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-sans text-sm font-medium text-foreground">Membership dues</p>
          {billing?.status ? (
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              {billing.status}
              {billing.currentPeriodEnd
                ? ` · renews ${new Date(billing.currentPeriodEnd).toLocaleDateString()}`
                : ''}
            </p>
          ) : (
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">No active dues subscription.</p>
          )}
        </div>
        {billing?.status && (
          <Badge variant={paid ? 'default' : 'outline'}>{paid ? 'Current' : 'Action needed'}</Badge>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        {!paid && (
          <Button size="sm" disabled={busy} onClick={() => go(startDuesCheckout)}>
            {busy ? 'Opening…' : 'Pay dues'}
          </Button>
        )}
        {billing?.hasCustomer && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => go(startBillingPortal)}>
            Manage billing
          </Button>
        )}
      </div>
    </div>
  )
}
