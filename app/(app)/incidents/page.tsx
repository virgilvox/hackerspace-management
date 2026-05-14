import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Incident, IncidentStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<IncidentStatus, string> = {
  received: 'text-orange-600 bg-orange-50',
  under_review: 'text-blue-600 bg-blue-50',
  decided: 'text-primary bg-primary/10',
  appealed: 'text-purple-600 bg-purple-50',
  closed: 'text-muted-foreground bg-muted',
}

export default async function IncidentsPage() {
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

  const isAdminOrBoard = member.role === 'admin' || member.role === 'board'

  // RLS filters to admin/board view or reporter view automatically.
  const { data: incidents } = await supabase
    .from('incidents')
    .select('*')
    .eq('space_id', member.space_id)
    .order('created_at', { ascending: false })

  const list = (incidents ?? []) as unknown as Incident[]

  const open = list.filter(i => ['received', 'under_review'].includes(i.status))
  const decided = list.filter(i => ['decided', 'appealed'].includes(i.status))
  const closed = list.filter(i => i.status === 'closed')

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <h1 className="text-white font-sans text-lg font-semibold">Incidents</h1>
        <Link
          href="/incidents/new"
          className="bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
        >
          File a report
        </Link>
      </div>

      <div className="p-4 md:p-6 space-y-8 max-w-4xl">
        {!isAdminOrBoard && (
          <p className="font-sans text-sm text-muted-foreground">
            You see incidents you have reported here. Admins and board members see all incidents in their space.
          </p>
        )}

        <Section title="Open" empty="No open incidents." rows={open} />
        <Section title="Decided / under appeal" empty="None." rows={decided} />
        <Section title="Closed" empty="None." rows={closed} />
      </div>
    </div>
  )
}

function Section({ title, empty, rows }: { title: string; empty: string; rows: Incident[] }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">{title}</p>
      <div className="bg-card rounded border border-border divide-y divide-border">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground font-sans text-sm">{empty}</div>
        ) : (
          rows.map(i => (
            <Link key={i.id} href={`/incidents/${i.id}`} className="block px-4 py-3 hover:bg-muted transition">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-sans text-sm font-medium text-foreground truncate">{i.title}</p>
                    <span className={`font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded ${STATUS_STYLE[i.status]}`}>
                      {i.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {i.category} · {i.severity}
                    {i.is_anonymous ? ' · anonymous' : ''}
                    {' · '}
                    filed {new Date(i.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                {i.sla_response_by && i.status === 'received' && (
                  <span className="font-mono text-[10px] text-orange-600 flex-shrink-0">
                    response by {new Date(i.sla_response_by).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
