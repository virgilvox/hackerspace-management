'use client'

import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  certificationStatus,
  CERT_STATUS_LABEL,
  type CertStatus,
} from '@/lib/certifications-logic'
import { SIGNUP_STATUS_LABEL, SESSION_STATUS_LABEL } from '@/lib/classes-logic'
import { RESERVATION_STATUS_LABEL } from '@/lib/equipment-logic'
import { presenceStatus } from '@/lib/presence-logic'
import { DuesCard } from '@/components/billing/dues-card'

const STATUS_VARIANT: Record<CertStatus, 'default' | 'outline'> = {
  active: 'default',
  expiring_soon: 'outline',
  expired: 'outline',
  revoked: 'outline',
}

export type Grant = {
  id: string
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
  revoked_reason: string | null
  note: string | null
  certifications: { name: string; description: string | null; validity_months: number | null } | null
}
export type ClassSignup = {
  id: string
  status: string
  attended: boolean
  signed_up_at: string
  class_sessions:
    | { starts_at: string; ends_at: string | null; location: string | null; status: string; classes: { title: string } | { title: string }[] | null }
    | { starts_at: string; ends_at: string | null; location: string | null; status: string; classes: { title: string } | { title: string }[] | null }[]
    | null
}
export type Reservation = {
  id: string
  starts_at: string
  ends_at: string
  status: string
  notes: string | null
  equipment: { name: string; location: string | null } | { name: string; location: string | null }[] | null
}
export type MyCard = { id: string; card_type: string; label: string | null; is_active: boolean; last4: string }
export type MyVisit = { id: string; checked_in_at: string; checked_out_at: string | null; is_host: boolean; check_in_note: string | null; check_out_note: string | null }
export type MyNotif = { id: string; type: string; subject: string; status: string; createdAt: string; sentAt: string | null }
export type HeldPermission = { code: string; label: string }
export type Billing = { status: string | null; currentPeriodEnd: string | null; hasCustomer: boolean } | null

type Props = {
  grants: Grant[]
  held: HeldPermission[]
  billing: Billing
  notifs: MyNotif[]
  classSignups: ClassSignup[]
  reservations: Reservation[]
  myCards: MyCard[]
  myVisits: MyVisit[]
}

const sectionH = 'font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3'

export function MePortalClient({
  grants,
  held,
  billing,
  notifs,
  classSignups,
  reservations,
  myCards,
  myVisits,
}: Props) {
  const sessionOf = (cs: ClassSignup) =>
    Array.isArray(cs.class_sessions) ? cs.class_sessions[0] : cs.class_sessions
  const equipOf = (r: Reservation) => (Array.isArray(r.equipment) ? r.equipment[0] : r.equipment)
  const titleOf = (cs: ClassSignup) => {
    const sess = sessionOf(cs)
    const c = sess ? (Array.isArray(sess.classes) ? sess.classes[0] : sess.classes) : null
    return c?.title ?? 'Class'
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="membership">Membership</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-8">
          <section>
            <h2 className={sectionH}>My permissions</h2>
            {held.length === 0 ? (
              <p className="font-sans text-sm text-muted-foreground">
                You have the standard member access for this space. No extra permissions are granted to your role.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {held.map(p => (
                  <li
                    key={p.code}
                    className="font-mono text-[11px] border border-border rounded px-2 py-1 text-foreground"
                    title={p.code}
                  >
                    {p.label}
                  </li>
                ))}
              </ul>
            )}
            <p className="font-sans text-xs text-muted-foreground mt-3">
              Permissions are set per role by a space admin. This is a read-only view.
            </p>
          </section>
        </TabsContent>

        <TabsContent value="membership" className="space-y-8">
          <section>
            <h2 className={sectionH}>Dues</h2>
            <DuesCard billing={billing} />
          </section>

          <section>
            <h2 className={sectionH}>Certifications</h2>
            {grants.length === 0 ? (
              <p className="font-sans text-sm text-muted-foreground">
                You have no certifications yet. An instructor can award one to you.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {grants.map(g => {
                  const status = certificationStatus(g)
                  return (
                    <li key={g.id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans text-sm font-semibold text-foreground">
                            {g.certifications?.name ?? 'Certification'}
                          </span>
                          <Badge variant={STATUS_VARIANT[status]}>{CERT_STATUS_LABEL[status]}</Badge>
                        </div>
                        {g.certifications?.description && (
                          <p className="font-sans text-sm text-muted-foreground mt-1">
                            {g.certifications.description}
                          </p>
                        )}
                        <p className="font-mono text-[10px] text-muted-foreground mt-1">
                          granted {new Date(g.granted_at).toLocaleDateString()}
                          {g.expires_at
                            ? ` · expires ${new Date(g.expires_at).toLocaleDateString()}`
                            : ' · no expiry'}
                          {g.revoked_at ? ` · revoked ${new Date(g.revoked_at).toLocaleDateString()}` : ''}
                        </p>
                        {g.revoked_at && g.revoked_reason && (
                          <p className="font-sans text-xs text-muted-foreground mt-0.5">
                            Reason: {g.revoked_reason}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="activity" className="space-y-8">
          <section>
            <h2 className={sectionH}>Notifications</h2>
            {notifs.length === 0 ? (
              <p className="font-sans text-sm text-muted-foreground">
                No notifications yet. Dues receipts and payment alerts will show up here.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {notifs.map(n => (
                  <li key={n.id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <span className="font-sans text-sm text-foreground">{n.subject}</span>
                      <p className="font-mono text-[10px] text-muted-foreground mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                        {n.sentAt ? ` · sent ${new Date(n.sentAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <Badge variant={n.status === 'sent' ? 'default' : 'outline'}>
                      {n.status === 'sent' ? 'Sent' : n.status === 'failed' ? 'Failed' : 'Queued'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className={sectionH}>My classes</h2>
            {classSignups.length === 0 ? (
              <p className="font-sans text-sm text-muted-foreground">
                You have not signed up for any classes. Browse what&rsquo;s on at{' '}
                <a href="/classes" className="text-primary underline">Classes</a>.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {classSignups.map(cs => {
                  const sess = sessionOf(cs)
                  return (
                    <li key={cs.id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans text-sm font-semibold text-foreground">{titleOf(cs)}</span>
                          <Badge variant={cs.status === 'registered' ? 'default' : 'outline'}>
                            {SIGNUP_STATUS_LABEL[cs.status] ?? cs.status}
                          </Badge>
                          {cs.attended && <Badge variant="outline">Attended</Badge>}
                        </div>
                        {sess && (
                          <p className="font-mono text-[10px] text-muted-foreground mt-1">
                            {new Date(sess.starts_at).toLocaleString()}
                            {sess.location ? ` · ${sess.location}` : ''}
                            {' · '}
                            {SESSION_STATUS_LABEL[sess.status] ?? sess.status}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className={sectionH}>My equipment reservations</h2>
            {reservations.length === 0 ? (
              <p className="font-sans text-sm text-muted-foreground">
                You have no reservations. Browse what you can reserve at{' '}
                <a href="/equipment" className="text-primary underline">Equipment</a>.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {reservations.map(r => {
                  const eq = equipOf(r)
                  return (
                    <li key={r.id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans text-sm font-semibold text-foreground">{eq?.name ?? 'Equipment'}</span>
                          <Badge variant={r.status === 'reserved' ? 'default' : 'outline'}>
                            {RESERVATION_STATUS_LABEL[r.status] ?? r.status}
                          </Badge>
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground mt-1">
                          {new Date(r.starts_at).toLocaleString()} – {new Date(r.ends_at).toLocaleString()}
                          {eq?.location ? ` · ${eq.location}` : ''}
                        </p>
                        {r.notes && <p className="font-sans text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className={sectionH}>My access cards</h2>
            {myCards.length === 0 ? (
              <p className="font-sans text-sm text-muted-foreground">
                No access cards are registered to you. A door manager can add one.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {myCards.map(c => (
                  <li key={c.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-mono text-sm text-foreground">••••&nbsp;{c.last4}</span>
                      <span className="font-mono text-[10px] text-muted-foreground ml-2 uppercase">{c.card_type}</span>
                      {c.label && <span className="font-sans text-xs text-muted-foreground ml-2">{c.label}</span>}
                    </div>
                    <Badge variant={c.is_active ? 'default' : 'outline'}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="font-sans text-xs text-muted-foreground mt-3">
              Only the last 4 digits are shown. The full card number is never displayed here.
            </p>
          </section>

          <section>
            <h2 className={sectionH}>My recent visits</h2>
            {myVisits.length === 0 ? (
              <p className="font-sans text-sm text-muted-foreground">
                No visits yet. Check in from the dashboard when you are at the space.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {myVisits.map(v => {
                  const st = presenceStatus(v.checked_in_at, v.checked_out_at)
                  return (
                    <li key={v.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans text-sm text-foreground">
                            {new Date(v.checked_in_at).toLocaleString()}
                          </span>
                          {v.is_host && <Badge variant="default">Host</Badge>}
                          {st === 'present' && <span className="font-mono text-[10px] text-primary">here now</span>}
                          {st === 'stale' && <span className="font-mono text-[10px] text-amber-600">no checkout</span>}
                        </div>
                        {(v.check_in_note || v.check_out_note) && (
                          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                            {v.check_in_note ? `in: ${v.check_in_note}` : ''}
                            {v.check_in_note && v.check_out_note ? ' · ' : ''}
                            {v.check_out_note ? `out: ${v.check_out_note}` : ''}
                          </p>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground/80 shrink-0">
                        {v.checked_out_at ? `out ${new Date(v.checked_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'open'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
