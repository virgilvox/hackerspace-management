'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { setRolePermissions } from '@/lib/actions'
import { PERMISSIONS, PERMISSION_GROUPS } from '@/lib/permissions-catalog'
import { BUILTIN_ROLES } from '@/lib/role-labels'
import { Card } from './card'
import type { CustomRole } from './types'

interface Props {
  isAdmin: boolean
  customRoles: CustomRole[]
  rolePerms: Array<{ subject: string; permission: string }>
}

export function PermissionsPanel({ isAdmin, customRoles, rolePerms }: Props) {
  // subjects: built-in roles except admin (implicit-all), plus custom roles.
  const subjects = [
    ...BUILTIN_ROLES.filter(r => r !== 'admin').map(r => ({ key: r, label: r })),
    ...customRoles.map(c => ({ key: c.slug, label: c.name })),
  ]

  const initial: Record<string, Set<string>> = {}
  for (const s of subjects) initial[s.key] = new Set()
  for (const rp of rolePerms) {
    if (!initial[rp.subject]) initial[rp.subject] = new Set()
    initial[rp.subject].add(rp.permission)
  }
  const [grants, setGrants] = useState(initial)
  const [savingSubject, setSavingSubject] = useState<string | null>(null)

  async function toggle(subject: string, permission: string, on: boolean) {
    const next = new Set(grants[subject] ?? [])
    if (on) next.add(permission)
    else next.delete(permission)
    setGrants(g => ({ ...g, [subject]: next }))
    setSavingSubject(subject)
    const result = await setRolePermissions({ subject, permissions: Array.from(next) })
    setSavingSubject(null)
    if (result.error) {
      toast.error(result.error)
      // revert
      setGrants(g => {
        const back = new Set(g[subject] ?? [])
        if (on) back.delete(permission)
        else back.add(permission)
        return { ...g, [subject]: back }
      })
    }
  }

  return (
    <Card
      title="Permissions"
      blurb="Grant capabilities to each role. Admin always holds every permission and cannot be locked out. Permissions widen what a role can do through the surfaces that consult them; they never override the database tenant isolation."
    >
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">admin</span>
        <span className="font-sans text-xs text-muted-foreground">holds all permissions (implicit, locked)</span>
      </div>

      {!isAdmin && (
        <div className="mb-4 rounded border border-border bg-muted/40 px-3 py-2" role="status">
          <p className="font-sans text-xs text-muted-foreground">
            View only. Only an admin can change permissions.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left font-mono text-[10px] tracking-widest text-muted-foreground uppercase py-2 pr-4 sticky left-0 bg-card">Permission</th>
              {subjects.map(s => (
                <th key={s.key} className="px-2 py-2 font-mono text-[10px] text-muted-foreground text-center min-w-[88px]">
                  {s.label}{savingSubject === s.key && <span className="text-primary"> …</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map(group => (
              <PermGroup
                key={group}
                group={group}
                subjects={subjects}
                grants={grants}
                isAdmin={isAdmin}
                onToggle={toggle}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function PermGroup({
  group, subjects, grants, isAdmin, onToggle,
}: {
  group: string
  subjects: { key: string; label: string }[]
  grants: Record<string, Set<string>>
  isAdmin: boolean
  onToggle: (subject: string, permission: string, on: boolean) => void
}) {
  const perms = PERMISSIONS.filter(p => p.group === group)
  return (
    <>
      <tr>
        <td colSpan={subjects.length + 1} className="pt-4 pb-1">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{group}</span>
        </td>
      </tr>
      {perms.map(p => (
        <tr key={p.code} className="border-t border-border">
          <td className="py-2 pr-4 sticky left-0 bg-card">
            <span className="font-sans text-sm text-foreground">{p.label}</span>
            <span className="font-mono text-[10px] text-muted-foreground/60 ml-2">{p.code}</span>
          </td>
          {subjects.map(s => (
            <td key={s.key} className="px-2 py-2 text-center">
              <input
                type="checkbox"
                disabled={!isAdmin}
                aria-label={`${p.label} for ${s.label}`}
                checked={grants[s.key]?.has(p.code) ?? false}
                onChange={e => onToggle(s.key, p.code, e.target.checked)}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
