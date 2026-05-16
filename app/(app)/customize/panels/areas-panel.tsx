'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { LayoutGrid } from 'lucide-react'
import { createArea, updateArea, deleteArea } from '@/lib/actions'
import { Card } from './card'
import { useConfirm } from '@/components/ui/confirm'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import type { Area } from './types'

export function AreasPanel({ isAdmin, areas: initial }: { isAdmin: boolean; areas: Area[] }) {
  const confirm = useConfirm()
  const [areas, setAreas] = useState<Area[]>(initial)
  const [showNew, setShowNew] = useState(false)
  const [d, setD] = useState({ code: '', name: '', icon: '' })

  return (
    <Card
      title="Areas"
      blurb="Shop areas tag tasks, projects, and knowledge base entries. Archive to hide from pickers without losing history."
      action={isAdmin ? <button onClick={() => setShowNew(v => !v)} className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition whitespace-nowrap">{showNew ? 'Cancel' : '+ New area'}</button> : undefined}
    >
      {showNew && (
        <form
          onSubmit={async e => {
            e.preventDefault()
            const result = await createArea({ code: d.code.trim().toLowerCase(), name: d.name.trim(), icon: d.icon.trim() || undefined })
            if ('error' in result && result.error) { toast.error(result.error); return }
            toast.success('Area created')
            const created = result as { data?: { id: string } }
            setAreas(prev => [...prev, { id: created.data?.id ?? crypto.randomUUID(), code: d.code.trim().toLowerCase(), name: d.name.trim(), icon: d.icon.trim() || null, sort_order: 100, is_archived: false }])
            setShowNew(false); setD({ code: '', name: '', icon: '' })
          }}
          className="mb-4 p-4 border border-border rounded bg-background grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <input type="text" required value={d.code} onChange={e => setD({ ...d, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="code" className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="text" required value={d.name} onChange={e => setD({ ...d, name: e.target.value })} placeholder="Display name" className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="text" value={d.icon} onChange={e => setD({ ...d, icon: e.target.value })} placeholder="Icon (emoji, optional)" className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <button type="submit" className="md:col-span-3 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition">Create area</button>
        </form>
      )}
      {areas.length === 0 && (
        <Empty className="border-0 p-0 md:p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon"><LayoutGrid /></EmptyMedia>
            <EmptyTitle>No areas yet</EmptyTitle>
            <EmptyDescription>Areas tag tasks, projects, and knowledge base entries by shop space.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <ul className="divide-y divide-border">
        {[...areas].sort((a, b) => a.sort_order - b.sort_order).map(a => (
          <li key={a.id} className={`py-3 flex items-center gap-3 flex-wrap ${a.is_archived ? 'opacity-50' : ''}`}>
            <input type="number" defaultValue={a.sort_order} disabled={!isAdmin} onBlur={async e => { const n = parseInt(e.target.value, 10); if (isNaN(n) || n === a.sort_order) return; const res = await updateArea({ areaId: a.id, sort_order: n }); if (res.error) { toast.error(res.error); return } setAreas(prev => prev.map(x => x.id === a.id ? { ...x, sort_order: n } : x)) }} className="w-14 bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1 focus:outline-none focus:border-primary" />
            {a.icon && <span>{a.icon}</span>}
            <input type="text" defaultValue={a.name} disabled={!isAdmin} onBlur={async e => { const v = e.target.value.trim(); if (!v || v === a.name) return; const res = await updateArea({ areaId: a.id, name: v }); if (res.error) { toast.error(res.error); return } setAreas(prev => prev.map(x => x.id === a.id ? { ...x, name: v } : x)); toast.success('Saved') }} className="flex-1 min-w-[140px] bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1 focus:outline-none focus:border-primary" />
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{a.code}</span>
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <button onClick={async () => { const res = await updateArea({ areaId: a.id, is_archived: !a.is_archived }); if (res.error) { toast.error(res.error); return } setAreas(prev => prev.map(x => x.id === a.id ? { ...x, is_archived: !x.is_archived } : x)) }} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary hover:text-primary transition">{a.is_archived ? 'Restore' : 'Archive'}</button>
                <button onClick={async () => { if (!(await confirm({ title: 'Delete area', description: `"${a.name}" will be permanently removed.`, confirmText: 'Delete', destructive: true }))) return; const res = await deleteArea(a.id); if (res.error) { toast.error(res.error); return } setAreas(prev => prev.filter(x => x.id !== a.id)); toast.success('Deleted') }} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-red-500 hover:text-red-500 transition">Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
