'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { checkIn, checkOut } from '@/lib/actions'

type Present = {
  id: string
  name: string
  isHost: boolean
  isMe: boolean
  checkedInAt: string
  note: string | null
}

export function PresencePanel({ present }: { present: Present[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)

  const me = present.find(p => p.isMe)
  const amHere = !!me
  const hostCount = present.filter(p => p.isHost).length

  async function doCheckIn(asHost: boolean) {
    setBusy(true)
    const res = await checkIn({ asHost, note: note.trim() || null })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    setNote('')
    setShowNote(false)
    toast.success(asHost ? 'Checked in as host' : 'Checked in')
    router.refresh()
  }

  async function doCheckOut() {
    setBusy(true)
    const res = await checkOut({ note: note.trim() || null })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    setNote('')
    setShowNote(false)
    toast.success('Checked out')
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Who&apos;s here ({present.length}{hostCount > 0 ? ` · ${hostCount} hosting` : ''})
        </p>
      </div>

      <div className="bg-card rounded border border-border">
        {present.length === 0 ? (
          <p className="px-4 py-4 font-sans text-xs text-muted-foreground text-center">
            Nobody is checked in right now.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {present.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-sans text-sm text-foreground truncate">
                  {p.name}{p.isMe ? ' (you)' : ''}
                  {p.note && <span className="font-mono text-[10px] text-muted-foreground ml-2">{p.note}</span>}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {p.isHost && <Badge variant="default">Host</Badge>}
                  <span className="font-mono text-[10px] text-muted-foreground/70">
                    {new Date(p.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border p-3 space-y-2">
          {showNote && (
            <input
              className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
              placeholder={amHere ? 'Check-out note (optional)' : 'Check-in note (optional)'}
              maxLength={500}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {amHere ? (
              <Button size="sm" disabled={busy} onClick={doCheckOut}>
                Check out{me?.isHost ? ' (hosting)' : ''}
              </Button>
            ) : (
              <>
                <Button size="sm" disabled={busy} onClick={() => doCheckIn(false)}>Check in</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => doCheckIn(true)}>Check in as host</Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowNote(v => !v)}>
              {showNote ? 'Hide note' : 'Add note'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
