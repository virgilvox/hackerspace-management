'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { upsertRoleLabel, createCustomRole, updateCustomRole, deleteCustomRole } from '@/lib/actions'
import { BUILTIN_ROLES, DEFAULT_ROLE_LABELS } from '@/lib/role-labels'
import { Card } from './card'
import type { RoleLabelRow, CustomRole } from './types'

export function RolesPanel({ isAdmin, roleLabels, customRoles: initial }: { isAdmin: boolean; roleLabels: RoleLabelRow[]; customRoles: CustomRole[] }) {
  const router = useRouter()
  const [customRoles, setCustomRoles] = useState<CustomRole[]>(initial)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState({ slug: '', name: '', color: '#d4ff00', description: '' })

  function labelFor(role: string) {
    const row = roleLabels.find(r => r.role === role)
    const def = DEFAULT_ROLE_LABELS[role as keyof typeof DEFAULT_ROLE_LABELS]
    return {
      name: row?.display_name ?? def?.name ?? role,
      description: row?.description ?? '',
      color: row?.color ?? def?.color ?? '#e5e7eb',
    }
  }

  async function saveLabel(role: string, patch: { display_name?: string; description?: string; color?: string }) {
    const cur = labelFor(role)
    const result = await upsertRoleLabel({
      role: role as 'admin' | 'board' | 'treasurer' | 'member' | 'associate',
      display_name: patch.display_name ?? cur.name,
      description: patch.description ?? cur.description,
      color: patch.color ?? cur.color,
    })
    if (result.error) { toast.error(result.error); return }
    toast.success('Role updated')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card title="Built-in roles" blurb="The five permission roles are fixed, but you can rename and recolor them to match your space's vocabulary. The new label shows everywhere a role is displayed.">
        <ul className="divide-y divide-border">
          {BUILTIN_ROLES.map(role => {
            const l = labelFor(role)
            return (
              <li key={role} className="py-3 flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground w-20 text-center">{role}</span>
                <input
                  type="text"
                  defaultValue={l.name}
                  disabled={!isAdmin}
                  onBlur={e => { const v = e.target.value.trim(); if (v && v !== l.name) saveLabel(role, { display_name: v }) }}
                  className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1 focus:outline-none focus:border-primary"
                />
                <input
                  type="color"
                  defaultValue={l.color}
                  disabled={!isAdmin}
                  onBlur={e => { if (e.target.value !== l.color) saveLabel(role, { color: e.target.value }) }}
                  className="w-9 h-8 bg-background border border-border rounded cursor-pointer"
                  title="Badge color"
                />
                <input
                  type="text"
                  defaultValue={l.description}
                  disabled={!isAdmin}
                  placeholder="Short description (optional)"
                  onBlur={e => { if (e.target.value !== l.description) saveLabel(role, { description: e.target.value }) }}
                  className="flex-1 min-w-[160px] bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1 focus:outline-none focus:border-primary"
                />
              </li>
            )
          })}
        </ul>
      </Card>

      <Card
        title="Custom roles"
        blurb="Extra labels for org structure (committees, area leads, mentors). Display-only; they do not change permissions."
        action={isAdmin ? (
          <button onClick={() => setShowNew(v => !v)} className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition whitespace-nowrap">
            {showNew ? 'Cancel' : '+ Custom role'}
          </button>
        ) : undefined}
      >
        {showNew && (
          <form
            onSubmit={async e => {
              e.preventDefault()
              const result = await createCustomRole({
                slug: draft.slug.trim().toLowerCase(),
                name: draft.name.trim(),
                color: draft.color,
                description: draft.description.trim() || undefined,
              })
              if ('error' in result && result.error) { toast.error(result.error); return }
              toast.success('Custom role created')
              setCustomRoles(prev => [...prev, { id: (result as { id: string }).id, slug: draft.slug.trim().toLowerCase(), name: draft.name.trim(), color: draft.color, description: draft.description.trim() || null, sort_order: 100 }])
              setShowNew(false)
              setDraft({ slug: '', name: '', color: '#d4ff00', description: '' })
            }}
            className="mb-4 p-4 border border-border rounded bg-background grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <input type="text" required maxLength={50} value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') })} placeholder="slug" className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
            <input type="text" required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Display name" className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
            <input type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} className="w-9 h-8 bg-background border border-border rounded cursor-pointer" />
            <input type="text" maxLength={500} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Description (optional)" className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
            <button type="submit" className="md:col-span-2 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition">Create</button>
          </form>
        )}
        {customRoles.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground py-2">No custom roles yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {customRoles.map(r => (
              <li key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color ?? '#888' }} />
                <input
                  type="text"
                  defaultValue={r.name}
                  disabled={!isAdmin}
                  onBlur={async e => { const v = e.target.value.trim(); if (!v || v === r.name) return; const res = await updateCustomRole(r.id, { name: v }); if (res.error) { toast.error(res.error); return } setCustomRoles(prev => prev.map(x => x.id === r.id ? { ...x, name: v } : x)); toast.success('Saved') }}
                  className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1 focus:outline-none focus:border-primary"
                />
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.slug}</span>
                <input
                  type="text"
                  defaultValue={r.description ?? ''}
                  disabled={!isAdmin}
                  placeholder="Description"
                  onBlur={async e => { const v = e.target.value; if (v === (r.description ?? '')) return; const res = await updateCustomRole(r.id, { description: v }); if (res.error) { toast.error(res.error); return } setCustomRoles(prev => prev.map(x => x.id === r.id ? { ...x, description: v } : x)) }}
                  className="flex-1 min-w-[140px] bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1 focus:outline-none focus:border-primary"
                />
                {isAdmin && (
                  <button
                    onClick={async () => { if (!confirm(`Delete role "${r.name}"?`)) return; const res = await deleteCustomRole(r.id); if (res.error) { toast.error(res.error); return } setCustomRoles(prev => prev.filter(x => x.id !== r.id)); toast.success('Deleted') }}
                    className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-red-500 hover:text-red-500 transition"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
