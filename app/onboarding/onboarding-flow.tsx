'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BrandMark } from '@/components/brand-mark'
import { SafeMarkdown } from '@/components/safe-markdown'
import {
  markOnboardingStepDone,
  finishOnboarding,
  skipOnboarding,
  updateMyProfile,
} from '@/lib/actions'

type StepType = 'welcome' | 'code_of_conduct' | 'profile' | 'payment' | 'content'

interface Step {
  id: string
  step_type: StepType
  title: string
  body: string | null
  config: Record<string, unknown>
  is_required: boolean
}

interface Props {
  spaceName: string
  steps: Step[]
  canSkip: boolean
  profile: {
    display_name: string
    handle: string
    bio: string
    skills: string[]
    interests: string[]
  }
}

export function OnboardingFlow({ spaceName, steps, canSkip, profile: initialProfile }: Props) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [acked, setAcked] = useState<Record<string, boolean>>({})
  const [profile, setProfile] = useState(initialProfile)
  // Controlled raw text for the skills field so edits survive navigating
  // Back/forward and the user sees exactly what they typed (no normalize).
  const [skillsText, setSkillsText] = useState(initialProfile.skills.join(', '))

  const step = steps[index]
  const isLast = index === steps.length - 1
  const requireAck = step.config?.require_ack === true
  const ackLabel = (step.config?.ack_label as string) || 'I have read and agree'
  const ackOk = !requireAck || acked[step.id]

  async function advance() {
    setBusy(true)
    await markOnboardingStepDone(step.id)
    setBusy(false)
    if (isLast) {
      await finish()
    } else {
      setIndex(i => i + 1)
    }
  }

  async function finish() {
    setBusy(true)
    const result = await finishOnboarding()
    setBusy(false)
    if (result.error) { toast.error(result.error); return }
    router.push('/dashboard')
  }

  async function handleSkipAll() {
    setBusy(true)
    const result = await skipOnboarding()
    setBusy(false)
    if (result.error) { toast.error(result.error); return }
    router.push('/dashboard')
  }

  async function saveProfileAndAdvance() {
    setBusy(true)
    const result = await updateMyProfile({
      display_name: profile.display_name.trim() || undefined,
      handle: profile.handle.trim() || null,
      bio: profile.bio.trim() || null,
      skills: profile.skills,
      interests: profile.interests,
    })
    if ('error' in result && result.error) { setBusy(false); toast.error(result.error); return }
    await markOnboardingStepDone(step.id)
    setBusy(false)
    if (isLast) await finish()
    else setIndex(i => i + 1)
  }

  const progressPct = Math.round(((index) / steps.length) * 100)

  return (
    <div className="min-h-screen bg-sidebar flex flex-col">
      <header className="px-4 md:px-6 py-4 flex items-center gap-2 border-b border-sidebar-border">
        <BrandMark className="w-5 h-5 text-primary" />
        <span className="font-mono text-sm font-bold text-white">{spaceName}</span>
        {canSkip && (
          <button
            onClick={handleSkipAll}
            disabled={busy}
            className="ml-auto font-mono text-[11px] text-sidebar-foreground/60 hover:text-white transition"
          >
            Skip for now
          </button>
        )}
      </header>

      <div className="h-1 bg-sidebar-border">
        <div className="h-1 bg-primary transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      <main className="flex-1 flex items-start justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl bg-card border border-border rounded-lg mt-6 md:mt-12">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Step {index + 1} of {steps.length}
            </p>
            {step.is_required && (
              <span className="font-mono text-[10px] text-amber-600">required</span>
            )}
          </div>

          <div className="px-6 py-6">
            <h1 className="font-sans text-xl font-semibold text-foreground mb-4">{step.title}</h1>

            {step.step_type === 'profile' ? (
              <div className="space-y-4">
                {step.body && <SafeMarkdown>{step.body}</SafeMarkdown>}
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Display name</label>
                  <input
                    type="text"
                    value={profile.display_name}
                    onChange={e => setProfile({ ...profile, display_name: e.target.value })}
                    maxLength={100}
                    className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Handle</label>
                  <input
                    type="text"
                    value={profile.handle}
                    onChange={e => setProfile({ ...profile, handle: e.target.value })}
                    maxLength={50}
                    placeholder="optional"
                    className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Bio</label>
                  <textarea
                    value={profile.bio}
                    onChange={e => setProfile({ ...profile, bio: e.target.value })}
                    rows={3}
                    maxLength={2000}
                    placeholder="optional"
                    className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Skills (comma separated)</label>
                  <input
                    type="text"
                    value={skillsText}
                    onChange={e => {
                      setSkillsText(e.target.value)
                      setProfile({ ...profile, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 40) })
                    }}
                    className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            ) : step.step_type === 'payment' ? (
              <div className="space-y-4">
                {step.body && <SafeMarkdown>{step.body}</SafeMarkdown>}
                {typeof step.config?.payment_url === 'string' && step.config.payment_url && (
                  <a
                    href={step.config.payment_url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-primary text-white text-sm font-sans px-4 py-2 rounded hover:bg-primary/90 transition"
                  >
                    Set up payment
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {step.body && <SafeMarkdown>{step.body}</SafeMarkdown>}
                {requireAck && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!acked[step.id]}
                      onChange={e => setAcked({ ...acked, [step.id]: e.target.checked })}
                      className="mt-0.5"
                    />
                    <span className="font-sans text-sm text-foreground">{ackLabel}</span>
                  </label>
                )}
                {requireAck && !acked[step.id] && (
                  <p className="font-sans text-xs text-muted-foreground">Check the box above to continue.</p>
                )}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
            <button
              onClick={() => setIndex(i => Math.max(0, i - 1))}
              disabled={index === 0 || busy}
              className="font-sans text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              Back
            </button>
            <div className="flex items-center gap-2">
              {step.step_type === 'payment' && !isLast && (
                <button
                  onClick={advance}
                  disabled={busy}
                  className="font-sans text-sm text-muted-foreground hover:text-foreground transition px-3 py-2"
                >
                  Remind me later
                </button>
              )}
              <button
                onClick={step.step_type === 'profile' ? saveProfileAndAdvance : advance}
                disabled={busy || !ackOk}
                className="bg-primary text-white text-sm font-sans px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
              >
                {busy ? 'Saving...' : isLast ? 'Finish' : step.step_type === 'payment' ? 'I have set this up' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
