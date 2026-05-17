import { requireFormsManagerPage } from '@/lib/forms-guard'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { NewFormClient } from '@/components/forms/new-form-client'

export const dynamic = 'force-dynamic'

export default async function NewFormPage() {
  const { spaceSlug } = await requireFormsManagerPage()

  return (
    <>
      <PageHeader>
        <PageTitle>New form</PageTitle>
      </PageHeader>
      <div className="p-4 md:p-6">
        <NewFormClient spaceSlug={spaceSlug} />
      </div>
    </>
  )
}
