import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { PERMISSIONS, PERMISSION_CODES } from '@/lib/permissions-catalog'
import { getMyClassSignups, getMyReservations, getMyCards, getMyVisits, getMyBilling, getMyNotifications, getMyPayments } from '@/lib/actions'
import {
  MePortalClient,
  type Grant,
  type ClassSignup,
  type Reservation,
  type MyCard,
  type MyVisit,
  type MyNotif,
  type MyPayment,
} from './me-portal-client'

export const dynamic = 'force-dynamic'

export default async function MePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select(
      'id, space_id, role, email, display_name, handle, phone, bio, skills, interests, willing_to, affiliations',
    )
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .maybeSingle()
  if (!member) redirect('/signup')

  const profile = {
    email: (member.email as string | null) ?? '',
    display_name: (member.display_name as string | null) ?? '',
    handle: (member.handle as string | null) ?? '',
    phone: (member.phone as string | null) ?? '',
    bio: (member.bio as string | null) ?? '',
    skills: (member.skills as string[] | null) ?? [],
    interests: (member.interests as string[] | null) ?? [],
    willing_to: (member.willing_to as string[] | null) ?? [],
    affiliations: (member.affiliations as string[] | null) ?? [],
  }

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
  const held = PERMISSIONS.filter(p => heldCodes.includes(p.code)).map(p => ({
    code: p.code,
    label: p.label,
  }))

  const signupRes = await getMyClassSignups()
  const classSignups: ClassSignup[] = 'data' in signupRes ? (signupRes.data as ClassSignup[]) : []

  const reservationRes = await getMyReservations()
  const reservations: Reservation[] = 'data' in reservationRes ? (reservationRes.data as Reservation[]) : []

  const cardsRes = await getMyCards()
  const myCards: MyCard[] = 'data' in cardsRes ? (cardsRes.data as MyCard[]) : []

  const visitsRes = await getMyVisits()
  const myVisits: MyVisit[] = 'data' in visitsRes ? (visitsRes.data as MyVisit[]) : []

  const billingRes = await getMyBilling()
  const billing = ('data' in billingRes ? billingRes.data : null) as
    | { status: string | null; currentPeriodEnd: string | null; hasCustomer: boolean }
    | null

  const notifsRes = await getMyNotifications()
  const notifs: MyNotif[] = 'data' in notifsRes ? (notifsRes.data as MyNotif[]) : []

  const paymentsRes = await getMyPayments()
  const payments: MyPayment[] = 'data' in paymentsRes ? (paymentsRes.data as MyPayment[]) : []

  return (
    <>
      <PageHeader>
        <PageTitle>My membership</PageTitle>
      </PageHeader>

      <MePortalClient
        profile={profile}
        grants={grants}
        held={held}
        billing={billing}
        payments={payments}
        notifs={notifs}
        classSignups={classSignups}
        reservations={reservations}
        myCards={myCards}
        myVisits={myVisits}
      />
    </>
  )
}
