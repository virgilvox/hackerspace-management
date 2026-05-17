import { notFound } from 'next/navigation'
import { requireFormsManagerPage } from '@/lib/forms-guard'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { FormBuilder } from '@/components/forms/form-builder'
import { parseFormSchema } from '@/lib/forms-schema'

export const dynamic = 'force-dynamic'

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, member, spaceSlug } = await requireFormsManagerPage()

  const { data: form } = await supabase
    .from('forms')
    .select('id, slug, title, description, kind, visibility, status, legal_text, schema, space_id')
    .eq('id', id)
    .eq('space_id', member.space_id)
    .single()

  if (!form) notFound()

  return (
    <>
      <PageHeader>
        <PageTitle>Edit form</PageTitle>
      </PageHeader>
      <div className="p-4 md:p-6">
        <FormBuilder
          initial={{
            id: form.id,
            spaceSlug,
            slug: form.slug,
            title: form.title,
            description: form.description ?? '',
            kind: form.kind as 'form' | 'waiver',
            visibility: form.visibility as 'public_anon' | 'public_auth' | 'members',
            legal_text: form.legal_text ?? '',
            status: form.status as 'draft' | 'published' | 'closed',
            schema: parseFormSchema(form.schema),
          }}
        />
      </div>
    </>
  )
}
