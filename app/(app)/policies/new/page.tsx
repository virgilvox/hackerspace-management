import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewPolicyForm } from './new-policy-form'
import { PageTitle } from '@/components/ui/page-title'

export const dynamic = 'force-dynamic'

export default async function NewPolicyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('space_id, role')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .maybeSingle()
  if (!member?.space_id) redirect('/signup')
  if (member.role !== 'admin' && member.role !== 'board') redirect('/policies')

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3">
        <PageTitle>New policy</PageTitle>
      </div>
      <div className="p-4 md:p-6 max-w-2xl">
        <NewPolicyForm />
      </div>
    </div>
  )
}
