'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMember, logActivity, parseInput } from '@/lib/auth-helpers'
import {
  createProjectSchema,
  updateProjectStatusSchema,
  uuidSchema,
} from '@/lib/validations'

export async function createProject(formData: {
  title: string
  description?: string
  area?: string
  tags?: string[]
  due_date?: string
}) {
  const v = parseInput(createProjectSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('projects')
    .insert({
      space_id: member.space_id,
      title: v.data.title,
      description: v.data.description,
      area: v.data.area,
      tags: v.data.tags ?? [],
      due_date: v.data.due_date ?? null,
      status: 'backlog',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'created', 'project', data.id, v.data.title)

  revalidatePath('/projects')
  return { data }
}

export async function updateProjectStatus(projectId: string, status: string) {
  const v = parseInput(updateProjectStatusSchema, { projectId, status })
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('projects')
    .update({ status: v.data.status, updated_at: new Date().toISOString() })
    .eq('id', v.data.projectId)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return { success: true as const }
}

export async function deleteProject(projectId: string) {
  const v = parseInput(uuidSchema, projectId)
  if (!v.ok) return { error: 'Invalid project ID' }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/projects')
  return { success: true as const }
}
