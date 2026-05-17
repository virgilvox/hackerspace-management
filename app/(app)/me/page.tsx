import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Badge } from '@/components/ui/badge'
import {
  certificationStatus,
  CERT_STATUS_LABEL,
  type CertStatus,
} from '@/lib/certifications-logic'
import { PERMISSIONS, PERMISSION_CODES } from '@/lib/permissions-catalog'
import { getMyClassSignups, getMyReservations, getMyCards } from '@/lib/actions'
import { SIGNUP_STATUS_LABEL, SESSION_STATUS_LABEL } from '@/lib/classes-logic'
import { RESERVATION_STATUS_LABEL } from '@/lib/equipment-logic'

export const dynamic = 'force-dynamic'

type Grant = {
  id: string
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
  revoked_reason: string | null
  note: string | null
  certifications: { name: string; description: string | null; validity_months: number | null } | null
}

const STATUS_VARIANT: Record<CertStatus, 'default' | 'outline'> = {
  active: 'default',
  expiring_soon: 'outline',
  expired: 'outline',
  revoked: 'outline',
}

export default async function MePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('id, space_id, role, display_name')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .maybeSingle()
  if (!member) redirect('/signup')

  const { data: grantsRaw } = await supabase
    .from('member_certifications')
    .select(
      'id, granted_at, expires_at, revoked_at, revoked_reason, note, certifications(name, description, validity_months)',
    )
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .order('granted_at', { ascending: false })
  const grants = (grantsRaw ?? []) as unknown as Grant[]

  // Effective permissions (read-only view). admin implicitly holds everything.
  let heldCodes: string[] = []
  if (member.role === 'admin') {
    heldCodes = [...PERMISSION_CODES]
  } else {
    const { data: roles } = await supabase.rpc('user_effective_roles', {
      uid: user.id,
      sid: member.space_id,
    })
    const subjects = (roles ?? []) as string[]
    if (subjects.length > 0) {
      const { data: perms } = await supabase
        .from('space_role_permissions')
        .select('permission')
        .eq('space_id', member.space_id)
        .in('subject', subjects)
      heldCodes = Array.from(new Set((perms ?? []).map(p => p.permission as string)))
    }
  }
  const held = PERMISSIONS.filter(p => heldCodes.includes(p.code))

  const signupRes = await getMyClassSignups()
  type ClassSignup = {
    id: string
    status: string
    attended: boolean
    signed_up_at: string
    class_sessions:
      | { starts_at: string; ends_at: string | null; location: string | null; status: string; classes: { title: string } | { title: string }[] | null }
      | { starts_at: string; ends_at: string | null; location: string | null; status: string; classes: { title: string } | { title: string }[] | null }[]
      | null
  }
  const classSignups: ClassSignup[] = 'data' in signupRes ? (signupRes.data as ClassSignup[]) : []
  const sessionOf = (cs: ClassSignup) =>
    Array.isArray(cs.class_sessions) ? cs.class_sessions[0] : cs.class_sessions

  const reservationRes = await getMyReservations()
  type Reservation = {
    id: string
    starts_at: string
    ends_at: string
    status: string
    notes: string | null
    equipment: { name: string; location: string | null } | { name: string; location: string | null }[] | null
  }
  const reservations: Reservation[] = 'data' in reservationRes ? (reservationRes.data as Reservation[]) : []
  const equipOf = (r: Reservation) => (Array.isArray(r.equipment) ? r.equipment[0] : r.equipment)

  const cardsRes = await getMyCards()
  type MyCard = { id: string; card_type: string; label: string | null; is_active: boolean; last4: string }
  const myCards: MyCard[] = 'data' in cardsRes ? (cardsRes.data as MyCard[]) : []
  const titleOf = (cs: ClassSignup) => {
    const sess = sessionOf(cs)
    const c = sess ? (Array.isArray(sess.classes) ? sess.classes[0] : sess.classes) : null
    return c?.title ?? 'Class'
  }

  return (
    <>
      <PageHeader>
        <PageTitle>My certifications &amp; access</PageTitle>
      </PageHeader>

      <div className="p-4 md:p-6 space-y-8 max-w-3xl">
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            Certifications
          </h2>
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

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            My permissions
          </h2>
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

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            My classes
          </h2>
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
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            My equipment reservations
          </h2>
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
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            My access cards
          </h2>
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
      </div>
    </>
  )
}
