import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Proposal, ProposalVote } from '@/lib/types'
import { ProposalStatusBadge } from '../proposal-badges'
import { ProposalActions } from './proposal-actions'
import { MarkdownBody } from '@/components/markdown'

export const dynamic = 'force-dynamic'

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('id, space_id, role, display_name')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .maybeSingle()
  if (!member?.space_id) redirect('/signup')

  const { data: proposalRaw } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!proposalRaw) notFound()

  const proposal = proposalRaw as unknown as Proposal

  const { data: votesRaw } = await supabase
    .from('proposal_votes')
    .select('*')
    .eq('proposal_id', proposal.id)
    .order('voted_at', { ascending: false })

  const votes = (votesRaw ?? []) as unknown as ProposalVote[]

  // Resolve voter display names from space_members.
  const voterIds = Array.from(new Set(votes.map(v => v.member_id)))
  const { data: voters } = voterIds.length
    ? await supabase
        .from('space_members')
        .select('id, display_name')
        .in('id', voterIds)
    : { data: [] as Array<{ id: string; display_name: string | null }> }

  const voterNames = new Map((voters ?? []).map(m => [m.id, m.display_name]))

  const myVote = votes.find(v => v.member_id === (member as { id: string }).id) ?? null
  const isAdminOrBoard = member.role === 'admin' || member.role === 'board'
  const votingOpen =
    proposal.status === 'open' &&
    proposal.voting_opens_at !== null &&
    proposal.voting_closes_at !== null &&
    new Date(proposal.voting_opens_at) <= new Date() &&
    new Date(proposal.voting_closes_at) > new Date()

  const totalCounted = proposal.outcome_yes + proposal.outcome_no + proposal.outcome_abstain
  const quorumPct = proposal.quorum_required > 0
    ? Math.min(100, Math.round((totalCounted / proposal.quorum_required) * 100))
    : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center gap-3">
        <Link href="/proposals" className="text-white/70 hover:text-white font-sans text-sm">
          ← Proposals
        </Link>
      </div>

      <div className="p-4 md:p-6 max-w-4xl space-y-6">
        <header className="bg-card rounded border border-border p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="font-sans text-xl font-semibold text-foreground flex-1">{proposal.title}</h1>
            <ProposalStatusBadge status={proposal.status} />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            {proposal.proposal_type.replace(/_/g, ' ')}
            {proposal.proposer_name ? ` · proposed by ${proposal.proposer_name}` : ''}
            {' · '}
            {proposal.threshold.replace(/_/g, ' ')} required
          </p>
          {proposal.body && <MarkdownBody className="mt-4" content={proposal.body} />}
        </header>

        <section className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Tally
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Tally label="Yes" value={proposal.outcome_yes} accent="text-primary" />
            <Tally label="No" value={proposal.outcome_no} accent="text-orange-600" />
            <Tally label="Abstain" value={proposal.outcome_abstain} accent="text-muted-foreground" />
            <Tally label="Recused" value={proposal.outcome_recused} accent="text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Quorum
              </span>
              <span className="font-sans text-xs">
                {totalCounted} of {proposal.quorum_required}
                {' · '}
                <span className={proposal.quorum_met ? 'text-primary' : 'text-orange-600'}>
                  {proposal.quorum_met ? 'met' : 'not met'}
                </span>
              </span>
            </div>
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${proposal.quorum_met ? 'bg-primary' : 'bg-orange-400'}`} style={{ width: `${quorumPct}%` }} />
            </div>
            {proposal.status === 'decided' && (
              <p className="font-mono text-[10px] text-muted-foreground pt-1">
                Outcome: <span className={proposal.passed ? 'text-primary' : 'text-orange-600'}>{proposal.passed ? 'PASSED' : 'DID NOT PASS'}</span>
                {proposal.decided_at ? ` · ${new Date(proposal.decided_at).toLocaleString()}` : ''}
              </p>
            )}
          </div>
        </section>

        <ProposalActions
          proposalId={proposal.id}
          status={proposal.status}
          isAdminOrBoard={isAdminOrBoard}
          isProposer={proposal.proposer_id === member.id}
          votingOpen={votingOpen}
          myVote={myVote}
        />

        <section className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Votes ({votes.length})
          </p>
          {votes.length === 0 ? (
            <p className="font-sans text-sm text-muted-foreground">No votes cast yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {votes.map(v => (
                <li key={v.id} className="py-2 flex items-start gap-3">
                  <span className="font-mono text-[10px] tracking-widest uppercase w-16 flex-shrink-0 mt-1">
                    {v.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm text-foreground">{voterNames.get(v.member_id) ?? 'Unknown member'}</p>
                    {v.comment && <p className="font-sans text-xs text-muted-foreground mt-0.5">{v.comment}</p>}
                    {v.recusal_reason && (
                      <p className="font-sans text-xs text-muted-foreground italic mt-0.5">Recused: {v.recusal_reason}</p>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground/60 flex-shrink-0 mt-1">
                    {new Date(v.voted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Tally({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-1">{label}</p>
      <p className={`font-sans text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  )
}
