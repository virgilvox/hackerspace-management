import { createClient } from '@/lib/supabase/server'
import { ContactsClient } from './contacts-client'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members').select('space_id').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member) return null

  const { data: contacts } = await supabase
    .from('contacts').select('*').eq('space_id', member.space_id).order('name')

  return <ContactsClient contacts={contacts ?? []} />
}
