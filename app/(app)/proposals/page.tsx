import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Proposal } from '@/lib/types'
import { ProposalStatusBadge } from './proposal-badges'
import { PageTitle } from '@/components/ui/page-title'

export const dynamic = 'force-dynamic'

export default async function ProposalsPage() {
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

  const { data: proposals } = await supabase
    .from('proposals')
    .select('*')
    .eq('space_id', member.space_id)
    .order('created_at', { ascending: false })

  const list = (proposals ?? []) as unknown as Proposal[]

  const open = list.filter(p => p.status === 'open')
  const drafts = list.filter(p => p.status === 'draft')
  const decided = list.filter(p => ['decided', 'withdrawn', 'expired'].includes(p.status))

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <PageTitle>Proposals</PageTitle>
        <Link
          href="/proposals/new"
          className="bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
        >
          New proposal
        </Link>
      </div>

      <div className="p-4 md:p-6 space-y-8 max-w-4xl">
        <Section title="Open for voting" empty="No proposals are currently open." proposals={open} />
        <Section title="Drafts" empty="No drafts." proposals={drafts} />
        <Section title="Archive" empty="No decided or withdrawn proposals." proposals={decided} />
      </div>
    </div>
  )
}

function Section({ title, empty, proposals }: { title: string; empty: string; proposals: Proposal[] }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">{title}</p>
      <div className="bg-card rounded border border-border divide-y divide-border">
        {proposals.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground font-sans text-sm">{empty}</div>
        ) : (
          proposals.map(p => <ProposalRow key={p.id} p={p} />)
        )}
      </div>
    </div>
  )
}

function ProposalRow({ p }: { p: Proposal }) {
  const totalVotes = p.outcome_yes + p.outcome_no + p.outcome_abstain
  return (
    <Link href={`/proposals/${p.id}`} className="block px-4 py-3 hover:bg-muted transition">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-sans text-sm font-medium text-foreground truncate">{p.title}</p>
            <ProposalStatusBadge status={p.status} />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            {p.proposal_type.replace(/_/g, ' ')}
            {p.proposer_name ? ` · proposed by ${p.proposer_name}` : ''}
            {p.voting_closes_at && p.status === 'open'
              ? ` · closes ${new Date(p.voting_closes_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
            {p.outcome_yes} y · {p.outcome_no} n · {p.outcome_abstain} a
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
            {totalVotes}/{p.quorum_required} for quorum
          </p>
        </div>
      </div>
    </Link>
  )
}
