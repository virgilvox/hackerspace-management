import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import KbEntryEditor from '../[id]/kb-entry-editor'

export default async function NewOpsEntryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members').select('space_id, role, display_name').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member) return null

  return <KbEntryEditor member={member as Tables<'space_members'>} />
}
