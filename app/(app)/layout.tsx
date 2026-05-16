import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { getRoleLabelMap } from '@/lib/role-labels'

// This layout is the auth/onboarding gate for the whole app. It must never be
// statically cached: every request re-checks the session and member state.
export const dynamic = 'force-dynamic'

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

  // New members walk through the space's configured onboarding before they
  // reach the app. Founders (createSpace) and pre-existing members (migration
  // 022 backfill) have onboarding_completed_at set, so this only gates
  // genuinely-new joiners. /onboarding is outside this layout group, so there
  // is no redirect loop.
  if (!(member as { onboarding_completed_at?: string | null }).onboarding_completed_at) {
    redirect('/onboarding')
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

  const roleMap = await getRoleLabelMap(supabase, member.space_id)
  const roleName = roleMap[member.role]?.name ?? member.role

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <AppSidebar
        member={member}
        roleName={roleName}
        taskBadge={taskCount ?? 0}
        paymentBadge={paymentCount ?? 0}
      />
      <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto pt-[52px] md:pt-0 flex flex-col">
        <div className="flex-1">{children}</div>
        {member.spaces && (member.spaces as { mission_statement?: string | null }).mission_statement && (
          <footer className="border-t border-border bg-card px-4 md:px-6 py-3">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-1">
              {member.spaces.name}
            </p>
            <p className="font-sans text-xs text-muted-foreground italic">
              {(member.spaces as { mission_statement: string }).mission_statement}
            </p>
          </footer>
        )}
      </main>
    </div>
  )
}
