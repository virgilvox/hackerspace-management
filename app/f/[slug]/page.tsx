import { createClient } from '@/lib/supabase/server'
import { getPublicForm } from '@/lib/actions'
import { parseFormSchema } from '@/lib/forms-schema'
import { PublicFormClient } from './public-form-client'

export const dynamic = 'force-dynamic'

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const res = await getPublicForm({ slug })

  if ('error' in res && res.error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-semibold">This form is not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may be unpublished, closed, or the link is wrong.
        </p>
      </main>
    )
  }

  const form = res.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto max-w-2xl p-4 md:p-8">
      <PublicFormClient
        slug={form.slug}
        title={form.title}
        description={form.description}
        kind={form.kind}
        visibility={form.visibility}
        legalText={form.legal_text}
        fields={parseFormSchema(form.schema)}
        authed={Boolean(user)}
      />
    </main>
  )
}
