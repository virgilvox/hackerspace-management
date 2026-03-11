import { createClient } from '@/lib/supabase/server'
import { OpsClient } from './ops-client'

export default async function OpsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members').select('space_id, role, display_name, user_id').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member) return null

  const canSeeSecrets = member.role === 'admin' || member.role === 'board'

  const [{ data: kbEntries }, { data: areaLeads }, secretsResult] = await Promise.all([
    supabase.from('knowledge_base').select('*').eq('space_id', member.space_id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('area_leads').select('*').eq('space_id', member.space_id).order('area_name'),
    canSeeSecrets
      ? supabase.from('secrets').select('id, title, area, created_at').eq('space_id', member.space_id)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <OpsClient
      member={member}
      spaceId={member.space_id}
      kbEntries={kbEntries ?? []}
      areaLeads={areaLeads ?? []}
      secrets={(secretsResult as any)?.data ?? []}
      canSeeSecrets={canSeeSecrets}
    />
  )
}
