import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Incident, IncidentUpdateRow } from '@/lib/types'
import { IncidentActions } from './incident-actions'
import { MarkdownBody } from '@/components/markdown'
import { CommentThread } from '@/components/comments/comment-thread'
import { loadComments } from '@/components/comments/load-comments'

export const dynamic = 'force-dynamic'

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: incidentRaw } = await supabase
    .from('incidents')
    .select('*')
    .eq('id', id)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!incidentRaw) notFound()

  const incident = incidentRaw as unknown as Incident
  const isAdminOrBoard = member.role === 'admin' || member.role === 'board'
  const isReporter = incident.reporter_id === member.id

  const comments = await loadComments(supabase, 'incident', incident.id)

  const { data: updatesRaw } = await supabase
    .from('incident_updates')
    .select('*')
    .eq('incident_id', incident.id)
    .order('created_at', { ascending: true })

  const updates = (updatesRaw ?? []) as unknown as IncidentUpdateRow[]

  const decisionMakers = incident.decision_maker_ids.length
    ? await supabase
        .from('space_members')
        .select('id, display_name')
        .in('id', incident.decision_maker_ids)
    : { data: [] as Array<{ id: string; display_name: string | null }> }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center gap-3">
        <Link href="/incidents" className="text-white/70 hover:text-white font-sans text-sm">
          ← Incidents
        </Link>
      </div>

      <div className="p-4 md:p-6 max-w-3xl space-y-6">
        <header className="bg-card rounded border border-border p-5">
          <h1 className="font-sans text-xl font-semibold text-foreground mb-2">{incident.title}</h1>
          <p className="font-mono text-[10px] text-muted-foreground mb-4">
            {incident.category} · {incident.severity} · status: {incident.status.replace(/_/g, ' ')}
            {incident.is_anonymous ? ' · filed anonymously' : ''}
            {' · '}
            filed {new Date(incident.created_at).toLocaleString()}
          </p>
          <MarkdownBody content={incident.body} />
        </header>

        {incident.disposition && (
          <section className="bg-card rounded border border-border p-5">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
              Disposition
            </p>
            <MarkdownBody content={incident.disposition} />
            {decisionMakers.data && decisionMakers.data.length > 0 && (
              <p className="font-mono text-[10px] text-muted-foreground mt-3">
                Decision: {decisionMakers.data.map(m => m.display_name ?? 'Unknown').join(', ')}
                {incident.decided_at ? ` · ${new Date(incident.decided_at).toLocaleString()}` : ''}
              </p>
            )}
          </section>
        )}

        <section className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Updates ({updates.length})
          </p>
          {updates.length === 0 ? (
            <p className="font-sans text-sm text-muted-foreground">No updates posted yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {updates.map(u => (
                <li key={u.id} className="py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-sans text-sm font-medium text-foreground">{u.author_name ?? 'Unknown'}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {u.visibility.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/60 ml-auto">
                      {new Date(u.created_at).toLocaleString()}
                    </span>
                  </div>
                  <MarkdownBody content={u.body} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <IncidentActions
          incidentId={incident.id}
          status={incident.status}
          isAdminOrBoard={isAdminOrBoard}
          isReporter={isReporter}
          hasAppeal={incident.appeal_proposal_id !== null}
          appealProposalId={incident.appeal_proposal_id}
        />

        <CommentThread
          entityType="incident"
          entityId={incident.id}
          comments={comments}
          currentMemberId={member.id}
          canModerate={isAdminOrBoard}
        />
      </div>
    </div>
  )
}
