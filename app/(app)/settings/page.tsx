import { createClient } from '@/lib/supabase/server'
import SettingsClient from './settings-client'
import { StripeBillingPanel } from '@/components/settings/stripe-billing-panel'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()

  if (!member) redirect('/login')

  // Settings is admin-only. Gate on the server BEFORE fetching space config
  // and integration state so non-admins never receive it. Board/treasurer
  // use /customize for the things they can change.
  const isAdmin = member.role === 'admin'
  if (!isAdmin) redirect('/dashboard')

  const { data: space } = await supabase
    .from('spaces').select('*').eq('id', member.space_id).single()

  const { data: integrations } = await supabase
    .from('integrations').select('*').eq('space_id', member.space_id)

  return (
    <>
      <SettingsClient
        space={space}
        isAdmin={isAdmin}
        integrations={integrations ?? []}
        currentRole={member.role}
      />
      <StripeBillingPanel spaceId={member.space_id} />
    </>
  )
}
