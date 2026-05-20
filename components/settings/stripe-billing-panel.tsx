'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getStripeSettings, saveStripeSettings } from '@/lib/actions'

const TIERS = ['plus', 'basic', 'associate'] as const
const input =
  'w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary'

type Settings = {
  mode: 'test' | 'live'
  publishable_key: string
  grace_days: number
  prices: Record<string, string>
  hasSecretKey: boolean
  hasWebhookSecret: boolean
  configured: boolean
}

export function StripeBillingPanel({ spaceId }: { spaceId: string }) {
  const [s, setS] = useState<Settings | null>(null)
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/stripe/webhook/${spaceId}`)
    getStripeSettings().then(r => {
      if ('data' in r) setS(r.data as Settings)
    })
  }, [spaceId])

  if (!s) return null

  async function save() {
    if (!s) return
    setBusy(true)
    const res = await saveStripeSettings({
      mode: s.mode,
      publishable_key: s.publishable_key || null,
      secret_key: secretKey || null,
      webhook_secret: webhookSecret || null,
      grace_days: s.grace_days,
      prices: s.prices,
    })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    setSecretKey('')
    setWebhookSecret('')
    const r = await getStripeSettings()
    if ('data' in r) setS(r.data as Settings)
    toast.success('Stripe settings saved')
  }

  return (
    <div className="bg-card rounded border border-border p-6">
      <div className="max-w-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Stripe recurring dues
          </h2>
          <span className={`font-mono text-[10px] ${s.configured ? 'text-primary' : 'text-muted-foreground'}`}>
            {s.configured ? 'configured' : 'not configured'}
          </span>
        </div>
        <p className="font-sans text-xs text-muted-foreground">
          Uses your space&rsquo;s own Stripe account. Keys are stored encrypted and never shown
          again. After saving, add this webhook endpoint in your Stripe Dashboard and paste back
          its signing secret, and activate the Customer Portal there.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select className={input} value={s.mode} onChange={e => setS({ ...s, mode: e.target.value as 'test' | 'live' })}>
            <option value="test">Test mode</option>
            <option value="live">Live mode</option>
          </select>
          <input className={input} type="number" min={0} max={90} value={s.grace_days}
            onChange={e => setS({ ...s, grace_days: Number(e.target.value) })}
            placeholder="Grace days before 'late'" />
          <input className={input} value={s.publishable_key}
            onChange={e => setS({ ...s, publishable_key: e.target.value })}
            placeholder="Publishable key (pk_…)" />
          <input className={input} type="password" value={secretKey}
            onChange={e => setSecretKey(e.target.value)}
            placeholder={s.hasSecretKey ? 'Secret key — set (blank = keep)' : 'Secret key (sk_…)'} />
          <input className={input} type="password" value={webhookSecret}
            onChange={e => setWebhookSecret(e.target.value)}
            placeholder={s.hasWebhookSecret ? 'Webhook secret — set (blank = keep)' : 'Webhook signing secret (whsec_…)'} />
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Tier → Stripe Price</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {TIERS.map(t => (
              <input key={t} className={input} value={s.prices[t] ?? ''}
                onChange={e => setS({ ...s, prices: { ...s.prices, [t]: e.target.value } })}
                placeholder={`${t} price_…`} />
            ))}
          </div>
        </div>

        <div className="rounded border border-border bg-background p-3">
          <p className="font-mono text-[10px] text-muted-foreground">Webhook endpoint (add in Stripe → Developers → Webhooks):</p>
          <code className="font-mono text-[11px] text-foreground break-all">{webhookUrl}</code>
          <p className="font-mono text-[10px] text-muted-foreground mt-1">
            Subscribe to: checkout.session.completed, customer.subscription.*, invoice.paid, invoice.payment_failed.
          </p>
        </div>

        <Button size="sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save Stripe settings'}</Button>
      </div>
    </div>
  )
}
