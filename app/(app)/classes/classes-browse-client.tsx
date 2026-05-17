'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarDays } from 'lucide-react'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { signUpForClass, cancelMySignup } from '@/lib/actions'
import { effectiveCapacity, SIGNUP_STATUS_LABEL } from '@/lib/classes-logic'
import { SessionAttendance } from '@/components/classes/session-attendance'
import { useRouter } from 'next/navigation'

type Row = {
  id: string
  starts_at: string
  ends_at: string | null
  location: string | null
  capacity: number | null
  status: string
  notes: string | null
  classes: { title: string; description: string | null; payment_link: string | null; capacity: number | null } | Array<{ title: string; description: string | null; payment_link: string | null; capacity: number | null }> | null
  registered_count: number
  my_status: string | null
  required_form: { title: string; url: string | null; satisfied: boolean } | null
}

function classOf(r: Row) {
  return Array.isArray(r.classes) ? r.classes[0] : r.classes
}

export function ClassesBrowseClient({
  sessions,
  canRunSessions,
}: {
  sessions: unknown[]
  canRunSessions: boolean
}) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(sessions as Row[])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openAttendance, setOpenAttendance] = useState<string | null>(null)

  async function onSignUp(r: Row) {
    setBusyId(r.id)
    const res = await signUpForClass({ sessionId: r.id })
    setBusyId(null)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    const status = (res as { data: { status: string } }).data.status
    toast.success(status === 'waitlisted' ? 'Added to the waitlist' : 'You are signed up')
    setRows(prev =>
      prev.map(x =>
        x.id === r.id ? { ...x, my_status: status, registered_count: x.registered_count + (status === 'registered' ? 1 : 0) } : x,
      ),
    )
  }

  async function onCancel(r: Row) {
    setBusyId(r.id)
    const res = await cancelMySignup({ sessionId: r.id })
    setBusyId(null)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Signup cancelled')
    setRows(prev =>
      prev.map(x =>
        x.id === r.id
          ? { ...x, my_status: null, registered_count: Math.max(0, x.registered_count - (r.my_status === 'registered' ? 1 : 0)) }
          : x,
      ),
    )
  }

  return (
    <>
      <PageHeader>
        <PageTitle>Classes</PageTitle>
      </PageHeader>

      <div className="p-4 md:p-6">
        {rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
              <EmptyTitle>No upcoming classes</EmptyTitle>
              <EmptyDescription>Check back later, or ask an organizer to schedule a session.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-3">
            {rows.map(r => {
              const c = classOf(r)
              const cap = effectiveCapacity(r.capacity, c?.capacity ?? null)
              const spots = cap == null ? null : Math.max(0, cap - r.registered_count)
              const full = cap != null && r.registered_count >= cap
              const formBlocked = !r.my_status && !!r.required_form && !r.required_form.satisfied
              return (
                <li key={r.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans text-sm font-semibold text-foreground">{c?.title ?? 'Class'}</span>
                        {r.my_status && (
                          <Badge variant={r.my_status === 'registered' ? 'default' : 'outline'}>
                            {SIGNUP_STATUS_LABEL[r.my_status] ?? r.my_status}
                          </Badge>
                        )}
                      </div>
                      {c?.description && <p className="font-sans text-sm text-muted-foreground mt-1">{c.description}</p>}
                      <p className="font-mono text-[10px] text-muted-foreground mt-1">
                        {new Date(r.starts_at).toLocaleString()}
                        {r.ends_at ? ` – ${new Date(r.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        {r.location ? ` · ${r.location}` : ''}
                        {cap == null ? ' · open' : ` · ${spots} of ${cap} spots left`}
                      </p>
                      {r.required_form && (
                        <p className={`font-mono text-[10px] mt-1 ${r.required_form.satisfied ? 'text-muted-foreground' : 'text-amber-600'}`}>
                          {r.required_form.satisfied
                            ? `Required form on file: ${r.required_form.title}`
                            : `Requires the "${r.required_form.title}" form before signup`}
                          {!r.required_form.satisfied && r.required_form.url && (
                            <>
                              {' · '}
                              <a href={r.required_form.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                complete it
                              </a>
                            </>
                          )}
                        </p>
                      )}
                      {r.notes && <p className="font-sans text-xs text-muted-foreground mt-1">{r.notes}</p>}
                      {c?.payment_link && (
                        <a href={c.payment_link} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[10px] text-primary underline">payment link</a>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {r.my_status ? (
                        <button
                          onClick={() => onCancel(r)}
                          disabled={busyId === r.id}
                          className="font-mono text-[10px] border border-border px-3 py-2 rounded hover:border-red-500 hover:text-red-500 transition disabled:opacity-60"
                        >
                          Cancel signup
                        </button>
                      ) : formBlocked ? (
                        r.required_form?.url ? (
                          <a
                            href={r.required_form.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[10px] border border-amber-500 text-amber-600 px-3 py-2 rounded hover:bg-amber-50 transition"
                          >
                            Complete required form
                          </a>
                        ) : (
                          <span className="font-mono text-[10px] text-amber-600 px-3 py-2">Form required</span>
                        )
                      ) : (
                        <button
                          onClick={() => onSignUp(r)}
                          disabled={busyId === r.id}
                          className="font-mono text-[10px] border border-border px-3 py-2 rounded hover:border-primary hover:text-primary transition disabled:opacity-60"
                        >
                          {full ? 'Join waitlist' : 'Sign up'}
                        </button>
                      )}
                      {canRunSessions && (
                        <button
                          onClick={() => setOpenAttendance(openAttendance === r.id ? null : r.id)}
                          className="font-mono text-[10px] text-muted-foreground hover:text-primary transition"
                        >
                          {openAttendance === r.id ? 'Hide attendees' : 'Attendees'}
                        </button>
                      )}
                    </div>
                  </div>
                  {canRunSessions && openAttendance === r.id && (
                    <SessionAttendance
                      sessionId={r.id}
                      sessionStatus={r.status}
                      onCompleted={() => { setOpenAttendance(null); router.refresh() }}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
