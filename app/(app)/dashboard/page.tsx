import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Tables } from '@/types/database'
import { PageTitle } from '@/components/ui/page-title'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { listSelfEntryDoors, listPresentNow } from '@/lib/actions'
import { DoorSelfEntry } from './door-self-entry'
import { PresencePanel } from './presence-panel'

function IcoUsers({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
}
function IcoDues({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
}
function IcoTask({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function IcoPay({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
}
function IcoPlus({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}
function IcoDoor({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16M14 12h.01" /></svg>
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('id, space_id, display_name, role')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .maybeSingle()

  if (!member?.space_id) redirect('/signup')

  const spaceId = member.space_id
  const memberId = (member as { id: string }).id
  const isAdminOrBoard = member.role === 'admin' || member.role === 'board'

  const [
    { count: activeMembers },
    { count: openTasks },
    { count: unlinkedPayments },
    { data: tasks },
    { data: projects },
    { data: activity },
    { data: openProposalsRaw },
    { data: myVotesRaw },
    { data: pendingIncidentsRaw },
    { count: unverifiedMembers },
  ] = await Promise.all([
    supabase.from('space_members').select('*', { count: 'exact', head: true }).eq('space_id', spaceId).eq('status', 'current'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('space_id', spaceId).in('status', ['open', 'claimed', 'in_progress']),
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('space_id', spaceId).eq('link_status', 'unlinked'),
    supabase.from('tasks').select('*').eq('space_id', spaceId).in('status', ['open', 'claimed', 'in_progress', 'overdue', 'due_today', 'blocked']).order('due_date', { ascending: true, nullsFirst: false }).limit(5),
    supabase.from('projects').select('*').eq('space_id', spaceId).in('status', ['in_progress', 'blocked', 'review']).limit(3),
    supabase.from('activity_log').select('*').eq('space_id', spaceId).order('created_at', { ascending: false }).limit(6),
    supabase.from('proposals').select('*').eq('space_id', spaceId).eq('status', 'open').order('voting_closes_at', { ascending: true, nullsFirst: false }).limit(10),
    supabase.from('proposal_votes').select('proposal_id').eq('member_id', memberId),
    isAdminOrBoard
      ? supabase.from('incidents').select('*').eq('space_id', spaceId).in('status', ['received', 'under_review']).order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] as unknown[] }),
    isAdminOrBoard
      ? supabase.from('space_members').select('*', { count: 'exact', head: true }).eq('space_id', spaceId).eq('status', 'unverified')
      : Promise.resolve({ count: 0 }),
  ])

  const votedProposalIds = new Set(
    ((myVotesRaw ?? []) as Array<{ proposal_id: string }>).map(v => v.proposal_id),
  )
  type ProposalSummary = {
    id: string
    title: string
    voting_closes_at: string | null
    proposal_type: string
    quorum_required: number
    total_voters: number
    quorum_met: boolean | null
  }
  const pendingProposals = ((openProposalsRaw ?? []) as unknown as ProposalSummary[])
    .filter(p => !votedProposalIds.has(p.id))
    .slice(0, 5)
  const pendingIncidents = (pendingIncidentsRaw ?? []) as unknown as Array<{
    id: string
    title: string
    severity: string
    status: string
    sla_response_by: string | null
    created_at: string
  }>

  const overdueTasks = (tasks ?? []).filter((t) => t.due_date && new Date(t.due_date) < new Date())

  const stats = [
    { label: 'Active Members', value: activeMembers ?? 0, Ico: IcoUsers, sub: 'in your space', warn: false },
    { label: 'Dues Current', value: Math.max(0, (activeMembers ?? 0) - (unlinkedPayments ?? 0)), Ico: IcoDues, sub: `${unlinkedPayments ?? 0} unpaid / unverified`, warn: (unlinkedPayments ?? 0) > 0 },
    { label: 'Open Tasks', value: openTasks ?? 0, Ico: IcoTask, sub: `${overdueTasks.length} overdue`, warn: (openTasks ?? 0) > 0 },
    { label: 'Unlinked Payments', value: unlinkedPayments ?? 0, Ico: IcoPay, sub: 'needs reconciliation', warn: (unlinkedPayments ?? 0) > 0 },
  ]

  // First-run: an admin/board member alone in a space with nothing set up yet
  // gets a guided checklist instead of a grid of zeros.
  const isFirstRun =
    isAdminOrBoard &&
    (activeMembers ?? 0) <= 1 &&
    (openTasks ?? 0) === 0 &&
    (unlinkedPayments ?? 0) === 0 &&
    (projects ?? []).length === 0 &&
    (activity ?? []).length === 0 &&
    pendingProposals.length === 0 &&
    pendingIncidents.length === 0

  if (isFirstRun) {
    const steps = [
      { href: '/members', Ico: IcoUsers, title: 'Invite or add members', desc: 'Add people directly, or generate a shareable join link right there.' },
      { href: '/customize', Ico: IcoPlus, title: 'Set up onboarding', desc: 'Decide what new members see and agree to when they join.' },
      { href: '/tasks', Ico: IcoTask, title: 'Create your first task or chore', desc: 'Capture the recurring upkeep your space depends on.' },
      { href: '/settings', Ico: IcoPay, title: 'Connect payments', desc: 'Link a payment platform to track dues and reconcile income.' },
    ]
    const firstName = member.display_name?.split(' ')[0] || 'there'
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
          <PageTitle>Dashboard</PageTitle>
        </div>
        <div className="p-4 md:p-6">
          <Empty className="bg-card border border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><IcoPlus /></EmptyMedia>
              <EmptyTitle>Welcome, {firstName}. Let&apos;s set up your space.</EmptyTitle>
              <EmptyDescription>
                Your space is empty. These first steps get it running. This panel goes away once there is activity.
              </EmptyDescription>
            </EmptyHeader>
            <div className="grid sm:grid-cols-2 gap-3 w-full max-w-2xl mt-2">
              {steps.map(({ href, Ico, title, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-start gap-3 text-left bg-background border border-border rounded-lg p-4 hover:border-primary transition"
                >
                  <span className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <Ico className="w-4 h-4 text-primary" />
                  </span>
                  <span>
                    <span className="block font-sans text-sm font-medium text-foreground">{title}</span>
                    <span className="block font-sans text-xs text-muted-foreground mt-0.5">{desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </Empty>
        </div>
      </div>
    )
  }

  const [selfEntryRes, presentRes] = await Promise.all([listSelfEntryDoors(), listPresentNow()])
  const selfEntryDoors = ('data' in selfEntryRes ? selfEntryRes.data : []) as { id: string; name: string }[]
  const present = ('data' in presentRes ? presentRes.data : []) as {
    id: string; name: string; isHost: boolean; isMe: boolean; checkedInAt: string; note: string | null
  }[]

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <PageTitle>Dashboard</PageTitle>
        <Link href="/tasks" className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 min-h-[44px] rounded hover:bg-primary/90 transition">
          <IcoPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Quick Task</span>
          <span className="sm:hidden">Task</span>
        </Link>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {isAdminOrBoard && ((unverifiedMembers ?? 0) > 0 || (unlinkedPayments ?? 0) > 0) && (
          <div className="rounded-lg border border-orange-300 bg-orange-50 p-4">
            <p className="font-mono text-[10px] tracking-widest text-orange-700 uppercase mb-2">Needs your attention</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              {(unverifiedMembers ?? 0) > 0 && (
                <Link href="/members" className="font-sans text-sm text-orange-800 hover:underline">
                  {unverifiedMembers} member{unverifiedMembers === 1 ? '' : 's'} awaiting approval →
                </Link>
              )}
              {(unlinkedPayments ?? 0) > 0 && (
                <Link href="/payments" className="font-sans text-sm text-orange-800 hover:underline">
                  {unlinkedPayments} unreconciled payment{unlinkedPayments === 1 ? '' : 's'} →
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stats.map(({ label, value, Ico, sub, warn }) => (
            <div key={label} className="bg-card rounded border border-border p-4 md:p-5">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                <Ico className="w-3 h-3" /> {label}
              </p>
              <p className={`text-3xl font-sans font-bold ${warn ? 'text-orange-500' : 'text-primary'}`}>{value}</p>
              <p className="font-sans text-xs text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {(pendingProposals.length > 0 || pendingIncidents.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4">
            {pendingProposals.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Open proposals awaiting your vote</p>
                  <Link href="/proposals" className="font-sans text-xs text-primary hover:underline">All</Link>
                </div>
                <div className="bg-card rounded border border-border divide-y divide-border">
                  {pendingProposals.map(p => {
                    const totalCounted = p.total_voters
                    const quorumPct = p.quorum_required > 0
                      ? Math.min(100, Math.round((totalCounted / p.quorum_required) * 100))
                      : 0
                    return (
                      <Link key={p.id} href={`/proposals/${p.id}`} className="block px-4 py-3 hover:bg-muted transition">
                        <p className="font-sans text-sm text-foreground truncate">{p.title}</p>
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                          {p.proposal_type.replace(/_/g, ' ')}
                          {p.voting_closes_at ? ` · closes ${new Date(p.voting_closes_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                          {' · '}
                          <span className={p.quorum_met ? 'text-primary' : 'text-orange-600'}>
                            quorum {quorumPct}%
                          </span>
                        </p>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {isAdminOrBoard && pendingIncidents.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Incidents needing response</p>
                  <Link href="/incidents" className="font-sans text-xs text-primary hover:underline">All</Link>
                </div>
                <div className="bg-card rounded border border-border divide-y divide-border">
                  {pendingIncidents.map(i => {
                    const overdueSla = i.sla_response_by && new Date(i.sla_response_by) < new Date()
                    return (
                      <Link key={i.id} href={`/incidents/${i.id}`} className="block px-4 py-3 hover:bg-muted transition">
                        <p className="font-sans text-sm text-foreground truncate">{i.title}</p>
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                          {i.severity} · {i.status.replace(/_/g, ' ')}
                          {i.sla_response_by && (
                            <>
                              {' · '}
                              <span className={overdueSla ? 'text-red-600' : 'text-muted-foreground'}>
                                respond by {new Date(i.sla_response_by).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </>
                          )}
                        </p>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Quick Chores</p>
                <Link href="/tasks" className="font-sans text-xs text-primary hover:underline">All tasks</Link>
              </div>
              <div className="bg-card rounded border border-border divide-y divide-border">
                {(tasks ?? []).length > 0 ? (tasks ?? []).map((task) => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date()
                  const isDueToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString()
                  return (
                    <div key={task.id} className={`flex items-center gap-3 px-4 py-3 ${isOverdue ? 'border-l-2 border-red-400' : ''}`}>
                      <div className="w-4 h-4 rounded border-2 border-border flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-sm text-foreground truncate">{task.title}</p>
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                          {[task.area, task.recurrence && task.recurrence !== 'none' ? `${task.recurrence}` : null, task.due_date ? `due ${new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {isOverdue ? (
                        <span className="font-mono text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded">OVERDUE</span>
                      ) : isDueToday ? (
                        <span className="font-mono text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded">TODAY</span>
                      ) : (
                        <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">OPEN</span>
                      )}
                      <Link href="/tasks" className="flex items-center font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition">
                        CLAIM
                      </Link>
                    </div>
                  )
                }) : (
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><IcoTask /></EmptyMedia>
                      <EmptyTitle>No open tasks</EmptyTitle>
                      <EmptyDescription>Nothing needs doing right now. New chores will show up here.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Active Projects</p>
                <Link href="/projects" className="font-sans text-xs text-primary hover:underline">All projects</Link>
              </div>
              <div className="bg-card rounded border border-border divide-y divide-border">
                {(projects ?? []).length > 0 ? (projects ?? []).map((project) => (
                  <div key={project.id} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-sans text-sm font-medium text-foreground">{project.title}</p>
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${
                        project.status === 'in_progress' ? 'text-primary bg-primary/10' :
                        project.status === 'blocked' ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50'
                      }`}>
                        {project.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    {project.description && <p className="font-mono text-[10px] text-muted-foreground mb-2 truncate">{project.description}</p>}
                    <div className="h-1 bg-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${project.status === 'blocked' ? 'bg-orange-400' : 'bg-primary'}`} style={{ width: `${project.progress ?? 0}%` }} />
                    </div>
                  </div>
                )) : (
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><IcoDues /></EmptyMedia>
                      <EmptyTitle>No active projects</EmptyTitle>
                      <EmptyDescription>Projects in progress, blocked, or in review appear here.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <PresencePanel present={present} />

            {selfEntryDoors.length > 0 && (
              <div>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
                  <IcoDoor className="w-3 h-3" /> Door access
                </p>
                <DoorSelfEntry doors={selfEntryDoors} />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Payment Alerts</p>
                <Link href="/payments" className="font-sans text-xs text-primary hover:underline">Reconcile</Link>
              </div>
              <div className="bg-card rounded border border-border px-4 py-6 text-center">
                <p className="font-sans text-xs text-muted-foreground">
                  <Link href="/settings" className="text-primary hover:underline">Connect a payment platform</Link>
                  {' '}to see alerts here.
                </p>
              </div>
            </div>

            <div>
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Recent Activity</p>
              <div className="space-y-3">
                {(activity ?? []).length > 0 ? (activity ?? []).map((item) => (
                  <div key={item.id} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 bg-primary" />
                    <div>
                      <p className="font-sans text-xs text-foreground">
                        <span className="font-medium">{item.display_name || 'System'}</span>{' '}{item.action}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                )) : (
                  <Empty className="border-0 p-0 md:p-0 gap-3">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><IcoUsers /></EmptyMedia>
                      <EmptyTitle>No recent activity yet</EmptyTitle>
                      <EmptyDescription>Actions taken in your space will be listed here.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
