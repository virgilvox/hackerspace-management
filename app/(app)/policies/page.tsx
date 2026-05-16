import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Policy, PolicyStatus } from '@/lib/types'
import { PageTitle } from '@/components/ui/page-title'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<PolicyStatus, string> = {
  draft: 'text-muted-foreground bg-muted',
  active: 'text-primary bg-primary/10',
  deprecated: 'text-orange-600 bg-orange-50',
  superseded: 'text-muted-foreground bg-muted',
}

export default async function PoliciesPage() {
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

  const { data: policiesRaw } = await supabase
    .from('policies')
    .select('*')
    .eq('space_id', member.space_id)
    .order('slug', { ascending: true })
    .order('version', { ascending: false })

  const all = (policiesRaw ?? []) as unknown as Policy[]

  // For each slug, show the highest-version active row; fall back to highest-version overall.
  const bySlug = new Map<string, Policy>()
  for (const p of all) {
    const existing = bySlug.get(p.slug)
    if (!existing) bySlug.set(p.slug, p)
    else if (p.status === 'active' && existing.status !== 'active') bySlug.set(p.slug, p)
    else if (p.status === existing.status && p.version > existing.version) bySlug.set(p.slug, p)
  }

  const summary = Array.from(bySlug.values()).sort((a, b) => a.slug.localeCompare(b.slug))
  const isAdminOrBoard = member.role === 'admin' || member.role === 'board'

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <PageTitle>Policies</PageTitle>
        {isAdminOrBoard && (
          <Link
            href="/policies/new"
            className="bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
          >
            New policy
          </Link>
        )}
      </div>

      <div className="p-4 md:p-6 max-w-4xl">
        <div className="bg-card rounded border border-border divide-y divide-border">
          {summary.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-sans text-sm text-muted-foreground mb-1">No policies yet.</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                Bylaws, code of conduct, station rules. Each lives here with full version history.
              </p>
            </div>
          ) : (
            summary.map(p => (
              <Link
                key={p.slug}
                href={`/policies/${p.slug}`}
                className="block px-4 py-3 hover:bg-muted transition"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-sans text-sm font-medium text-foreground truncate">{p.title}</p>
                      <span className={`font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded ${STATUS_STYLE[p.status]}`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {p.slug}
                      {p.section_ref ? ` · §${p.section_ref}` : ''}
                      {' · v'}{p.version}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
