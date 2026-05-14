import { createClient } from '@/lib/supabase/server'
import { TasksClient } from './tasks-client'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members')
    .select('space_id, user_id, display_name, role')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .single()

  const spaceId = member?.space_id
  if (!spaceId) return null

  const [{ data: tasks }, { data: members }, { data: areasRaw }] = await Promise.all([
    supabase.from('tasks').select('*').eq('space_id', spaceId).order('created_at', { ascending: false }),
    supabase.from('space_members').select('id, display_name, user_id').eq('space_id', spaceId).in('status', ['current', 'late']),
    supabase
      .from('space_areas')
      .select('name')
      .eq('space_id', spaceId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  ])

  const areas = (areasRaw ?? []).map((a: { name: string }) => a.name)

  return (
    <TasksClient
      tasks={tasks ?? []}
      members={members ?? []}
      currentUserId={user.id}
      spaceId={spaceId}
      areas={areas}
    />
  )
}
