import { createAdminClient } from '@/lib/supabase/admin'

// A class manager need not hold forms.manage, so form lookups + the
// submission gate use the service client (scoped by space_id) and never
// return form answers -- only existence/metadata.
export async function findSpaceForm(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  formId: string,
): Promise<{ id: string; status: string; title: string; slug: string } | null> {
  const { data } = await admin
    .from('forms')
    .select('id, status, title, slug')
    .eq('id', formId)
    .eq('space_id', spaceId)
    .maybeSingle()
  return data
    ? {
        id: data.id as string,
        status: data.status as string,
        title: data.title as string,
        slug: data.slug as string,
      }
    : null
}

export async function hasFormSubmission(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  memberId: string,
  formId: string,
): Promise<boolean> {
  const { count } = await admin
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', spaceId)
    .eq('form_id', formId)
    .eq('member_id', memberId)
  return (count ?? 0) > 0
}
