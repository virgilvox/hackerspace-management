import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { CalendarCheck } from 'lucide-react'
import { listAttendance } from '@/lib/actions'

export const dynamic = 'force-dynamic'

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

const STATUS: Record<Row['status'], { label: string; cls: string }> = {
  present: { label: 'Here now', cls: 'text-primary' },
  checked_out: { label: 'Checked out', cls: 'text-muted-foreground' },
  stale: { label: 'No checkout', cls: 'text-amber-600' },
}

function dur(inAt: string, outAt: string | null): string {
  const end = outAt ? new Date(outAt).getTime() : Date.now()
  const mins = Math.max(0, Math.round((end - new Date(inAt).getTime()) / 60000))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  return `${h}h ${mins % 60}m`
}

export default async function AttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const res = await listAttendance()
  const rows = ('data' in res ? res.data : []) as Row[]

  return (
    <>
      <PageHeader>
        <PageTitle>Attendance</PageTitle>
      </PageHeader>

      <div className="p-4 md:p-6">
        {rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarCheck /></EmptyMedia>
              <EmptyTitle>No visits recorded yet</EmptyTitle>
              <EmptyDescription>
                When members check in from the dashboard, their visits appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
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
                  <div className="font-mono text-[10px] text-muted-foreground/80 text-right">
                    {new Date(r.checkedInAt).toLocaleString()}
                    <br />
                    {r.checkedOutAt
                      ? `${dur(r.checkedInAt, r.checkedOutAt)} visit`
                      : r.status === 'present' ? `${dur(r.checkedInAt, null)} so far` : 'open'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
