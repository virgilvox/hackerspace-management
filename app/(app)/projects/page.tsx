import { createClient } from '@/lib/supabase/server'
import { ProjectsClient } from './projects-client'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members').select('space_id').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member) return null

  const { data: projects } = await supabase
    .from('projects').select('*').eq('space_id', member.space_id).order('created_at', { ascending: false })

  return <ProjectsClient projects={projects ?? []} spaceId={member.space_id} />
}
