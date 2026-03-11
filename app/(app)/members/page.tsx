import { createClient } from '@/lib/supabase/server'
import { MembersClient } from './members-client'

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: self } = await supabase
    .from('space_members')
    .select('space_id, role')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .single()

  if (!self) return null

  const { data: members } = await supabase
    .from('space_members')
    .select('*')
    .eq('space_id', self.space_id)
    .order('joined_at')

  return (
    <MembersClient
      members={members ?? []}
      currentRole={self.role}
    />
  )
}
