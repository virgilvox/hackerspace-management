import { notFound } from 'next/navigation'
import { requireFormsManagerPage } from '@/lib/forms-guard'
import { parseFormSchema } from '@/lib/forms-schema'
import { ResultsClient } from './results-client'

export const dynamic = 'force-dynamic'

export default async function FormResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, member } = await requireFormsManagerPage()

  const { data: form } = await supabase
    .from('forms')
    .select('id, slug, title, kind, schema')
    .eq('id', id)
    .eq('space_id', member.space_id)
    .single()
  if (!form) notFound()

  const { data: submissions } = await supabase
    .from('form_submissions')
    .select('id, member_id, submitter_email, answers, form_version, created_at')
    .eq('form_id', id)
    .eq('space_id', member.space_id)
    .order('created_at', { ascending: false })
    .limit(5000)

  return (
    <ResultsClient
      formId={form.id}
      title={form.title}
      fields={parseFormSchema(form.schema)}
      submissions={submissions ?? []}
    />
  )
}
