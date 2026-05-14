'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  updateIncidentStatus,
  addIncidentUpdate,
  appealIncident,
} from '@/lib/actions'
import type { IncidentStatus } from '@/lib/types'
import { incidentStatuses, incidentUpdateVisibilities } from '@/lib/validations'

type Props = {
  incidentId: string
  status: IncidentStatus
  isAdminOrBoard: boolean
  isReporter: boolean
  hasAppeal: boolean
  appealProposalId: string | null
}

export function IncidentActions({
  incidentId,
  status,
  isAdminOrBoard,
  isReporter,
  hasAppeal,
  appealProposalId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Add-update form
  const [updateBody, setUpdateBody] = useState('')
  const [updateVisibility, setUpdateVisibility] = useState<string>('all_parties')

  // Status transition form (admin/board)
  const [newStatus, setNewStatus] = useState<IncidentStatus>(status)
  const [disposition, setDisposition] = useState('')

  // Appeal form (reporter)
  const [appealTitle, setAppealTitle] = useState('')
  const [appealBody, setAppealBody] = useState('')

  function run<T>(fn: () => Promise<T>, after?: () => void) {
    setError('')
    startTransition(async () => {
      const r = (await fn()) as unknown as { error?: string }
      if (r && r.error) setError(r.error)
      else after?.()
      router.refresh()
    })
  }

  const canAppeal = isReporter && status === 'decided' && !hasAppeal

  return (
    <div className="space-y-3">
      {isAdminOrBoard && (
        <div className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Update status
          </p>
          <div className="space-y-3">
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as IncidentStatus)}
              className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
            >
              {incidentStatuses.map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            {(newStatus === 'decided' || newStatus === 'closed') && (
              <textarea
                value={disposition}
                onChange={e => setDisposition(e.target.value)}
                rows={4}
                maxLength={20000}
                placeholder="Disposition / reasoning (visible to reporter)"
                className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
              />
            )}
            <button
              type="button"
              disabled={isPending || newStatus === status}
              onClick={() =>
                run(() => updateIncidentStatus(incidentId, newStatus, disposition || null), () => setDisposition(''))
              }
              className="bg-primary text-white font-sans text-sm font-medium px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Apply status'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded border border-border p-5">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
          Post an update
        </p>
        <div className="space-y-3">
          <textarea
            value={updateBody}
            onChange={e => setUpdateBody(e.target.value)}
            rows={4}
            maxLength={20000}
            placeholder="Add information, ask a question, share a decision."
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          />
          {isAdminOrBoard && (
            <select
              value={updateVisibility}
              onChange={e => setUpdateVisibility(e.target.value)}
              className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
            >
              {incidentUpdateVisibilities.map(v => (
                <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={isPending || !updateBody.trim()}
            onClick={() =>
              run(
                () => addIncidentUpdate({ incidentId, body: updateBody, visibility: updateVisibility }),
                () => setUpdateBody(''),
              )
            }
            className="bg-primary text-white font-sans text-sm font-medium px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
          >
            {isPending ? 'Posting...' : 'Post update'}
          </button>
        </div>
      </div>

      {canAppeal && (
        <div className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Request membership appeal
          </p>
          <p className="font-sans text-xs text-muted-foreground mb-3">
            Creates a draft proposal that members can vote on. You will still need to open it
            for voting; that gives you time to refine the language.
          </p>
          <div className="space-y-3">
            <input
              type="text"
              value={appealTitle}
              onChange={e => setAppealTitle(e.target.value)}
              maxLength={200}
              placeholder="Appeal of dismissed complaint"
              className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
            />
            <textarea
              value={appealBody}
              onChange={e => setAppealBody(e.target.value)}
              rows={4}
              maxLength={20000}
              placeholder="Why the membership should overturn the board's decision."
              className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={isPending || !appealTitle.trim()}
              onClick={() => run(() => appealIncident({ incidentId, title: appealTitle, body: appealBody }))}
              className="bg-primary text-white font-sans text-sm font-medium px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isPending ? 'Filing appeal...' : 'File appeal'}
            </button>
          </div>
        </div>
      )}

      {hasAppeal && appealProposalId && (
        <div className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">Appeal</p>
          <Link href={`/proposals/${appealProposalId}`} className="font-sans text-sm text-primary hover:underline">
            View the appeal proposal →
          </Link>
        </div>
      )}

      {error && <p className="font-mono text-xs text-red-500">{error}</p>}
    </div>
  )
}
