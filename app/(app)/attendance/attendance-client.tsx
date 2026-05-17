'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { CalendarCheck } from 'lucide-react'
import { checkIn, checkOut } from '@/lib/actions'
import { dayKey, visitDurationMinutes } from '@/lib/presence-logic'

type Present = { id: string; name: string; isHost: boolean; isMe: boolean; checkedInAt: string; note: string | null }
type Row = {
  id: string
  name: string
  isHost: boolean
  status: 'present' | 'checked_out' | 'stale'
  checkedInAt: string
  checkedOutAt: string | null
  checkInNote: string | null
  checkOutNote: string | null
}

const input =
  'w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary'

const STATUS: Record<Row['status'], { label: string; cls: string }> = {
  present: { label: 'Here now', cls: 'text-primary' },
  checked_out: { label: 'Checked out', cls: 'text-muted-foreground' },
  stale: { label: 'No checkout', cls: 'text-amber-600' },
}

function fmtDur(mins: number): string {
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function fmtDayHeading(key: string) {
  const d = new Date(key + 'T00:00:00Z')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function AttendanceClient({ present, history }: { present: Present[]; history: Row[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [query, setQuery] = useState('')
  const [day, setDay] = useState('') // '' = all days

  const me = present.find(p => p.isMe)
  const amHere = !!me
  const hosts = present.filter(p => p.isHost).length

  async function act(fn: () => Promise<{ error?: string } | { data: unknown }>, ok: string) {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    setNote('')
    toast.success(ok)
    router.refresh()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return history.filter(r => {
      if (q && !r.name.toLowerCase().includes(q)) return false
      if (day && dayKey(r.checkedInAt) !== day) return false
      return true
    })
  }, [history, query, day])

  const groups = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of filtered) {
      const k = dayKey(r.checkedInAt) || 'unknown'
      ;(m.get(k) ?? m.set(k, []).get(k)!).push(r)
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const uniqueMembers = useMemo(() => new Set(filtered.map(r => r.name)).size, [filtered])

  return (
    <>
      <PageHeader>
        <PageTitle>Attendance</PageTitle>
      </PageHeader>

      <div className="p-4 md:p-6 space-y-6 max-w-3xl">
        {/* Here now + self check-in/out */}
        <section>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Here now ({present.length}{hosts > 0 ? ` · ${hosts} hosting` : ''})
          </p>
          <div className="bg-card rounded border border-border">
            {present.length === 0 ? (
              <p className="px-4 py-4 font-sans text-xs text-muted-foreground text-center">Nobody is checked in right now.</p>
            ) : (
              <ul className="divide-y divide-border">
                {present.map(p => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="font-sans text-sm text-foreground truncate">
                      {p.name}{p.isMe ? ' (you)' : ''}
                      {p.note && <span className="font-mono text-[10px] text-muted-foreground ml-2">{p.note}</span>}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {p.isHost && <Badge variant="default">Host</Badge>}
                      <span className="font-mono text-[10px] text-muted-foreground/70">since {fmtTime(p.checkedInAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-border p-3 space-y-2">
              <input
                className={input}
                placeholder={amHere ? 'Check-out note (optional)' : 'Check-in note (optional)'}
                maxLength={500}
                value={note}
                onChange={e => setNote(e.target.value)}
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {amHere ? (
                  <Button size="sm" disabled={busy} onClick={() => act(() => checkOut({ note: note.trim() || null }), 'Checked out')}>
                    Check out{me?.isHost ? ' (hosting)' : ''}
                  </Button>
                ) : (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => act(() => checkIn({ asHost: false, note: note.trim() || null }), 'Checked in')}>
                      Check in
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => checkIn({ asHost: true, note: note.trim() || null }), 'Checked in as host')}>
                      Check in as host
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* History with search + day filter */}
        <section>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              History · {filtered.length} visit{filtered.length === 1 ? '' : 's'} · {uniqueMembers} member{uniqueMembers === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                className={`${input} w-auto`}
                placeholder="Search name…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <input
                type="date"
                className={`${input} w-auto`}
                value={day}
                onChange={e => setDay(e.target.value)}
              />
              {(query || day) && (
                <Button size="sm" variant="outline" onClick={() => { setQuery(''); setDay('') }}>Clear</Button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarCheck /></EmptyMedia>
                <EmptyTitle>{history.length === 0 ? 'No visits recorded yet' : 'No visits match'}</EmptyTitle>
                <EmptyDescription>
                  {history.length === 0
                    ? 'When members check in, their visits appear here.'
                    : 'Try a different name or day, or clear the filters.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-4">
              {groups.map(([key, rows]) => (
                <div key={key}>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                    {key === 'unknown' ? 'Unknown date' : fmtDayHeading(key)} · {rows.length}
                  </p>
                  <div className="bg-card rounded border border-border divide-y divide-border">
                    {rows.map(r => {
                      const s = STATUS[r.status]
                      return (
                        <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-sans text-sm font-medium text-foreground">{r.name}</span>
                              {r.isHost && <Badge variant="default">Host</Badge>}
                              <span className={`font-mono text-[10px] ${s.cls}`}>{s.label}</span>
                            </div>
                            {(r.checkInNote || r.checkOutNote) && (
                              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                                {r.checkInNote ? `in: ${r.checkInNote}` : ''}
                                {r.checkInNote && r.checkOutNote ? ' · ' : ''}
                                {r.checkOutNote ? `out: ${r.checkOutNote}` : ''}
                              </p>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground/80 text-right shrink-0">
                            {fmtTime(r.checkedInAt)}{r.checkedOutAt ? `–${fmtTime(r.checkedOutAt)}` : ''}
                            <br />
                            {fmtDur(visitDurationMinutes(r.checkedInAt, r.checkedOutAt))}
                            {!r.checkedOutAt && r.status === 'present' ? ' so far' : r.checkedOutAt ? ' visit' : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
