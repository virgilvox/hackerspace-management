'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Hammer } from 'lucide-react'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { reserveEquipment } from '@/lib/actions'
import { EQUIPMENT_STATUS_LABEL } from '@/lib/equipment-logic'
import { useRouter } from 'next/navigation'

type Item = {
  id: string
  name: string
  description: string | null
  location: string | null
  status: string
  required_certification_id: string | null
  certifications: { name: string } | { name: string }[] | null
  member_certified: boolean
}

function certName(i: Item): string | null {
  const c = Array.isArray(i.certifications) ? i.certifications[0] : i.certifications
  return c?.name ?? null
}

export function EquipmentBrowseClient({ equipment }: { equipment: unknown[] }) {
  const router = useRouter()
  const items = equipment as Item[]
  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState({ starts_at: '', ends_at: '', notes: '' })
  const [busy, setBusy] = useState(false)

  async function onReserve(e: React.FormEvent, item: Item) {
    e.preventDefault()
    if (!form.starts_at || !form.ends_at) return toast.error('Pick a start and end time')
    setBusy(true)
    const res = await reserveEquipment({
      equipmentId: item.id,
      starts_at: form.starts_at,
      ends_at: form.ends_at,
      notes: form.notes.trim() || null,
    })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    toast.success('Reserved')
    setOpenId(null)
    setForm({ starts_at: '', ends_at: '', notes: '' })
    router.refresh()
  }

  return (
    <>
      <PageHeader>
        <PageTitle>Equipment</PageTitle>
      </PageHeader>

      <div className="p-4 md:p-6">
        {items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Hammer /></EmptyMedia>
              <EmptyTitle>No equipment listed</EmptyTitle>
              <EmptyDescription>Nothing is available to reserve yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-3">
            {items.map(it => {
              const needsCert = !!it.required_certification_id
              const blockedByCert = needsCert && !it.member_certified
              const unavailable = it.status !== 'available'
              return (
                <li key={it.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans text-sm font-semibold text-foreground">{it.name}</span>
                        <span className={`font-mono text-[10px] ${it.status === 'available' ? 'text-primary' : 'text-amber-600'}`}>
                          {EQUIPMENT_STATUS_LABEL[it.status] ?? it.status}
                        </span>
                        {needsCert && (
                          <Badge variant={it.member_certified ? 'default' : 'outline'}>
                            {it.member_certified ? `Certified: ${certName(it)}` : `Requires ${certName(it)}`}
                          </Badge>
                        )}
                      </div>
                      {it.description && <p className="font-sans text-sm text-muted-foreground mt-1">{it.description}</p>}
                      {it.location && <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{it.location}</p>}
                    </div>
                    <button
                      onClick={() => { setOpenId(openId === it.id ? null : it.id); setForm({ starts_at: '', ends_at: '', notes: '' }) }}
                      disabled={unavailable || blockedByCert}
                      className="font-mono text-[10px] border border-border px-3 py-2 rounded hover:border-primary hover:text-primary transition disabled:opacity-50"
                      title={unavailable ? 'Not available' : blockedByCert ? 'You are not certified for this' : ''}
                    >
                      {openId === it.id ? 'Close' : 'Reserve'}
                    </button>
                  </div>

                  {openId === it.id && !unavailable && !blockedByCert && (
                    <form onSubmit={e => onReserve(e, it)} className="mt-3 rounded border border-border bg-background p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="font-mono text-[10px] text-muted-foreground">Starts
                        <input type="datetime-local" required value={form.starts_at}
                          onChange={e => setForm({ ...form, starts_at: e.target.value })}
                          className="w-full bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-2 focus:outline-none focus:border-primary" />
                      </label>
                      <label className="font-mono text-[10px] text-muted-foreground">Ends
                        <input type="datetime-local" required value={form.ends_at}
                          onChange={e => setForm({ ...form, ends_at: e.target.value })}
                          className="w-full bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-2 focus:outline-none focus:border-primary" />
                      </label>
                      <input type="text" maxLength={2000} placeholder="Notes (optional)" value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        className="sm:col-span-2 bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-2 focus:outline-none focus:border-primary" />
                      <div className="sm:col-span-2">
                        <button type="submit" disabled={busy}
                          className="bg-primary text-white text-xs font-sans px-3 py-2 rounded hover:bg-primary/90 transition disabled:opacity-60">
                          Confirm reservation
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
