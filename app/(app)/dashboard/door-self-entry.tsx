'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { selfEntry } from '@/lib/actions'

type Door = { id: string; name: string }

export function DoorSelfEntry({ doors }: { doors: Door[] }) {
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)

  async function open(d: Door) {
    const ok = await confirm({
      title: `Open ${d.name}?`,
      description:
        'This sends a live command that physically opens the door. Only do this if you are at the door and authorized to enter.',
      confirmText: 'Open the door',
    })
    if (!ok) return
    setBusy(d.id)
    const res = await selfEntry({ connectionId: d.id })
    setBusy(null)
    if ('error' in res && res.error) return toast.error(res.error)
    toast.success(`${d.name} opened`)
  }

  return (
    <div className="bg-card rounded border border-border divide-y divide-border">
      {doors.map(d => (
        <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex-1 min-w-0 font-sans text-sm text-foreground truncate">{d.name}</span>
          <Button size="sm" className="shrink-0" disabled={busy === d.id} onClick={() => open(d)}>
            {busy === d.id ? 'Opening…' : 'Open'}
          </Button>
        </div>
      ))}
    </div>
  )
}
