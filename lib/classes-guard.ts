import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Server-component guard for the /classes management surface. Mirrors the
// forms/certifications guards: resolve the member, check classes.manage via
// the same RPC the RLS uses, redirect non-managers before any data is
// fetched. The RLS independently enforces this; the redirect is UX only.
export async function requireClassesManagerPage() {
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
    perm: 'classes.manage',
  })
  if (!allowed) redirect('/dashboard')

  return { supabase, member }
}
