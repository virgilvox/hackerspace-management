'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createForumThread } from '@/lib/actions'

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'projects', label: 'Projects' },
  { value: 'help', label: 'Help' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'off-topic', label: 'Off topic' },
]

export function NewThreadForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const result = await createForumThread({ title: title.trim(), body: body.trim() || undefined, category })
    setSaving(false)
    if ('error' in result && result.error) { toast.error(result.error); return }
    if ('id' in result && result.id) {
      toast.success('Thread created')
      router.push(`/forum/${result.id}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded p-5 space-y-4">
      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={200}
          required
          autoFocus
          className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
        >
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Body (markdown)</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={8}
          maxLength={20000}
          placeholder="Markdown supported. Headings, lists, code blocks, links."
          className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
        />
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition disabled:opacity-50"
        >
          {saving ? 'Posting...' : 'Post thread'}
        </button>
      </div>
    </form>
  )
}
