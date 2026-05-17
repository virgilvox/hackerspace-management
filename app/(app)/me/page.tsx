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
      </div>
    </>
  )
}
