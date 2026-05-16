'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { setOpsAcl } from '@/lib/actions'

export interface AclRoleOption { value: string; label: string }

interface Props {
  entityType: 'secret' | 'kb' | 'process'
  entityId: string
  options: AclRoleOption[]
  initial: string[]
}

// Toggling roles here writes ops_acl. An empty selection means the item
// falls back to its default visibility (admin/board for secrets; the
// visibility column for KB). Selecting roles WIDENS read access to those
// roles in addition to the default.
export function OpsAclEditor({ entityType, entityId, options, initial }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial))
  const [saving, setSaving] = useState(false)

  async function toggle(value: string, on: boolean) {
    const next = new Set(selected)
    if (on) next.add(value)
    else next.delete(value)
    setSelected(next)
    setSaving(true)
    const result = await setOpsAcl({ entity_type: entityType, entity_id: entityId, roles: Array.from(next) })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      setSelected(prev => {
        const back = new Set(prev)
        if (on) back.delete(value)
        else back.add(value)
        return back
      })
    }
  }

  return (
    <div className="border border-border rounded p-3 bg-background/60 mt-2">
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
        Who can access {saving && <span className="text-primary">…</span>}
      </p>
      {options.length === 0 ? (
        <p className="font-sans text-xs text-muted-foreground">No roles available.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map(o => {
            const on = selected.has(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value, !on)}
                className={`font-mono text-[10px] px-2 py-1 rounded border transition ${
                  on ? 'bg-primary/10 text-primary border-primary/30' : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
      <p className="font-sans text-[11px] text-muted-foreground mt-2">
        Admins and board always have access. Empty selection keeps the default visibility.
      </p>
    </div>
  )
}
