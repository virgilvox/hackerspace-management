import { createClient } from '@/lib/supabase/server'
import SettingsClient from './settings-client'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).eq('status', 'current').single()

  if (!member) redirect('/login')

  const { data: space } = await supabase
    .from('spaces').select('*').eq('id', member.space_id).single()

  const { data: integrations } = await supabase
    .from('integrations').select('*').eq('space_id', member.space_id)

  const isAdmin = member?.role === 'admin'

  return (
    <SettingsClient
      space={space}
      isAdmin={isAdmin}
      integrations={integrations ?? []}
      currentRole={member.role}
    />
  )
}
