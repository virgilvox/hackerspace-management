import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ClipboardList } from 'lucide-react'

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
    .select('space_id')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .single()
  if (!member) redirect('/login')

  const { data: forms } = await supabase
    .from('forms')
    .select('id, title, description, kind, status')
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
            {list.map(f => (
              <Link
                key={f.id}
                href={`/my-forms/${f.id}`}
                className="flex items-center gap-3 p-4 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{f.title}</span>
                    {f.kind === 'waiver' && <Badge variant="secondary">Waiver</Badge>}
                  </div>
                  {f.description && (
                    <p className="truncate text-sm text-muted-foreground">{f.description}</p>
                  )}
                </div>
                <span className="text-sm text-primary">Open →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
