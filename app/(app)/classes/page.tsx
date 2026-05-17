import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listUpcomingSessions } from '@/lib/actions'
import { ClassesBrowseClient } from './classes-browse-client'

export const dynamic = 'force-dynamic'

export default async function ClassesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('space_id')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .maybeSingle()
  if (!member) redirect('/signup')

  const [{ data: canInstruct }, { data: canManage }] = await Promise.all([
    supabase.rpc('user_has_permission', { uid: user.id, sid: member.space_id, perm: 'classes.instruct' }),
    supabase.rpc('user_has_permission', { uid: user.id, sid: member.space_id, perm: 'classes.manage' }),
  ])

  const res = await listUpcomingSessions()
  const sessions = 'data' in res ? res.data : []

  return (
    <ClassesBrowseClient
      sessions={sessions as unknown[]}
      canRunSessions={!!canInstruct || !!canManage}
    />
  )
}
