import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewProposalForm } from './new-proposal-form'

export const dynamic = 'force-dynamic'

export default async function NewProposalPage() {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3">
        <h1 className="text-white font-sans text-lg font-semibold">New proposal</h1>
      </div>
      <div className="p-4 md:p-6 max-w-2xl">
        <NewProposalForm />
      </div>
    </div>
  )
}
