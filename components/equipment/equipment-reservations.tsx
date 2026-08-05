'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { listEquipmentReservations, cancelReservation } from '@/lib/actions'

type Reservation = {
  id: string
  member_id: string
  starts_at: string
  ends_at: string
  status: string
  notes: string | null
  space_members: { display_name: string | null; email: string | null } | null
}

function who(r: Reservation) {
  return r.space_members?.display_name ?? r.space_members?.email ?? 'Member'
}

// Manager view of who reserved a piece of equipment, with a manager cancel.
// listEquipmentReservations is equipment.manage-gated server-side.
export function EquipmentReservations({ equipmentId }: { equipmentId: string }) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Reservation[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listEquipmentReservations({ equipmentId })
    setLoading(false)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    setRows(('data' in res ? res.data : []) ?? [])
  }, [equipmentId])

  useEffect(() => {
    load()
  }, [load])

  async function onCancel(r: Reservation) {
    setBusy(r.id)
    const res = await cancelReservation({ reservationId: r.id })
    setBusy(null)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    setRows(prev => prev.map(x => (x.id === r.id ? { ...x, status: 'cancelled' } : x)))
    toast.success('Reservation cancelled')
  }

  return (
    <div className="mt-3 rounded border border-border bg-background p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Reservations</p>
      {loading ? (
        <p className="font-mono text-[10px] text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">No reservations.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(r => (
            <li key={r.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <span className="font-sans text-sm text-foreground">{who(r)}</span>
                <span className="font-mono text-[10px] text-muted-foreground ml-2">
                  {new Date(r.starts_at).toLocaleString()} – {new Date(r.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  <span className={r.status === 'cancelled' ? 'text-red-500' : 'text-primary'}>{r.status}</span>
                </span>
                {r.notes && <p className="font-sans text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
              </div>
              {r.status !== 'cancelled' && (
                <button
                  onClick={() => onCancel(r)}
                  disabled={busy === r.id}
                  className="font-mono text-[10px] border border-border px-3 py-2 rounded hover:border-red-500 hover:text-red-500 transition disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
