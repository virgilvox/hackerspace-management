import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Policy } from '@/lib/types'
import { PolicyActions } from './policy-actions'
import { MarkdownBody } from '@/components/markdown'

export const dynamic = 'force-dynamic'

export default async function PolicyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
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

  const { data: versionsRaw } = await supabase
    .from('policies')
    .select('*')
    .eq('space_id', member.space_id)
    .eq('slug', slug)
    .order('version', { ascending: false })

  const versions = (versionsRaw ?? []) as unknown as Policy[]
  if (versions.length === 0) notFound()

  // Pick the currently-active version, or the latest version, for the primary view.
  const current = versions.find(p => p.status === 'active') ?? versions[0]
  const isAdminOrBoard = member.role === 'admin' || member.role === 'board'

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center gap-3">
        <Link href="/policies" className="text-white/70 hover:text-white font-sans text-sm">
          ← Policies
        </Link>
      </div>

      <div className="p-4 md:p-6 max-w-3xl space-y-6">
        <header className="bg-card rounded border border-border p-5">
          <h1 className="font-sans text-xl font-semibold text-foreground mb-1">{current.title}</h1>
          <p className="font-mono text-[10px] text-muted-foreground">
            {current.slug}
            {current.section_ref ? ` · §${current.section_ref}` : ''}
            {' · v'}{current.version}
            {' · '}
            {current.status}
            {current.effective_at ? ` · effective ${new Date(current.effective_at).toLocaleDateString()}` : ''}
          </p>
        </header>

        {current.body_plain && (
          <section className="bg-card rounded border border-border p-5">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
              Plain language
            </p>
            <MarkdownBody content={current.body_plain} />
          </section>
        )}

        <section className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
            Formal text
          </p>
          <MarkdownBody content={current.body_formal} />
        </section>

        {isAdminOrBoard && (
          <PolicyActions policy={current} />
        )}

        <section className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Version history ({versions.length})
          </p>
          <ul className="divide-y divide-border">
            {versions.map(v => (
              <li key={v.id} className="py-2 flex items-center justify-between">
                <div>
                  <p className="font-sans text-sm">v{v.version} · {v.status}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    created {new Date(v.created_at).toLocaleDateString()}
                    {v.effective_at ? ` · effective ${new Date(v.effective_at).toLocaleDateString()}` : ''}
                    {v.adopted_by_proposal_id ? (
                      <>
                        {' · '}
                        <Link href={`/proposals/${v.adopted_by_proposal_id}`} className="text-primary hover:underline">
                          adopted by proposal
                        </Link>
                      </>
                    ) : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
