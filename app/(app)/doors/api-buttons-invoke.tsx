'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { invokeApiButton } from '@/lib/actions'

type InvokeButton = { id: string; label: string; group: string; confirm: boolean }

export function ApiButtonsInvoke({ buttons }: { buttons: InvokeButton[] }) {
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)

  const groups = new Map<string, InvokeButton[]>()
  for (const b of buttons) {
    if (!groups.has(b.group)) groups.set(b.group, [])
    groups.get(b.group)!.push(b)
  }

  async function press(b: InvokeButton) {
    if (b.confirm) {
      const ok = await confirm({
        title: `${b.label}?`,
        description: 'This fires a configured action. Continue?',
        confirmText: b.label,
      })
      if (!ok) return
    }
    setBusy(b.id)
    const res = await invokeApiButton({ buttonId: b.id })
    setBusy(null)
    if ('error' in res && res.error) return toast.error(res.error)
    toast.success(`${b.label} sent`)
  }

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([group, items]) => (
        <div key={group}>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-2">{group}</p>
          <div className="flex flex-wrap gap-2">
            {items.map(b => (
              <Button key={b.id} size="sm" disabled={busy === b.id} onClick={() => press(b)}>
                {b.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
