'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createProposal } from '@/lib/actions'
import {
  proposalTypes,
  thresholdRules,
} from '@/lib/validations'

export function NewProposalForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [proposalType, setProposalType] = useState<string>('advisory_poll')
  const [threshold, setThreshold] = useState<string>('simple_majority')
  const [openImmediately, setOpenImmediately] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const result = await createProposal({
      title,
      body,
      proposal_type: proposalType,
      threshold,
      open_immediately: openImmediately,
    })

    if ('error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    if ('data' in result && result.data) {
      router.push(`/proposals/${(result.data as { id: string }).id}`)
    } else {
      router.push('/proposals')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded border border-border p-5">
      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={200}
          required
          className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          placeholder="Approve new laser station rules"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
          Body
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={10}
          maxLength={20000}
          className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          placeholder="Describe the proposal, the change being proposed, and the rationale."
        />
        <p className="font-mono text-[10px] text-muted-foreground mt-1">Markdown is rendered on the detail page.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
            Type
          </label>
          <select
            value={proposalType}
            onChange={e => setProposalType(e.target.value)}
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          >
            {proposalTypes.map(t => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
            Threshold to pass
          </label>
          <select
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          >
            {thresholdRules.map(t => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={openImmediately}
            onChange={e => setOpenImmediately(e.target.checked)}
            className="rounded border-border"
          />
          <span className="font-sans">Open voting immediately. Quorum and voting window come from space defaults.</span>
        </label>
      </div>

      {error && <p className="font-mono text-xs text-red-500">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/proposals"
          className="font-sans text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="bg-primary text-white font-sans text-sm font-medium px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save proposal'}
        </button>
      </div>
    </form>
  )
}
