'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMember, logActivity, parseInput } from '@/lib/auth-helpers'
import { createTaskSchema, taskIdSchema } from '@/lib/validations'

export async function createTask(formData: {
  title: string
  description?: string
  type: string
  area?: string
  recurrence?: string
  due_date?: string
}) {
  const v = parseInput(createTaskSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      space_id: member.space_id,
      title: v.data.title,
      description: v.data.description,
      task_type: v.data.type,
      area: v.data.area,
      recurrence: v.data.recurrence,
      due_date: v.data.due_date ?? null,
      status: 'open',
      requested_by: member.user_id,
      requested_by_name: member.display_name,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'created', 'task', data.id, v.data.title)

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { data }
}

export async function claimTask(taskId: string) {
  const v = parseInput(taskIdSchema, taskId)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('tasks')
    .update({
      claimed_by: member.user_id,
      claimed_by_name: member.display_name,
      status: 'claimed',
    })
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'claimed', 'task', v.data)

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { success: true as const }
}

export async function completeTask(taskId: string) {
  const v = parseInput(taskIdSchema, taskId)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: now,
      last_done_at: now,
    })
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'completed', 'task', v.data)

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { success: true as const }
}

export async function deleteTask(taskId: string) {
  const v = parseInput(taskIdSchema, taskId)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/tasks')
  return { success: true as const }
}
