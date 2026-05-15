import { createClient } from '@/lib/supabase/server'
import SettingsClient from './settings-client'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()

  if (!member) redirect('/login')

  const { data: space } = await supabase
    .from('spaces').select('*').eq('id', member.space_id).single()

  const { data: integrations } = await supabase
    .from('integrations').select('*').eq('space_id', member.space_id)

  const { data: areas } = await supabase
    .from('space_areas')
    .select('id, code, name, icon, sort_order, is_archived')
    .eq('space_id', member.space_id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  const { data: tiers } = await supabase
    .from('space_tiers')
    .select('id, slug, name, description, monthly_price_cents, billing_cadence, is_system, is_archived, sort_order')
    .eq('space_id', member.space_id)
    .order('sort_order', { ascending: true })

  const { data: invites } = await supabase
    .from('space_invites')
    .select('id, code, label, expires_at, max_uses, uses_count, is_enabled, created_at')
    .eq('space_id', member.space_id)
    .order('created_at', { ascending: false })

  const { data: onboardingSteps } = await supabase
    .from('space_onboarding_steps')
    .select('id, step_key, step_type, title, body, config, is_enabled, is_required, is_system, sort_order')
    .eq('space_id', member.space_id)
    .order('sort_order', { ascending: true })

  const isAdmin = member?.role === 'admin'

  return (
    <SettingsClient
      space={space}
      isAdmin={isAdmin}
      integrations={integrations ?? []}
      currentRole={member.role}
      areas={(areas ?? []) as Array<{
        id: string
        code: string
        name: string
        icon: string | null
        sort_order: number
        is_archived: boolean
      }>}
      tiers={(tiers ?? []) as Array<{
        id: string
        slug: string
        name: string
        description: string | null
        monthly_price_cents: number
        billing_cadence: string
        is_system: boolean
        is_archived: boolean
        sort_order: number
      }>}
      invites={(invites ?? []) as Array<{
        id: string
        code: string
        label: string | null
        expires_at: string | null
        max_uses: number | null
        uses_count: number
        is_enabled: boolean
        created_at: string
      }>}
      onboardingSteps={(onboardingSteps ?? []) as Array<{
        id: string
        step_key: string
        step_type: 'welcome' | 'code_of_conduct' | 'profile' | 'payment' | 'content'
        title: string
        body: string | null
        config: Record<string, unknown>
        is_enabled: boolean
        is_required: boolean
        is_system: boolean
        sort_order: number
      }>}
    />
  )
}
