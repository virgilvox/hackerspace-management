import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('*, spaces(*)')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!member || !member.spaces) {
    // No space found - redirect to signup to create/join one
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (currentUser) {
      redirect(`/signup?email=${encodeURIComponent(currentUser.email || '')}`)
    }
    redirect('/login')
  }

  // Count badges
  const { count: taskCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('space_id', member.space_id)
    .in('status', ['open', 'claimed'])

  const { count: paymentCount } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('space_id', member.space_id)
    .eq('link_status', 'unlinked')

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar
        member={member}
        taskBadge={taskCount ?? 0}
        paymentBadge={paymentCount ?? 0}
      />
      <main className="flex-1 overflow-y-auto pt-[52px] md:pt-0">
        {children}
      </main>
    </div>
  )
}
