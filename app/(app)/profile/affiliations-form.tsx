'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { discloseAffiliations } from '@/lib/actions'
import { ChipInput } from '@/components/chip-input'

export function AffiliationsForm({ initial }: { initial: { affiliations: string[] } }) {
  const router = useRouter()
  const [affiliations, setAffiliations] = useState<string[]>(initial.affiliations)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'idle' | 'saved'>('idle')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStatus('idle')
    startTransition(async () => {
      const r = await discloseAffiliations({ affiliations })
      if ('error' in r && r.error) setError(r.error)
      else {
        setStatus('saved')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded border border-border p-5 space-y-4">
      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-2">
          Outside affiliations
        </label>
        <ChipInput
          values={affiliations}
          onChange={setAffiliations}
          placeholder='add an affiliation and press enter, e.g. "ACME Robotics, contractor"'
          maxLength={200}
          maxItems={50}
        />
        <p className="font-mono text-[10px] text-muted-foreground mt-1">
          Organizations, businesses, or roles outside this space that could intersect with space
          decisions. Visible to all members. Submitting stamps your disclosure date.
        </p>
      </div>

      {error && <p className="font-mono text-xs text-red-500">{error}</p>}
      {status === 'saved' && !error && (
        <p className="font-mono text-xs text-primary">Disclosed. Your timestamp is updated.</p>
      )}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-white font-sans text-sm font-medium px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
        >
          {isPending ? 'Disclosing...' : 'Disclose now'}
        </button>
      </div>
    </form>
  )
}
