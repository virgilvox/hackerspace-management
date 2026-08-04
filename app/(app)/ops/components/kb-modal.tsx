'use client'

import { useState } from 'react'
import { createKbEntry, updateKbEntry } from '@/lib/actions'
import { toast } from 'sonner'
import type { Enums } from '@/types/database'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { KbEntry } from '../types'

// ─── KB Entry Modal ────────────────────────────────────────────────────────────
export function KbModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: KbEntry | null
  onClose: () => void
  onSaved: (entry: KbEntry) => void
}) {
  const isEdit = !!entry
  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [area, setArea] = useState(entry?.area ?? '')
  const [visibility, setVisibility] = useState(entry?.visibility ?? 'all_members')
  const [isPinned, setIsPinned] = useState(entry?.is_pinned ?? false)
  const [isProcess, setIsProcess] = useState(entry?.tags?.includes('process') ?? false)
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    const tags = isProcess ? ['process'] : []
    let result
    if (isEdit) {
      result = await updateKbEntry(entry.id, { title, content, area, visibility, is_pinned: isPinned, tags })
    } else {
      result = await createKbEntry({ title, content, area, visibility, is_pinned: isPinned, tags })
    }
    setSaving(false)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    toast.success(isEdit ? 'Entry updated' : 'Entry created')
    if (!isEdit && 'data' in result && result.data) onSaved(result.data as KbEntry)
    else if (isEdit) onSaved({ ...entry, title, content, area, visibility, is_pinned: isPinned, tags })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-sans text-sm font-semibold text-foreground">{isEdit ? 'Edit Entry' : 'New KB Entry'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition"
              placeholder="e.g. How to open the space"
              required
            />
          </div>
          <div>
            <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Content *</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition resize-y"
              placeholder="Write the full content here..."
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Area</label>
              <input
                value={area}
                onChange={e => setArea(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition"
                placeholder="e.g. Woodshop, Kitchen"
              />
            </div>
            <div>
              <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Visibility</label>
              <select
                value={visibility}
                onChange={e => setVisibility(e.target.value as Enums<'kb_visibility'>)}
                className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition"
              >
                <option value="all_members">All Members</option>
                <option value="board">Board Only</option>
                <option value="admin_only">Admin Only</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={e => setIsPinned(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="font-sans text-sm text-foreground">Pin (critical / always visible)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isProcess}
                onChange={e => setIsProcess(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="font-sans text-sm text-foreground">Tag as Process</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="border border-border bg-card text-foreground font-sans text-sm px-4 py-2 rounded hover:border-primary/50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !content.trim()}
              className="bg-primary text-white font-sans text-sm px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Entry'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
