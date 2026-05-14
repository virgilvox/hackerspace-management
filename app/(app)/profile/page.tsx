import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './profile-form'
import { AffiliationsForm } from './affiliations-form'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberRaw } = await supabase
    .from('space_members')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .maybeSingle()
  if (!memberRaw) redirect('/signup')

  const member = memberRaw as unknown as {
    id: string
    display_name: string | null
    handle: string | null
    phone: string | null
    role: string
    tier: string
    skills: string[]
    interests: string[]
    willing_to: string[]
    affiliations: string[]
    coi_last_disclosed_at: string | null
    email: string | null
  }

  const privilegedRoles = ['admin', 'board', 'treasurer']
  const isPrivileged = privilegedRoles.includes(member.role)

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3">
        <h1 className="text-white font-sans text-lg font-semibold">My profile</h1>
      </div>

      <div className="p-4 md:p-6 space-y-6 max-w-3xl">
        <header className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-1">
            Account
          </p>
          <p className="font-sans text-sm text-foreground">{member.email}</p>
          <p className="font-mono text-[10px] text-muted-foreground mt-1">
            role: {member.role} · tier: {member.tier}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mt-2">
            Role and tier can only be changed by an admin or board member. The privilege-escalation
            trigger blocks self-edits to those fields at the database level.
          </p>
        </header>

        <section>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Profile
          </p>
          <ProfileForm
            initial={{
              display_name: member.display_name ?? '',
              handle: member.handle ?? '',
              phone: member.phone ?? '',
              skills: member.skills ?? [],
              interests: member.interests ?? [],
              willing_to: member.willing_to ?? [],
            }}
          />
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Conflict-of-interest disclosure
            </p>
            {member.coi_last_disclosed_at && (
              <p className="font-mono text-[10px] text-muted-foreground">
                last disclosed {new Date(member.coi_last_disclosed_at).toLocaleDateString()}
              </p>
            )}
          </div>
          {isPrivileged && !member.coi_last_disclosed_at && (
            <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-3">
              <p className="font-sans text-sm text-orange-900">
                You hold a privileged role ({member.role}). Please disclose any outside affiliations
                that could conflict with space governance. Disclosure is visible to other members.
              </p>
            </div>
          )}
          <AffiliationsForm initial={{ affiliations: member.affiliations ?? [] }} />
        </section>
      </div>
    </div>
  )
}
