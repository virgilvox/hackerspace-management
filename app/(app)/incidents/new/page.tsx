import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IncidentForm } from './incident-form'
import { PageTitle } from '@/components/ui/page-title'

export const dynamic = 'force-dynamic'

export default async function NewIncidentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('space_id')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .maybeSingle()
  if (!member?.space_id) redirect('/signup')

  // Pull members in the same space so the reporter can name subjects.
  const { data: members } = await supabase
    .from('space_members')
    .select('id, display_name')
    .eq('space_id', member.space_id)
    .order('display_name')

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3">
        <PageTitle>File a report</PageTitle>
      </div>
      <div className="p-4 md:p-6 max-w-2xl">
        <IncidentForm members={(members ?? []) as Array<{ id: string; display_name: string | null }>} />
      </div>
    </div>
  )
}
