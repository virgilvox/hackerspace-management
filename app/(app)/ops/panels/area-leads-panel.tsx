'use client'

import { Pencil, Trash2, Users2 } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from '@/components/ui/empty'
import type { AreaLead } from '../types'

// ─── Area Leads Panel ──────────────────────────────────────────────────────────
export function AreaLeadsPanel({
  leads,
  onAdd,
  onEdit,
  onDelete,
}: {
  leads: AreaLead[]
  onAdd: () => void
  onEdit: (lead: AreaLead) => void
  onDelete: (id: string) => void
}) {
  return (
    <div>
      {leads.length > 0 ? (
        <div className="bg-card rounded border border-border divide-y divide-border">
          {leads.map(lead => (
            <div key={lead.id} className="flex items-center gap-3 px-4 py-4 group hover:bg-muted/20 transition">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-mono font-bold text-primary flex-shrink-0">
                {lead.area_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-medium text-foreground">{lead.area_name}</p>
                <p className="font-mono text-xs text-muted-foreground">{lead.lead_handle}</p>
                {lead.description && (
                  <p className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{lead.description}</p>
                )}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => onEdit(lead)}
                  className="text-muted-foreground hover:text-primary transition p-1"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(lead.id)}
                  className="text-muted-foreground hover:text-red-500 transition p-1"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty className="bg-card border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users2 /></EmptyMedia>
            <EmptyTitle>No area leads assigned yet</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <button
              onClick={onAdd}
              className="font-mono text-xs text-primary hover:underline"
            >
              + Assign first area lead
            </button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}
