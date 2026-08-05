'use client'

import { StripeBillingPanel } from '@/components/settings/stripe-billing-panel'
import { DuesPaymentMethodsPanel } from '@/components/settings/dues-payment-methods-panel'

// Dues Tab: how members pay dues (Stripe recurring + external links)
export function DuesPanel({ spaceId }: { spaceId: string }) {
  return (
    <div className="space-y-6">
      <StripeBillingPanel spaceId={spaceId} />
      <DuesPaymentMethodsPanel />
    </div>
  )
}
