'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pin, Lock } from 'lucide-react'
import { createKbEntry, updateKbEntry } from '@/lib/actions'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'
import { PageTitle } from '@/components/ui/page-title'

interface Props {
  entry?: Tables<'knowledge_base'>
  member: Tables<'space_members'>
}

export default function KbEntryEditor({ entry, member }: Props) {
  const router = useRouter()
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
    router.push('/ops')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-6 py-3 flex items-center gap-4">
        <Link href="/ops" className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <PageTitle>{isEdit ? 'Edit Entry' : 'New KB Entry'}</PageTitle>
      </div>

      <div className="p-6 max-w-3xl">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div>
              <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2.5 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition"
                placeholder="e.g. How to open the space, Emergency contacts..."
                required
              />
            </div>
            <div>
              <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Content *</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={16}
                className="w-full bg-background border border-border rounded px-3 py-2.5 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition resize-y leading-relaxed"
                placeholder="Write the full content here. Markdown formatting is supported."
                required
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Settings</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Area</label>
                <input
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition"
                  placeholder="e.g. Woodshop, Kitchen, Network"
                />
              </div>
              <div>
                <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Visibility</label>
                <select
                  value={visibility}
                  onChange={e => setVisibility(e.target.value as 'board' | 'all_members' | 'admin_only')}
                  className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition"
                >
                  <option value="all_members">All Members</option>
                  <option value="board">Board Only</option>
                  <option value="admin_only">Admin Only</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={e => setIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <Pin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-sans text-sm text-foreground">Pin to top (critical info)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isProcess}
                  onChange={e => setIsProcess(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="font-sans text-sm text-foreground">Tag as Process</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link href="/ops" className="border border-border bg-card text-foreground font-sans text-sm px-4 py-2 rounded hover:border-primary/50 transition">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !title.trim() || !content.trim()}
              className="bg-primary text-white font-sans text-sm px-6 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
