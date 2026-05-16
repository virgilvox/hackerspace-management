import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Server-component guard for the /forms management pages. Mirrors the
// /settings server gate: resolve the member, check forms.manage via the
// same RPC the forms RLS uses, and redirect non-managers before any data
// is fetched. The forms RLS independently enforces this; the redirect is
// for UX, not the security boundary.
export async function requireFormsManagerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('id, space_id, role, user_id, display_name')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .single()
  if (!member) redirect('/login')

  const { data: allowed } = await supabase.rpc('user_has_permission', {
    uid: user.id,
    sid: member.space_id,
    perm: 'forms.manage',
  })
  if (!allowed) redirect('/dashboard')

  return { supabase, member }
}
