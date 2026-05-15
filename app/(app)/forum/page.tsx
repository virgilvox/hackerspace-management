import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Pin, Lock, MessagesSquare, Plus } from 'lucide-react'

export default async function ForumIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: self } = await supabase
    .from('space_members')
    .select('space_id, role, display_name, id')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .single()
  if (!self) return null

  const { data: threads } = await supabase
    .from('forum_threads')
    .select('id, title, category, pinned, locked, comment_count, last_comment_at, created_at, author_id')
    .eq('space_id', self.space_id)
    .order('pinned', { ascending: false })
    .order('last_comment_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200)

  const authorIds = Array.from(new Set((threads ?? []).map(t => t.author_id).filter(Boolean) as string[]))
  const authorMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from('space_members')
      .select('id, display_name')
      .in('id', authorIds)
    for (const a of authors ?? []) authorMap[a.id] = a.display_name ?? 'Member'
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="font-mono text-sm tracking-widest uppercase text-muted-foreground mb-1">Forum</h1>
          <p className="font-sans text-sm text-muted-foreground">Long-form discussion, announcements, and proposals before they become proposals.</p>
        </div>
        <Link
          href="/forum/new"
          className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New thread
        </Link>
      </div>

      {threads && threads.length > 0 ? (
        <div className="bg-card border border-border rounded divide-y divide-border">
          {threads.map(t => (
            <Link
              key={t.id}
              href={`/forum/${t.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition"
            >
              <MessagesSquare className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {t.pinned && <Pin className="w-3 h-3 text-amber-500" aria-label="Pinned" />}
                  {t.locked && <Lock className="w-3 h-3 text-muted-foreground" aria-label="Locked" />}
                  <span className="font-sans text-sm font-medium text-foreground truncate">{t.title}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-widest">{t.category}</span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                  {(t.author_id && authorMap[t.author_id]) ?? 'Member'}
                  {' · '}
                  {t.comment_count} {t.comment_count === 1 ? 'reply' : 'replies'}
                  {t.last_comment_at && <> · last activity {new Date(t.last_comment_at).toLocaleString()}</>}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded p-10 text-center">
          <MessagesSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-sans text-sm text-foreground mb-1">No threads yet.</p>
          <p className="font-sans text-sm text-muted-foreground mb-4">Start the conversation.</p>
          <Link
            href="/forum/new"
            className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Start a thread
          </Link>
        </div>
      )}
    </div>
  )
}
