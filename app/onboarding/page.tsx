import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseFormSchema } from '@/lib/forms-schema'
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

  // Enrich form steps with the referenced (published) form and whether this
  // member has already submitted it. Unpublished/missing forms resolve to no
  // formDef; the flow then shows a non-blocking notice (mirrors the
  // fail-open in finishOnboarding).
  const formIds = Array.from(
    new Set(
      steps
        .filter(s => s.step_type === 'form')
        .map(s => (s.config as { form_id?: string } | null)?.form_id)
        .filter((x): x is string => typeof x === 'string'),
    ),
  )

  const formDefs = new Map<
    string,
    { id: string; title: string; kind: string; legal_text: string | null; fields: ReturnType<typeof parseFormSchema> }
  >()
  const submittedFormIds = new Set<string>()

  if (formIds.length > 0) {
    const { data: formRows } = await supabase
      .from('forms')
      .select('id, title, kind, legal_text, schema, status')
      .eq('space_id', member.space_id)
      .in('id', formIds)
      .eq('status', 'published')
    for (const f of formRows ?? []) {
      formDefs.set(f.id, {
        id: f.id,
        title: f.title,
        kind: f.kind,
        legal_text: f.legal_text,
        fields: parseFormSchema(f.schema),
      })
    }
    // Submissions are forms.manage-only under RLS; probe with the service client.
    const admin = createAdminClient()
    const { data: subs } = await admin
      .from('form_submissions')
      .select('form_id')
      .eq('space_id', member.space_id)
      .eq('member_id', member.id)
      .in('form_id', formIds)
    for (const r of subs ?? []) submittedFormIds.add(r.form_id as string)
  }

  return (
    <OnboardingFlow
      spaceName={spaceName}
      steps={steps.map(s => {
        const formId = (s.config as { form_id?: string } | null)?.form_id
        const def = formId ? formDefs.get(formId) : undefined
        return {
          id: s.id,
          step_type: s.step_type as 'welcome' | 'code_of_conduct' | 'profile' | 'payment' | 'content' | 'form',
          title: s.title,
          body: s.body,
          config: (s.config ?? {}) as Record<string, unknown>,
          is_required: s.is_required,
          formDef: def
            ? {
                id: def.id,
                title: def.title,
                kind: def.kind,
                legalText: def.legal_text,
                fields: def.fields,
              }
            : null,
          alreadySubmitted: formId ? submittedFormIds.has(formId) : false,
        }
      })}
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
