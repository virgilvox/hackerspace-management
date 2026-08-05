'use client'

import { Search, FileText } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from '@/components/ui/empty'
import { KbEntryRow } from '../components/kb-entry-row'
import type { AclRoleOption, KbEntry } from '../types'

// ─── KB / Processes Panel ──────────────────────────────────────────────────────
// Shared body for the "Knowledge Base" and "Processes" tabs. The KB variant
// splits pinned/critical entries into their own section; the processes variant
// renders a single flat list. Both receive already-filtered entries.
export function KbPanel({
  variant,
  entries,
  search,
  onAdd,
  onEdit,
  onDelete,
  canManageAcl,
  aclRoleOptions,
  aclByEntity,
}: {
  variant: 'kb' | 'processes'
  entries: KbEntry[]
  search: string
  onAdd: () => void
  onEdit: (e: KbEntry) => void
  onDelete: (id: string) => void
  canManageAcl?: boolean
  aclRoleOptions?: AclRoleOption[]
  aclByEntity?: Record<string, string[]>
}) {
  if (variant === 'processes') {
    return (
      <div className="space-y-4">
        {entries.length > 0 ? (
          <div className="bg-card rounded border border-border divide-y divide-border">
            {entries.map(entry => (
              <KbEntryRow
                key={entry.id}
                entry={entry}
                onEdit={onEdit}
                onDelete={onDelete}
                canManageAcl={canManageAcl}
                aclRoleOptions={aclRoleOptions}
                aclByEntity={aclByEntity}
              />
            ))}
          </div>
        ) : (
          <Empty className="bg-card border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">{search ? <Search /> : <FileText />}</EmptyMedia>
              <EmptyTitle>
                {search ? `No results for "${search}"` : 'No process entries yet'}
              </EmptyTitle>
            </EmptyHeader>
            {!search && (
              <EmptyContent>
                <button
                  onClick={onAdd}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  + Add first process
                </button>
              </EmptyContent>
            )}
          </Empty>
        )}
      </div>
    )
  }

  const pinnedKb = entries.filter(e => e.is_pinned)
  const unpinnedKb = entries.filter(e => !e.is_pinned)

  return (
    <div className="space-y-6">
      {pinnedKb.length > 0 && (
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Pinned / Critical</p>
          <div className="bg-card rounded border border-border divide-y divide-border">
            {pinnedKb.map(entry => (
              <KbEntryRow
                key={entry.id}
                entry={entry}
                onEdit={onEdit}
                onDelete={onDelete}
                canManageAcl={canManageAcl}
                aclRoleOptions={aclRoleOptions}
                aclByEntity={aclByEntity}
              />
            ))}
          </div>
        </div>
      )}
      {unpinnedKb.length > 0 && (
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">All Entries</p>
          <div className="bg-card rounded border border-border divide-y divide-border">
            {unpinnedKb.map(entry => (
              <KbEntryRow
                key={entry.id}
                entry={entry}
                onEdit={onEdit}
                onDelete={onDelete}
                canManageAcl={canManageAcl}
                aclRoleOptions={aclRoleOptions}
                aclByEntity={aclByEntity}
              />
            ))}
          </div>
        </div>
      )}
      {entries.length === 0 && (
        <Empty className="bg-card border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{search ? <Search /> : <FileText />}</EmptyMedia>
            <EmptyTitle>
              {search ? `No results for "${search}"` : 'No knowledge base entries yet'}
            </EmptyTitle>
          </EmptyHeader>
          {!search && (
            <EmptyContent>
              <button
                onClick={onAdd}
                className="font-mono text-xs text-primary hover:underline"
              >
                + Add first entry
              </button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </div>
  )
}
