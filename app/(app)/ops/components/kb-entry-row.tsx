'use client'

import { useState } from 'react'
import { Pin, Pencil, Trash2 } from 'lucide-react'
import { SafeMarkdown } from '@/components/safe-markdown'
import { deleteKbEntry } from '@/lib/actions'
import { OpsAclEditor } from '@/components/ops/ops-acl-editor'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm'
import type { AclRoleOption, KbEntry } from '../types'
import { VISIBILITY_LABELS, VISIBILITY_COLORS } from '../types'

// ─── KB Entry Row ──────────────────────────────────────────────────────────────
export function KbEntryRow({
  entry,
  onEdit,
  onDelete,
  canManageAcl,
  aclRoleOptions,
  aclByEntity,
}: {
  entry: KbEntry
  onEdit: (e: KbEntry) => void
  onDelete: (id: string) => void
  canManageAcl?: boolean
  aclRoleOptions?: AclRoleOption[]
  aclByEntity?: Record<string, string[]>
}) {
  const confirm = useConfirm()
  const [viewing, setViewing] = useState(false)
  const aclEntityType: 'kb' | 'process' = entry.tags?.includes('process') ? 'process' : 'kb'
  const aclInitial = aclByEntity?.[`${aclEntityType}:${entry.id}`] ?? []

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!(await confirm({ title: 'Delete entry', description: `"${entry.title}" will be permanently removed.`, confirmText: 'Delete', destructive: true }))) return
    const result = await deleteKbEntry(entry.id)
    if ('error' in result && result.error) { toast.error(result.error); return }
    toast.success('Entry deleted')
    onDelete(entry.id)
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    onEdit(entry)
  }

  return (
    <>
      <div
        onClick={() => setViewing(true)}
        className={`flex items-start gap-3 px-4 py-4 hover:bg-muted/20 transition group border-l-4 cursor-pointer ${
          entry.is_pinned
            ? entry.visibility === 'admin_only' ? 'border-l-red-400' : entry.visibility === 'board' ? 'border-l-amber-400' : 'border-l-primary'
            : 'border-l-transparent'
        }`}
      >
        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0 text-base">
          {entry.icon || (
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-sans text-sm font-medium text-foreground">{entry.title}</p>
            {entry.is_pinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
          </div>
          <p className="font-mono text-[10px] text-muted-foreground line-clamp-2">{entry.content?.slice(0, 120)}</p>
          <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
            {entry.area && <span>{entry.area} · </span>}
            updated {new Date(entry.updated_at).toLocaleDateString()} by {entry.updated_by_name}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`font-mono text-[10px] px-2 py-0.5 rounded border whitespace-nowrap ${VISIBILITY_COLORS[entry.visibility] ?? 'text-muted-foreground bg-muted border-border'}`}>
            {VISIBILITY_LABELS[entry.visibility] ?? entry.visibility}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button onClick={handleEdit} className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 text-muted-foreground hover:text-primary transition" title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 text-muted-foreground hover:text-red-500 transition" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={viewing} onOpenChange={(o) => { if (!o) setViewing(false) }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-3 pr-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {entry.icon && <span className="text-lg">{entry.icon}</span>}
                  <DialogTitle className="font-sans text-lg font-semibold text-foreground">{entry.title}</DialogTitle>
                  {entry.is_pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
                </div>
                <p className="font-mono text-[10px] text-muted-foreground mt-1">
                  {entry.area && <span>{entry.area} · </span>}
                  {VISIBILITY_LABELS[entry.visibility] ?? entry.visibility}
                  {' · '}
                  updated {new Date(entry.updated_at).toLocaleDateString()} by {entry.updated_by_name ?? 'unknown'}
                </p>
              </div>
              <button onClick={() => onEdit(entry)} className="text-muted-foreground hover:text-primary transition p-1" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>
          <div>
            <SafeMarkdown>{entry.content ?? ''}</SafeMarkdown>
            {canManageAcl && (
              <OpsAclEditor
                entityType={aclEntityType}
                entityId={entry.id}
                options={aclRoleOptions ?? []}
                initial={aclInitial}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
