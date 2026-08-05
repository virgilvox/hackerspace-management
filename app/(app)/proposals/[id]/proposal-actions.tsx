'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  castVote,
  decideProposal,
  openProposal,
  withdrawProposal,
} from '@/lib/actions'
import type { ProposalStatus, ProposalVote, VotePosition } from '@/types/domain'
import { votePositions } from '@/lib/validations'

type Props = {
  proposalId: string
  status: ProposalStatus
  isAdminOrBoard: boolean
  isProposer: boolean
  votingOpen: boolean
  myVote: ProposalVote | null
}

export function ProposalActions({
  proposalId,
  status,
  isAdminOrBoard,
  isProposer,
  votingOpen,
  myVote,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Voting form state
  const [position, setPosition] = useState<VotePosition>(myVote?.position ?? 'yes')
  const [recusalReason, setRecusalReason] = useState(myVote?.recusal_reason ?? '')
  const [comment, setComment] = useState(myVote?.comment ?? '')

  function run<T>(fn: () => Promise<T>) {
    setError('')
    startTransition(async () => {
      const r = (await fn()) as unknown as { error?: string }
      if (r && r.error) setError(r.error)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {votingOpen && (
        <div className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            {myVote ? 'Update your vote' : 'Cast your vote'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {votePositions.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPosition(p)}
                className={`font-mono text-xs tracking-widest uppercase py-2.5 rounded border transition ${
                  position === p
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-foreground hover:border-primary'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {position === 'recused' && (
            <div className="mb-3">
              <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
                Recusal reason (required)
              </label>
              <textarea
                value={recusalReason}
                onChange={e => setRecusalReason(e.target.value)}
                rows={2}
                maxLength={1000}
                className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
              />
            </div>
          )}
          <div className="mb-3">
            <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
              Comment (optional, public)
            </label>
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              maxLength={2000}
              className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            disabled={isPending || (position === 'recused' && recusalReason.trim().length === 0)}
            onClick={() =>
              run(() =>
                castVote({
                  proposalId,
                  position,
                  recusal_reason: position === 'recused' ? recusalReason : null,
                  comment: comment || null,
                }),
              )
            }
            className="bg-primary text-white font-sans text-sm font-medium px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
          >
            {isPending ? 'Saving...' : myVote ? 'Update vote' : 'Submit vote'}
          </button>
        </div>
      )}

      {(isAdminOrBoard || isProposer) && (
        <div className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Manage
          </p>
          <div className="flex flex-wrap gap-2">
            {status === 'draft' && (
              <button
                type="button"
                onClick={() => run(() => openProposal(proposalId))}
                disabled={isPending}
                className="font-sans text-xs border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary"
              >
                Open for voting
              </button>
            )}
            {(status === 'draft' || status === 'open') && (
              <button
                type="button"
                onClick={() => run(() => withdrawProposal(proposalId))}
                disabled={isPending}
                className="font-sans text-xs border border-border px-3 py-1.5 rounded hover:border-orange-500 hover:text-orange-600"
              >
                Withdraw
              </button>
            )}
            {status === 'open' && isAdminOrBoard && (
              <button
                type="button"
                onClick={() => run(() => decideProposal(proposalId))}
                disabled={isPending}
                className="font-sans text-xs border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary"
              >
                Mark decided
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="font-mono text-xs text-red-500">{error}</p>}
    </div>
  )
}
