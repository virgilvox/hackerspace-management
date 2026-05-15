'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createTier, updateTier, deleteTier } from '@/lib/actions'
import { Card } from './card'
import type { Tier } from './types'

export function TiersPanel({ isAdmin, tiers: initial }: { isAdmin: boolean; tiers: Tier[] }) {
  const [tiers, setTiers] = useState<Tier[]>(initial)
  const [showNew, setShowNew] = useState(false)
  const [d, setD] = useState({ slug: '', name: '', dollars: '0', cadence: 'monthly' as Tier['billing_cadence'], description: '' })

  return (
    <Card
      title="Membership tiers"
      blurb="Built-in plus/basic/associate seed every space. Add your own, set prices and cadence. Built-in tiers can be archived but not deleted."
      action={isAdmin ? <button onClick={() => setShowNew(v => !v)} className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition whitespace-nowrap">{showNew ? 'Cancel' : '+ New tier'}</button> : undefined}
    >
      {showNew && (
        <form
          onSubmit={async e => {
            e.preventDefault()
            const cents = Math.round(parseFloat(d.dollars || '0') * 100)
            const result = await createTier({ slug: d.slug.trim().toLowerCase(), name: d.name.trim(), description: d.description.trim() || undefined, monthly_price_cents: isNaN(cents) ? 0 : cents, billing_cadence: d.cadence })
            if ('error' in result && result.error) { toast.error(result.error); return }
            toast.success('Tier created')
            setTiers(prev => [...prev, { id: (result as { id: string }).id, slug: d.slug.trim().toLowerCase(), name: d.name.trim(), description: d.description.trim() || null, monthly_price_cents: isNaN(cents) ? 0 : cents, billing_cadence: d.cadence, is_system: false, is_archived: false, sort_order: 100 }])
            setShowNew(false); setD({ slug: '', name: '', dollars: '0', cadence: 'monthly', description: '' })
          }}
          className="mb-4 p-4 border border-border rounded bg-background grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <input type="text" required maxLength={50} value={d.slug} onChange={e => setD({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') })} placeholder="slug" className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="text" required maxLength={100} value={d.name} onChange={e => setD({ ...d, name: e.target.value })} placeholder="Display name" className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="number" step="0.01" min="0" value={d.dollars} onChange={e => setD({ ...d, dollars: e.target.value })} placeholder="Price (USD)" className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <select value={d.cadence} onChange={e => setD({ ...d, cadence: e.target.value as Tier['billing_cadence'] })} className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary">
            <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="one_time">One time</option><option value="custom">Custom</option>
          </select>
          <input type="text" maxLength={2000} value={d.description} onChange={e => setD({ ...d, description: e.target.value })} placeholder="Description (optional)" className="md:col-span-2 bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <button type="submit" className="md:col-span-2 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition">Create tier</button>
        </form>
      )}
      <ul className="divide-y divide-border">
        {tiers.length === 0 && <li className="py-6 text-center font-sans text-sm text-muted-foreground">No tiers yet.</li>}
        {tiers.map(t => (
          <li key={t.id} className="py-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-sans text-sm font-medium text-foreground">{t.name}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t.slug}</span>
                {t.is_system && <span className="font-mono text-[10px] text-amber-600">built-in</span>}
                {t.is_archived && <span className="font-mono text-[10px] text-muted-foreground">archived</span>}
              </div>
              {t.description && <p className="font-sans text-xs text-muted-foreground mt-0.5">{t.description}</p>}
              <p className="font-mono text-[10px] text-muted-foreground/70 mt-0.5">${(t.monthly_price_cents / 100).toFixed(2)} / {t.billing_cadence.replace('_', ' ')}</p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number" step="0.01" min="0"
                  defaultValue={(t.monthly_price_cents / 100).toFixed(2)}
                  onBlur={async e => { const cents = Math.round(parseFloat(e.target.value || '0') * 100); if (cents === t.monthly_price_cents) return; const res = await updateTier(t.id, { monthly_price_cents: cents }); if (res.error) { toast.error(res.error); return } setTiers(prev => prev.map(x => x.id === t.id ? { ...x, monthly_price_cents: cents } : x)); toast.success('Price updated') }}
                  className="w-24 bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1 focus:outline-none focus:border-primary"
                />
                {t.is_system ? (
                  <button onClick={async () => { const res = await updateTier(t.id, { is_archived: !t.is_archived }); if (res.error) { toast.error(res.error); return } setTiers(prev => prev.map(x => x.id === t.id ? { ...x, is_archived: !x.is_archived } : x)) }} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary hover:text-primary transition">{t.is_archived ? 'Restore' : 'Archive'}</button>
                ) : (
                  <button onClick={async () => { if (!confirm(`Delete tier "${t.name}"?`)) return; const res = await deleteTier(t.id); if (res.error) { toast.error(res.error); return } setTiers(prev => prev.filter(x => x.id !== t.id)); toast.success('Tier deleted') }} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-red-500 hover:text-red-500 transition">Delete</button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
