import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from './onboarding-flow'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('id, space_id, display_name, handle, bio, phone, skills, interests, onboarding_completed_at, spaces(name)')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!member) redirect(`/signup?email=${encodeURIComponent(user.email || '')}`)
  if (member.onboarding_completed_at) redirect('/dashboard')

  const { data: steps } = await supabase
    .from('space_onboarding_steps')
    .select('id, step_key, step_type, title, body, config, is_required')
    .eq('space_id', member.space_id)
    .eq('is_enabled', true)
    .order('sort_order', { ascending: true })

  // No steps configured: nothing to show. Mark complete and move on.
  if (!steps || steps.length === 0) {
    await supabase
      .from('space_members')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', member.id)
    redirect('/dashboard')
  }

  const canSkip = !steps.some(s => s.is_required)
  const spaceName = (member.spaces as { name?: string } | null)?.name ?? 'your space'

  return (
    <OnboardingFlow
      spaceName={spaceName}
      steps={steps.map(s => ({
        id: s.id,
        step_type: s.step_type as 'welcome' | 'code_of_conduct' | 'profile' | 'payment' | 'content',
        title: s.title,
        body: s.body,
        config: (s.config ?? {}) as Record<string, unknown>,
        is_required: s.is_required,
      }))}
      canSkip={canSkip}
      profile={{
        display_name: member.display_name ?? '',
        handle: member.handle ?? '',
        bio: member.bio ?? '',
        skills: (member.skills as string[] | null) ?? [],
        interests: (member.interests as string[] | null) ?? [],
      }}
    />
  )
}
