import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Pin, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CommentThread } from '@/components/comments/comment-thread'
import { loadComments } from '@/components/comments/load-comments'
import { ThreadActions } from './thread-actions'

export default async function ForumThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: self } = await supabase
    .from('space_members')
    .select('id, space_id, role, display_name')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .single()
  if (!self) return null

  const { data: thread } = await supabase
    .from('forum_threads')
    .select('id, title, body, category, pinned, locked, comment_count, created_at, author_id, space_id')
    .eq('id', id)
    .single()
  if (!thread) notFound()
  if (thread.space_id !== self.space_id) notFound()

  let authorName = 'Member'
  if (thread.author_id) {
    const { data: a } = await supabase
      .from('space_members')
      .select('display_name')
      .eq('id', thread.author_id)
      .single()
    if (a?.display_name) authorName = a.display_name
  }

  const comments = await loadComments(supabase, 'forum_thread', thread.id)
  const isAuthor = self.id === thread.author_id
  const canModerate = self.role === 'admin' || self.role === 'board'
  const canEditThread = isAuthor || canModerate

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-5">
      <div>
        <Link href="/forum" className="font-mono text-[11px] tracking-widest text-muted-foreground hover:text-foreground uppercase">
          ← Forum
        </Link>
      </div>

      <header className="bg-card border border-border rounded p-5">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {thread.pinned && <Pin className="w-4 h-4 text-amber-500 shrink-0" />}
            {thread.locked && <Lock className="w-4 h-4 text-muted-foreground shrink-0" />}
            <h1 className="font-sans text-xl font-semibold text-foreground">{thread.title}</h1>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-widest">{thread.category}</span>
          </div>
          {canEditThread && (
            <ThreadActions
              threadId={thread.id}
              pinned={thread.pinned}
              locked={thread.locked}
              canModerate={canModerate}
              isAuthor={isAuthor}
            />
          )}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          {authorName} · {new Date(thread.created_at).toLocaleString()}
        </p>
        {thread.body && (
          <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none mt-4 break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{thread.body}</ReactMarkdown>
          </div>
        )}
      </header>

      <CommentThread
        entityType="forum_thread"
        entityId={thread.id}
        comments={comments}
        currentMemberId={self.id}
        canModerate={canModerate}
        locked={thread.locked}
      />
    </div>
  )
}
