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

  const [{ data: tasks }, { data: members }] = await Promise.all([
    supabase.from('tasks').select('*').eq('space_id', spaceId).order('created_at', { ascending: false }),
    supabase.from('space_members').select('id, display_name, user_id').eq('space_id', spaceId).in('status', ['current', 'late']),
  ])

  return <TasksClient tasks={tasks ?? []} members={members ?? []} currentUserId={user.id} spaceId={spaceId} />
}
