import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { parseFormSchema } from '@/lib/forms-schema'
import { MemberFillClient } from '@/components/forms/member-fill-client'

export const dynamic = 'force-dynamic'

export default async function MemberFillPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: form } = await supabase
    .from('forms')
    .select('id, title, description, kind, legal_text, schema, status, space_id')
    .eq('id', id)
    .eq('space_id', member.space_id)
    .eq('status', 'published')
    .maybeSingle()
  if (!form) notFound()

  return (
    <>
      <PageHeader>
        <PageTitle>{form.title}</PageTitle>
      </PageHeader>
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <MemberFillClient
          formId={form.id}
          description={form.description}
          kind={form.kind}
          legalText={form.legal_text}
          fields={parseFormSchema(form.schema)}
        />
      </div>
    </>
  )
}
