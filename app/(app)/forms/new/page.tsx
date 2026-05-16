import { requireFormsManagerPage } from '@/lib/forms-guard'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { FormBuilder } from '@/components/forms/form-builder'

export const dynamic = 'force-dynamic'

export default async function NewFormPage() {
  await requireFormsManagerPage()

  return (
    <>
      <PageHeader>
        <PageTitle>New form</PageTitle>
      </PageHeader>
      <div className="p-4 md:p-6">
        <FormBuilder
          initial={{
            slug: '',
            title: '',
            description: '',
            kind: 'form',
            visibility: 'members',
            legal_text: '',
            schema: [],
          }}
        />
      </div>
    </>
  )
}
