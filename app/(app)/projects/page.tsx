import { createClient } from '@/lib/supabase/server'
import { ProjectsClient } from './projects-client'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members').select('space_id').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member) return null

  const [{ data: projects }, { data: areasRaw }] = await Promise.all([
    supabase.from('projects').select('*').eq('space_id', member.space_id).order('created_at', { ascending: false }),
    supabase
      .from('space_areas')
      .select('name')
      .eq('space_id', member.space_id)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  ])

  const areas = (areasRaw ?? []).map((a: { name: string }) => a.name)

  return <ProjectsClient projects={projects ?? []} spaceId={member.space_id} areas={areas} />
}
