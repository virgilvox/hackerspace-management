import type { SupabaseClient } from '@supabase/supabase-js'
import type { CommentEntityType, CommentRow } from './comment-thread'

// Server-side fetch helper. Used from server components that render a
// CommentThread for any of the four supported entity types.
export async function loadComments(
  supabase: SupabaseClient,
  entityType: CommentEntityType,
  entityId: string,
): Promise<CommentRow[]> {
  const { data } = await supabase
    .from('comments')
    .select('id, body, created_at, edited_at, author_id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true })
    // Bound the payload: a thread with thousands of comments must not be able
    // to hang the page. Newest 500 is plenty for the current UI.
    .limit(500)

  const rows = data ?? []
  const authorIds = Array.from(new Set(rows.map(r => r.author_id).filter(Boolean) as string[]))
  const authorMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from('space_members')
      .select('id, display_name')
      .in('id', authorIds)
    for (const a of authors ?? []) authorMap[a.id] = a.display_name ?? 'Member'
  }

  return rows.map(r => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    edited_at: r.edited_at,
    author_id: r.author_id,
    author_name: r.author_id ? (authorMap[r.author_id] ?? 'Member') : null,
  }))
}
