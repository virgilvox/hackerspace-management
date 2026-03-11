import { createClient } from '@/lib/supabase/server'
import { PaymentsClient } from './payments-client'

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).eq('status', 'current').single()
  if (!member) return null

  const [{ data: payments }, { data: members }, { data: integrations }] = await Promise.all([
    supabase.from('payments')
      .select('*, space_members(display_name)')
      .eq('space_id', member.space_id)
      .order('transaction_date', { ascending: false })
      .limit(100),
    supabase.from('space_members')
      .select('id, display_name, email')
      .eq('space_id', member.space_id)
      .eq('status', 'current'),
    supabase.from('integrations')
      .select('platform, is_connected, config')
      .eq('space_id', member.space_id),
  ])

  return (
    <PaymentsClient
      payments={payments ?? []}
      members={members ?? []}
      integrations={integrations ?? []}
      currentRole={member.role}
      spaceId={member.space_id}
    />
  )
}
