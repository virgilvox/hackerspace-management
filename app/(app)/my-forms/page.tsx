import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ClipboardList } from 'lucide-react'
import { CopyLinkButton } from '@/components/forms/copy-link-button'

export const dynamic = 'force-dynamic'

// Member-facing list of forms a member can fill. Auth + membership are already
// enforced by the (app) layout; RLS lets a member read published forms in
// their space.
export default async function MyFormsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('space_id, spaces(slug)')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .single()
  if (!member) redirect('/login')

  const spaceSlug = (member.spaces as { slug?: string } | null)?.slug ?? ''

  const { data: forms } = await supabase
    .from('forms')
    .select('id, title, description, kind, status, slug, visibility')
    .eq('space_id', member.space_id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  const list = forms ?? []

  return (
    <>
      <PageHeader>
        <PageTitle>Forms</PageTitle>
      </PageHeader>
      <div className="p-4 md:p-6">
        {list.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardList />
              </EmptyMedia>
              <EmptyTitle>Nothing to fill right now</EmptyTitle>
              <EmptyDescription>
                Forms and waivers your space publishes will show up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y rounded-lg border">
            {list.map(f => {
              const isPublic = f.visibility !== 'members'
              return (
                <div key={f.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/my-forms/${f.id}`} className="font-medium hover:underline">
                        {f.title}
                      </Link>
                      {f.kind === 'waiver' && <Badge variant="secondary">Waiver</Badge>}
                    </div>
                    {f.description && (
                      <p className="truncate text-sm text-muted-foreground">{f.description}</p>
                    )}
                    {isPublic && (
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        /f/{spaceSlug}/{f.slug}
                      </p>
                    )}
                  </div>
                  {isPublic && <CopyLinkButton path={`/f/${spaceSlug}/${f.slug}`} />}
                  <Link
                    href={`/my-forms/${f.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Open →
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
