'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { listSessionSignups, markAttendance, completeSession } from '@/lib/actions'
import { SIGNUP_STATUS_LABEL } from '@/lib/classes-logic'

type Signup = {
  id: string
  member_id: string
  status: string
  attended: boolean
  signed_up_at: string
  space_members: { display_name: string | null; email: string | null } | null
}

export function SessionAttendance({
  sessionId,
  sessionStatus,
  onCompleted,
}: {
  sessionId: string
  sessionStatus: string
  onCompleted: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Signup[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listSessionSignups({ sessionId })
    setLoading(false)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    setRows(('data' in res ? res.data : []) ?? [])
  }, [sessionId])

  useEffect(() => {
    load()
  }, [load])

  async function toggle(s: Signup) {
    const res = await markAttendance({ signupId: s.id, attended: !s.attended })
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    setRows(prev => prev.map(r => (r.id === s.id ? { ...r, attended: !r.attended } : r)))
  }

  async function onComplete() {
    setBusy(true)
    const res = await completeSession({ sessionId })
    setBusy(false)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    const d = (res as { data: { certificatesIssued: number; certificatesSkipped: boolean } }).data
    if (d.certificatesSkipped) {
      toast.success('Session completed. Certificates were NOT issued (requires the certifications.grant permission).')
    } else if (d.certificatesIssued > 0) {
      toast.success(`Session completed. ${d.certificatesIssued} certificate(s) issued.`)
    } else {
      toast.success('Session completed.')
    }
    onCompleted()
  }

  return (
    <div className="mt-3 rounded border border-border bg-background p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Attendees</p>
        {sessionStatus === 'scheduled' && (
          <button
            onClick={onComplete}
            disabled={busy}
            className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary hover:text-primary transition disabled:opacity-60"
          >
            Complete session
          </button>
        )}
      </div>
      {loading ? (
        <p className="font-mono text-[10px] text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">No signups yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(s => (
            <li key={s.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="font-sans text-sm text-foreground">
                  {s.space_members?.display_name ?? s.space_members?.email ?? 'Member'}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground ml-2">
                  {SIGNUP_STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
              <label className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={s.attended} onChange={() => toggle(s)} />
                attended
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
