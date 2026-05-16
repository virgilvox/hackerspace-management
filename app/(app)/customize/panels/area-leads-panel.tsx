'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserCog } from 'lucide-react'
import { createAreaLeadRole, assignAreaLead, unassignAreaLead, deleteAreaLeadRole } from '@/lib/actions'
import { Card } from './card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'

interface AreaLead {
  id: string
  area_code: string | null
  area_name: string
  lead_id: string | null
  lead_handle: string | null
  status: string
}
interface Member { id: string; display_name: string | null; handle: string | null }

interface Props {
  isAdmin: boolean
  areaLeads: AreaLead[]
  members: Member[]
}

export function AreaLeadsPanel({ isAdmin, areaLeads: initial, members }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<AreaLead[]>(initial)
  const [showNew, setShowNew] = useState(false)
  const [d, setD] = useState({ area_code: '', name: '' })

  function memberLabel(id: string | null) {
    if (!id) return null
    const m = members.find(x => x.id === id)
    return m ? (m.display_name || m.handle || 'Member') : 'Member'
  }

  return (
    <Card
      title="Area-lead roles"
      blurb="Each row is an area-lead role. Unassigned roles show as Vacant. Assign a member here (or from the member directory). The assigned member effectively holds this role, so any Ops item whose access list includes it becomes available to them."
      action={isAdmin ? (
        <button onClick={() => setShowNew(v => !v)} className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition whitespace-nowrap">
          {showNew ? 'Cancel' : '+ Area-lead role'}
        </button>
      ) : undefined}
    >
      {showNew && (
        <form
          onSubmit={async e => {
            e.preventDefault()
            const result = await createAreaLeadRole({ area_code: d.area_code.trim().toLowerCase(), name: d.name.trim() })
            if ('error' in result && result.error) { toast.error(result.error); return }
            toast.success('Area-lead role created')
            const created = (result as { data?: AreaLead }).data
            if (created) setRows(prev => [...prev, created])
            setShowNew(false); setD({ area_code: '', name: '' })
          }}
          className="mb-4 p-4 border border-border rounded bg-background grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <input type="text" required value={d.area_code} onChange={e => setD({ ...d, area_code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') })} placeholder="area code (e.g. woodshop)" className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="text" required value={d.name} onChange={e => setD({ ...d, name: e.target.value })} placeholder="Role name (e.g. Woodshop Lead)" className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <button type="submit" className="md:col-span-2 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition">Create</button>
        </form>
      )}

      {rows.length === 0 ? (
        <Empty className="border-0 p-0 md:p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon"><UserCog /></EmptyMedia>
            <EmptyTitle>No area-lead roles yet</EmptyTitle>
            <EmptyDescription>Create a role per shop area, then assign a member to it. Roles without a member show as Vacant.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(r => (
            <li key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-sans text-sm font-medium text-foreground">{r.area_name}</span>
                  {r.area_code && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.area_code}</span>}
                  {r.lead_id ? (
                    <span className="font-mono text-[10px] text-primary">{memberLabel(r.lead_id)}</span>
                  ) : (
                    <span className="font-mono text-[10px] text-amber-600">Vacant</span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={r.lead_id ?? ''}
                    onChange={async e => {
                      const memberId = e.target.value
                      if (!memberId) {
                        const res = await unassignAreaLead(r.id)
                        if (res.error) { toast.error(res.error); return }
                        setRows(prev => prev.map(x => x.id === r.id ? { ...x, lead_id: null, lead_handle: null, status: 'vacant' } : x))
                        toast.success('Set to vacant')
                      } else {
                        const res = await assignAreaLead({ area_lead_role_id: r.id, member_id: memberId })
                        if (res.error) { toast.error(res.error); return }
                        setRows(prev => prev.map(x => x.id === r.id ? { ...x, lead_id: memberId, status: 'active' } : x))
                        toast.success('Lead assigned')
                        router.refresh()
                      }
                    }}
                    className="bg-background border border-border text-foreground font-sans text-xs rounded px-2 py-1 focus:outline-none focus:border-primary"
                  >
                    <option value="">Vacant</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.display_name || m.handle || 'Member'}</option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete area-lead role "${r.area_name}"?`)) return
                      const res = await deleteAreaLeadRole(r.id)
                      if (res.error) { toast.error(res.error); return }
                      setRows(prev => prev.filter(x => x.id !== r.id))
                      toast.success('Deleted')
                    }}
                    className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-red-500 hover:text-red-500 transition"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
