'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import {
  CATEGORY_META,
  type PrefMap,
  type NotificationCategory,
} from '@/lib/notifications-prefs-logic'
import { setMyNotificationPreference } from '@/lib/actions'

// Per-category email opt-out toggles. Optimistic: the switch flips immediately
// and reverts if the server action fails. Billing is never shown (always on).
export function NotificationPrefs({ initial }: { initial: PrefMap }) {
  const [prefs, setPrefs] = useState<PrefMap>(initial)
  const [pending, startTransition] = useTransition()

  function toggle(category: NotificationCategory, next: boolean) {
    const prev = prefs[category] ?? true
    setPrefs(p => ({ ...p, [category]: next }))
    startTransition(async () => {
      const res = await setMyNotificationPreference({ category, enabled: next })
      if ('error' in res) {
        setPrefs(p => ({ ...p, [category]: prev }))
        toast.error(res.error)
      }
    })
  }

  return (
    <ul className="divide-y rounded border border-border">
      {CATEGORY_META.map(meta => {
        const enabled = prefs[meta.category] ?? true
        return (
          <li key={meta.category} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="font-sans text-sm text-foreground">{meta.label}</span>
              <p className="font-sans text-xs text-muted-foreground mt-0.5">{meta.description}</p>
            </div>
            <Switch
              checked={enabled}
              disabled={pending}
              onCheckedChange={next => toggle(meta.category, next)}
              aria-label={`Email me about ${meta.label}`}
            />
          </li>
        )
      })}
    </ul>
  )
}
