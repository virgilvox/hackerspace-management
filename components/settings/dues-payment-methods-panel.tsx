'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  DUES_LINK_PLATFORMS,
  DUES_PLATFORM_LABEL,
  type DuesLinkPlatform,
} from '@/lib/dues-payments-logic'
import {
  listDuesPaymentMethods,
  upsertDuesPaymentMethod,
  deleteDuesPaymentMethod,
} from '@/lib/actions'

const input =
  'w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary'

type Row = { url: string; instructions: string; isActive: boolean; exists: boolean }
type RowMap = Record<DuesLinkPlatform, Row>

const emptyRows = (): RowMap =>
  Object.fromEntries(
    DUES_LINK_PLATFORMS.map(p => [p, { url: '', instructions: '', isActive: true, exists: false }]),
  ) as RowMap

export function DuesPaymentMethodsPanel() {
  const [rows, setRows] = useState<RowMap | null>(null)
  const [busy, setBusy] = useState<DuesLinkPlatform | null>(null)

  async function load() {
    const next = emptyRows()
    const r = await listDuesPaymentMethods()
    if ('data' in r) {
      for (const m of r.data) {
        const p = m.platform as DuesLinkPlatform
        if (next[p]) next[p] = { url: m.url, instructions: m.instructions ?? '', isActive: m.isActive, exists: true }
      }
    }
    setRows(next)
  }
  useEffect(() => {
    load()
  }, [])

  if (!rows) return null

  function set(p: DuesLinkPlatform, patch: Partial<Row>) {
    setRows(prev => (prev ? { ...prev, [p]: { ...prev[p], ...patch } } : prev))
  }

  async function save(p: DuesLinkPlatform) {
    const row = rows![p]
    if (!row.url.trim()) return toast.error('Enter a payment URL first.')
    setBusy(p)
    const res = await upsertDuesPaymentMethod({
      platform: p,
      url: row.url.trim(),
      instructions: row.instructions.trim() || null,
      is_active: row.isActive,
      sort_order: DUES_LINK_PLATFORMS.indexOf(p),
    })
    setBusy(null)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${DUES_PLATFORM_LABEL[p]} saved`)
    load()
  }

  async function remove(p: DuesLinkPlatform) {
    setBusy(p)
    const res = await deleteDuesPaymentMethod({ platform: p })
    setBusy(null)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${DUES_PLATFORM_LABEL[p]} removed`)
    load()
  }

  return (
    <div className="p-4 md:p-6 border-t border-border">
      <div className="max-w-2xl space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Other ways to pay dues
        </h2>
        <p className="font-sans text-xs text-muted-foreground">
          Add an external payment link per platform (PayPal, Zeffy, Venmo). Members see active links
          on their membership page and pay you directly there. Payments are not recorded
          automatically: reconcile them later in Payments.
        </p>

        <div className="space-y-4">
          {DUES_LINK_PLATFORMS.map(p => {
            const row = rows[p]
            return (
              <div key={p} className="rounded border border-border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-sm font-medium text-foreground">
                    {DUES_PLATFORM_LABEL[p]}
                  </span>
                  <label className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {row.isActive ? 'shown' : 'hidden'}
                    </span>
                    <Switch
                      checked={row.isActive}
                      onCheckedChange={next => set(p, { isActive: next })}
                      aria-label={`Show ${DUES_PLATFORM_LABEL[p]} to members`}
                    />
                  </label>
                </div>
                <input
                  className={input}
                  value={row.url}
                  onChange={e => set(p, { url: e.target.value })}
                  placeholder="https://… payment link"
                  inputMode="url"
                  maxLength={500}
                />
                <input
                  className={input}
                  value={row.instructions}
                  onChange={e => set(p, { instructions: e.target.value })}
                  placeholder="Instructions, e.g. put your member name in the note (optional)"
                  maxLength={300}
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === p} onClick={() => save(p)}>
                    {busy === p ? 'Saving…' : 'Save'}
                  </Button>
                  {row.exists && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === p}
                      onClick={() => remove(p)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
