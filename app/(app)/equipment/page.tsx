import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listEquipmentForMembers } from '@/lib/actions'
import { EquipmentBrowseClient } from './equipment-browse-client'

export const dynamic = 'force-dynamic'

export default async function EquipmentPage() {
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

  const res = await listEquipmentForMembers()
  const equipment = 'data' in res ? res.data : []

  return <EquipmentBrowseClient equipment={equipment as unknown[]} />
}
