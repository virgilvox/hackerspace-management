import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import CommsClient from './comms-client'

export default async function CommsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members').select('*, spaces(id, name, slug)').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member) return null

  const { data: channels } = await supabase
    .from('comms_channels')
    .select('*')
    .eq('space_id', member!.space_id)
    .order('channel_type')
    .order('name')

  return <CommsClient member={member} space={member?.spaces as Tables<'spaces'>} channels={channels ?? []} />
}
