import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CustomizeClient } from './customize-client'

export const dynamic = 'force-dynamic'

export default async function CustomizePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('space_id, role')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .single()
  if (!member) redirect('/login')

  const isAdmin = member.role === 'admin'
  const canCustomize = member.role === 'admin' || member.role === 'board'
  if (!canCustomize) redirect('/dashboard')

  const [
    { data: roleLabels },
    { data: customRoles },
    { data: tiers },
    { data: invites },
    { data: onboardingSteps },
    { data: areas },
  ] = await Promise.all([
    supabase.from('space_role_labels').select('role, display_name, description, color').eq('space_id', member.space_id),
    supabase.from('space_custom_roles').select('id, slug, name, description, color, sort_order').eq('space_id', member.space_id).order('sort_order'),
    supabase.from('space_tiers').select('id, slug, name, description, monthly_price_cents, billing_cadence, is_system, is_archived, sort_order').eq('space_id', member.space_id).order('sort_order'),
    supabase.from('space_invites').select('id, code, label, expires_at, max_uses, uses_count, is_enabled, created_at').eq('space_id', member.space_id).order('created_at', { ascending: false }),
    supabase.from('space_onboarding_steps').select('id, step_key, step_type, title, body, config, is_enabled, is_required, is_system, sort_order').eq('space_id', member.space_id).order('sort_order'),
    supabase.from('space_areas').select('id, code, name, icon, sort_order, is_archived').eq('space_id', member.space_id).order('sort_order').order('name'),
  ])

  return (
    <CustomizeClient
      isAdmin={isAdmin}
      roleLabels={(roleLabels ?? []) as Array<{ role: string; display_name: string | null; description: string | null; color: string | null }>}
      customRoles={(customRoles ?? []) as Array<{ id: string; slug: string; name: string; description: string | null; color: string | null; sort_order: number }>}
      tiers={(tiers ?? []) as Array<{ id: string; slug: string; name: string; description: string | null; monthly_price_cents: number; billing_cadence: string; is_system: boolean; is_archived: boolean; sort_order: number }>}
      invites={(invites ?? []) as Array<{ id: string; code: string; label: string | null; expires_at: string | null; max_uses: number | null; uses_count: number; is_enabled: boolean; created_at: string }>}
      onboardingSteps={(onboardingSteps ?? []) as Array<{ id: string; step_key: string; step_type: 'welcome' | 'code_of_conduct' | 'profile' | 'payment' | 'content'; title: string; body: string | null; config: Record<string, unknown>; is_enabled: boolean; is_required: boolean; is_system: boolean; sort_order: number }>}
      areas={(areas ?? []) as Array<{ id: string; code: string; name: string; icon: string | null; sort_order: number; is_archived: boolean }>}
    />
  )
}
