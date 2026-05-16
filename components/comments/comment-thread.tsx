'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { addComment, deleteComment } from '@/lib/actions'
import { Trash2, MessageCircle } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export type CommentEntityType = 'forum_thread' | 'proposal' | 'incident' | 'policy'

export interface CommentRow {
  id: string
  body: string
  created_at: string
  edited_at: string | null
  author_id: string | null
  author_name: string | null
}

interface Props {
  entityType: CommentEntityType
  entityId: string
  comments: CommentRow[]
  currentMemberId: string | null
  canModerate: boolean
  locked?: boolean
}

export function CommentThread({ entityType, entityId, comments, currentMemberId, canModerate, locked }: Props) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || locked) return
    setSaving(true)
    const result = await addComment({ entity_type: entityType, entity_id: entityId, body: body.trim() })
    setSaving(false)
    if ('error' in result && result.error) { toast.error(result.error); return }
    setBody('')
    router.refresh()
  }

  async function handleDelete(commentId: string) {
    if (!confirm('Delete this comment?')) return
    const result = await deleteComment(commentId)
    if (result.error) { toast.error(result.error); return }
    toast.success('Comment deleted')
    router.refresh()
  }

  return (
    <section className="bg-card border border-border rounded p-5">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-4 h-4 text-muted-foreground" />
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Discussion{comments.length > 0 ? ` (${comments.length})` : ''}
        </p>
      </div>

      {comments.length === 0 && (
        <Empty className="border-0 p-0 py-6 mb-4">
          <EmptyHeader>
            <EmptyMedia variant="icon"><MessageCircle /></EmptyMedia>
            <EmptyTitle>No comments yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}

      {comments.length > 0 && (
        <ul className="space-y-4 mb-6">
          {comments.map(c => {
            const mine = currentMemberId && c.author_id === currentMemberId
            const canDelete = mine || canModerate
            return (
              <li key={c.id} className="bg-background/60 border border-border rounded p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-sans text-xs font-medium text-foreground">{c.author_name ?? 'Removed member'}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleString()}
                    {c.edited_at && ' · edited'}
                  </span>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="ml-auto text-muted-foreground hover:text-red-500 transition p-1"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body}</ReactMarkdown>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {locked ? (
        <p className="font-sans text-sm text-muted-foreground border-t border-border pt-3">
          This thread is locked. New comments are disabled.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="border-t border-border pt-4 space-y-2">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            maxLength={10000}
            placeholder="Write a comment (markdown supported)..."
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          />
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={saving || !body.trim()}
              className="bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {saving ? 'Posting...' : 'Post comment'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
