import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageTitle } from '@/components/ui/page-title'

export const dynamic = 'force-dynamic'

type SkilledMember = {
  id: string
  display_name: string | null
  handle: string | null
  role: string
  tier: string
  skills: string[]
  interests: string[]
  willing_to: string[]
  coi_last_disclosed_at: string | null
}

export default async function RecruitmentPage() {
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
  if (member.role !== 'admin' && member.role !== 'board') redirect('/dashboard')

  const { data: rowsRaw } = await supabase
    .from('space_members')
    .select('id, display_name, handle, role, tier, skills, interests, willing_to, coi_last_disclosed_at')
    .eq('space_id', member.space_id)
    .in('status', ['current', 'unverified', 'late'])
    .eq('approved', true)
    .order('display_name', { ascending: true })

  const members = ((rowsRaw ?? []) as unknown as SkilledMember[]).filter(
    m => m.willing_to.length > 0 || m.skills.length > 0,
  )

  // Group by willing_to role.
  const byRole = new Map<string, SkilledMember[]>()
  for (const m of members) {
    for (const w of m.willing_to) {
      if (!byRole.has(w)) byRole.set(w, [])
      byRole.get(w)!.push(m)
    }
  }
  const roleGroups = Array.from(byRole.entries()).sort(([a], [b]) => a.localeCompare(b))

  // Members who only declared skills but no willing_to.
  const skillsOnly = members.filter(m => m.willing_to.length === 0 && m.skills.length > 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3">
        <PageTitle>Recruitment</PageTitle>
      </div>

      <div className="p-4 md:p-6 max-w-4xl space-y-6">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Board / admin view. Read-only.
        </p>

        {members.length === 0 ? (
          <div className="bg-card rounded border border-border p-8 text-center">
            <p className="font-sans text-sm text-foreground mb-1">No members have declared willingness or skills yet.</p>
            <p className="font-mono text-[10px] text-muted-foreground">
              Members opt in from their <Link href="/profile" className="text-primary hover:underline">profile</Link> page.
            </p>
          </div>
        ) : (
          <>
            {roleGroups.length > 0 && (
              <section>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
                  Willing to take on
                </p>
                <div className="space-y-3">
                  {roleGroups.map(([role, list]) => (
                    <div key={role} className="bg-card rounded border border-border p-4">
                      <p className="font-mono text-xs tracking-widest uppercase text-primary mb-2">
                        {role.replace(/_/g, ' ')}
                      </p>
                      <ul className="divide-y divide-border">
                        {list.map(m => (
                          <li key={m.id} className="py-2 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-sans text-sm text-foreground">
                                {m.display_name ?? 'Unnamed'}
                                {m.handle ? <span className="font-mono text-[10px] text-muted-foreground"> · @{m.handle}</span> : null}
                              </p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {m.role} · {m.tier}
                                {m.skills.length > 0 ? ` · skills: ${m.skills.join(', ')}` : ''}
                              </p>
                            </div>
                            {(m.role === 'admin' || m.role === 'board' || m.role === 'treasurer') && (
                              <span
                                className={`font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded ${
                                  m.coi_last_disclosed_at
                                    ? 'text-primary bg-primary/10'
                                    : 'text-orange-600 bg-orange-50'
                                }`}
                              >
                                {m.coi_last_disclosed_at ? 'COI on file' : 'no COI'}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {skillsOnly.length > 0 && (
              <section>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
                  Skills declared (no role opt-in)
                </p>
                <div className="bg-card rounded border border-border divide-y divide-border">
                  {skillsOnly.map(m => (
                    <div key={m.id} className="p-4">
                      <p className="font-sans text-sm text-foreground">
                        {m.display_name ?? 'Unnamed'}
                        {m.handle ? <span className="font-mono text-[10px] text-muted-foreground"> · @{m.handle}</span> : null}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        skills: {m.skills.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
