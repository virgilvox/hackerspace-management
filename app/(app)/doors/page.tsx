import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { DoorClosed } from 'lucide-react'
import { listSelfEntryDoors, getMyCards, listMyDoorActivity, listInvokableButtons } from '@/lib/actions'
import { DoorSelfEntry } from '../dashboard/door-self-entry'
import { ApiButtonsInvoke } from './api-buttons-invoke'

export const dynamic = 'force-dynamic'

type Card = { id: string; card_type: string; label: string | null; is_active: boolean; last4: string }
type Activity = { id: string; action: string; success: boolean; detail: string | null; occurred_at: string }

const ACTION_LABEL: Record<string, string> = {
  self_entry: 'Self-entry',
  grant: 'Card granted',
  revoke: 'Card revoked',
  open: 'Open',
  unlock: 'Unlock',
  lock: 'Lock',
  test: 'Connection test',
}

export default async function DoorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [doorsRes, cardsRes, activityRes, buttonsRes] = await Promise.all([
    listSelfEntryDoors(),
    getMyCards(),
    listMyDoorActivity(),
    listInvokableButtons(),
  ])
  const doors = ('data' in doorsRes ? doorsRes.data : []) as { id: string; name: string }[]
  const cards = ('data' in cardsRes ? cardsRes.data : []) as Card[]
  const activity = ('data' in activityRes ? activityRes.data : []) as Activity[]
  const buttons = ('data' in buttonsRes ? buttonsRes.data : []) as { id: string; label: string; group: string; confirm: boolean }[]

  const nothing = doors.length === 0 && cards.length === 0 && activity.length === 0 && buttons.length === 0

  return (
    <>
      <PageHeader>
        <PageTitle>Doors</PageTitle>
      </PageHeader>

      <div className="p-4 md:p-6 space-y-8 max-w-3xl">
        {nothing && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><DoorClosed /></EmptyMedia>
              <EmptyTitle>No door access yet</EmptyTitle>
              <EmptyDescription>
                When a door manager adds you an access card or enables member self-entry on a
                door, it will show up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {doors.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Open a door</h2>
            <DoorSelfEntry doors={doors} />
            <p className="font-mono text-[10px] text-muted-foreground mt-2">
              Only use this when you are physically at the door and authorized to enter. Every
              attempt is logged.
            </p>
          </section>
        )}

        {buttons.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Actions</h2>
            <ApiButtonsInvoke buttons={buttons} />
            <p className="font-mono text-[10px] text-muted-foreground mt-2">
              Each action fires a configured request. Every press is logged.
            </p>
          </section>
        )}

        {cards.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">My access cards</h2>
            <div className="bg-card rounded border border-border divide-y divide-border">
              {cards.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-sans text-sm text-foreground">
                    {c.label || `${c.card_type.toUpperCase()} card`}
                    <span className="font-mono text-[10px] text-muted-foreground ml-2">••••{c.last4}</span>
                  </span>
                  <Badge variant={c.is_active ? 'default' : 'outline'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              ))}
            </div>
            <p className="font-mono text-[10px] text-muted-foreground mt-2">
              Only the last 4 characters are shown. The full card ID is a credential and is never displayed.
            </p>
          </section>
        )}

        {activity.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">My recent door activity</h2>
            <ul className="divide-y rounded border border-border">
              {activity.map(a => (
                <li key={a.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    <span className={a.success ? 'text-primary' : 'text-red-500'}>{a.success ? 'ok' : 'fail'}</span>
                    {' · '}{ACTION_LABEL[a.action] ?? a.action}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/70">{new Date(a.occurred_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}
