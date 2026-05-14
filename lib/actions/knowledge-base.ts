'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMember, parseInput } from '@/lib/auth-helpers'
import {
  createKbEntrySchema,
  updateKbEntrySchema,
  uuidSchema,
} from '@/lib/validations'

export async function createKbEntry(formData: {
  title: string
  content: string
  description?: string
  area?: string
  visibility?: string
  is_pinned?: boolean
  tags?: string[]
  icon?: string
}) {
  const v = parseInput(createKbEntrySchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('knowledge_base')
    .insert({
      space_id: member.space_id,
      title: v.data.title,
      content: v.data.content,
      area: v.data.area ?? null,
      visibility: v.data.visibility,
      is_pinned: v.data.is_pinned,
      tags: v.data.tags ?? [],
      icon: v.data.icon ?? null,
      updated_by_id: member.id,
      updated_by_name: member.display_name,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { data }
}

export async function updateKbEntry(
  entryId: string,
  updates: {
    title?: string
    content?: string
    area?: string
    visibility?: string
    is_pinned?: boolean
    tags?: string[]
  },
) {
  const v = parseInput(updateKbEntrySchema, { entryId, ...updates })
  if (!v.ok) return { error: v.error }
  const { entryId: id, ...patch } = v.data

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('knowledge_base')
    .update({
      ...patch,
      updated_by_id: member.id,
      updated_by_name: member.display_name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { success: true as const }
}

export async function deleteKbEntry(entryId: string) {
  const v = parseInput(uuidSchema, entryId)
  if (!v.ok) return { error: 'Invalid entry ID' }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { success: true as const }
}
