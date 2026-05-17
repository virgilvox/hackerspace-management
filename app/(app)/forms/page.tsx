import { requireFormsManagerPage } from '@/lib/forms-guard'
import { FormsClient } from './forms-client'

export const dynamic = 'force-dynamic'

export default async function FormsPage() {
  const { supabase, member, spaceSlug } = await requireFormsManagerPage()

  const { data: forms } = await supabase
    .from('forms')
    .select('id, slug, title, kind, visibility, status, version, created_at')
    .eq('space_id', member.space_id)
    .order('created_at', { ascending: false })

  return <FormsClient forms={forms ?? []} spaceSlug={spaceSlug} />
}
