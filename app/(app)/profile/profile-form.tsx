'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateMyProfile } from '@/lib/actions'
import { ChipInput } from '@/components/chip-input'
import { WILLING_TO_SUGGESTIONS } from '@/lib/profile-presets'

type Props = {
  initial: {
    display_name: string
    handle: string
    phone: string
    skills: string[]
    interests: string[]
    willing_to: string[]
  }
}

export function ProfileForm({ initial }: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initial.display_name)
  const [handle, setHandle] = useState(initial.handle)
  const [phone, setPhone] = useState(initial.phone)
  const [skills, setSkills] = useState<string[]>(initial.skills)
  const [interests, setInterests] = useState<string[]>(initial.interests)
  const [willingTo, setWillingTo] = useState<string[]>(initial.willing_to)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'idle' | 'saved'>('idle')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStatus('idle')
    startTransition(async () => {
      const r = await updateMyProfile({
        display_name: displayName,
        handle: handle || null,
        phone: phone || null,
        skills,
        interests,
        willing_to: willingTo,
      })
      if ('error' in r && r.error) setError(r.error)
      else {
        setStatus('saved')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded border border-border p-5 space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={100}
            required
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
            Handle
          </label>
          <input
            type="text"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            maxLength={50}
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
          Phone
        </label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          maxLength={20}
          className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
          Skills
        </label>
        <ChipInput values={skills} onChange={setSkills} placeholder="add a skill and press enter" maxLength={60} maxItems={40} />
        <p className="font-mono text-[10px] text-muted-foreground mt-1">
          Examples: woodworking, laser, electronics, accounting, grant writing.
        </p>
      </div>

      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
          Interests
        </label>
        <ChipInput values={interests} onChange={setInterests} placeholder="add an interest and press enter" maxLength={60} maxItems={40} />
      </div>

      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
          Willing to do
        </label>
        <ChipInput
          values={willingTo}
          onChange={setWillingTo}
          placeholder="add a role and press enter"
          maxLength={60}
          maxItems={20}
          suggestions={WILLING_TO_SUGGESTIONS}
        />
        <p className="font-mono text-[10px] text-muted-foreground mt-1">
          Used by the recruitment view (board only) when looking for members willing to take on a role.
        </p>
      </div>

      {error && <p className="font-mono text-xs text-red-500">{error}</p>}
      {status === 'saved' && !error && (
        <p className="font-mono text-xs text-primary">Saved.</p>
      )}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-white font-sans text-sm font-medium px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}
