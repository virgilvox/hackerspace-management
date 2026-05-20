'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMember, requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import {
  createForumThreadSchema,
  updateForumThreadSchema,
  createCommentSchema,
  updateCommentSchema,
  uuidSchema,
} from '@/lib/validations'

export async function createForumThread(input: {
  title: string
  body?: string
  category?: string
}) {
  const v = parseInput(createForumThreadSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('forum_threads')
    .insert({
      space_id: member.space_id,
      author_id: member.id,
      title: v.data.title,
      body: v.data.body ?? null,
      category: v.data.category ?? 'general',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/forum')
  return { id: data.id }
}

export async function updateForumThread(threadId: string, updates: {
  title?: string
  body?: string | null
  category?: string
  pinned?: boolean
  locked?: boolean
}) {
  const idCheck = parseInput(uuidSchema, threadId)
  if (!idCheck.ok) return { error: 'Invalid thread ID' }
  const v = parseInput(updateForumThreadSchema, updates)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Pinning/locking is moderator-only (admin/board). The RLS UPDATE policy
  // additionally requires the actor to be the author or admin/board, so a
  // non-author cannot edit a thread regardless of this guard.
  const wantsMod = v.data.pinned !== undefined || v.data.locked !== undefined
  if (wantsMod) {
    const modAuth = await requireMemberWithRole(supabase, ['admin', 'board'], 'Admin or board access required')
    if (!modAuth.ok) return { error: modAuth.error }
  }

  const patch: Record<string, unknown> = {}
  if (v.data.title    !== undefined) patch.title = v.data.title
  if (v.data.body     !== undefined) patch.body = v.data.body
  if (v.data.category !== undefined) patch.category = v.data.category
  if (v.data.pinned   !== undefined) patch.pinned = v.data.pinned
  if (v.data.locked   !== undefined) patch.locked = v.data.locked

  const { error } = await supabase.from('forum_threads').update(patch).eq('id', idCheck.data).eq('space_id', member.space_id)
  if (error) return { error: error.message }
  revalidatePath('/forum')
  revalidatePath(`/forum/${idCheck.data}`)
  return { success: true as const }
}

export async function deleteForumThread(threadId: string) {
  const v = parseInput(uuidSchema, threadId)
  if (!v.ok) return { error: 'Invalid thread ID' }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // RLS DELETE allows the author or admin; non-authors get a row-not-found
  // error which we translate to a clearer message.
  const { error, count } = await supabase
    .from('forum_threads')
    .delete({ count: 'exact' })
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  if (count === 0) return { error: 'Not allowed to delete this thread' }
  revalidatePath('/forum')
  return { success: true as const }
}

export async function addComment(input: {
  entity_type: 'forum_thread' | 'proposal' | 'incident' | 'policy'
  entity_id: string
  body: string
  parent_id?: string | null
}) {
  const v = parseInput(createCommentSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Verify the target entity exists IN THE CALLER'S SPACE before commenting.
  // The RLS client scopes these reads to the caller's space, so a missing row
  // means the entity is not in their space (or does not exist). Without this,
  // a member could attach a comment to another space's proposal/incident/policy
  // (the row would be stamped with the caller's own space_id). Also gates
  // locked forum threads.
  let entityInSpace = false
  let threadLocked = false
  if (v.data.entity_type === 'forum_thread') {
    const { data } = await supabase.from('forum_threads').select('id, locked').eq('id', v.data.entity_id).maybeSingle()
    entityInSpace = !!data
    threadLocked = !!data?.locked
  } else if (v.data.entity_type === 'proposal') {
    const { data } = await supabase.from('proposals').select('id').eq('id', v.data.entity_id).maybeSingle()
    entityInSpace = !!data
  } else if (v.data.entity_type === 'incident') {
    const { data } = await supabase.from('incidents').select('id').eq('id', v.data.entity_id).maybeSingle()
    entityInSpace = !!data
  } else if (v.data.entity_type === 'policy') {
    const { data } = await supabase.from('policies').select('id').eq('id', v.data.entity_id).maybeSingle()
    entityInSpace = !!data
  }
  if (!entityInSpace) return { error: 'Not found' }
  if (threadLocked) return { error: 'Thread is locked' }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      space_id: member.space_id,
      entity_type: v.data.entity_type,
      entity_id: v.data.entity_id,
      author_id: member.id,
      parent_id: v.data.parent_id ?? null,
      body: v.data.body,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (v.data.entity_type === 'forum_thread') {
    revalidatePath(`/forum/${v.data.entity_id}`)
  } else if (v.data.entity_type === 'proposal') {
    revalidatePath(`/proposals/${v.data.entity_id}`)
  } else if (v.data.entity_type === 'incident') {
    revalidatePath(`/incidents/${v.data.entity_id}`)
  }
  return { id: data.id }
}

export async function editComment(commentId: string, body: string) {
  const idCheck = parseInput(uuidSchema, commentId)
  if (!idCheck.ok) return { error: 'Invalid comment ID' }
  const v = parseInput(updateCommentSchema, { body })
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('comments')
    .update({ body: v.data.body, edited_at: new Date().toISOString() })
    .eq('id', idCheck.data)
    .eq('space_id', member.space_id)
    .select('entity_type, entity_id')
    .single()

  if (error) return { error: error.message }
  if (data?.entity_type === 'forum_thread') revalidatePath(`/forum/${data.entity_id}`)
  return { success: true as const }
}

export async function deleteComment(commentId: string) {
  const v = parseInput(uuidSchema, commentId)
  if (!v.ok) return { error: 'Invalid comment ID' }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('comments')
    .delete()
    .eq('id', v.data)
    .eq('space_id', member.space_id)
    .select('entity_type, entity_id')
    .single()

  if (error) return { error: error.message }
  if (data?.entity_type === 'forum_thread') revalidatePath(`/forum/${data.entity_id}`)
  return { success: true as const }
}
