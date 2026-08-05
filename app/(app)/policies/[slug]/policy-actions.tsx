'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supersedePolicy, updatePolicyStatus } from '@/lib/actions'
import { policyStatuses } from '@/lib/validations'
import type { Policy } from '@/types/domain'

export function PolicyActions({ policy }: { policy: Policy }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [showSupersede, setShowSupersede] = useState(false)
  const [newBody, setNewBody] = useState(policy.body_formal)
  const [newPlain, setNewPlain] = useState(policy.body_plain ?? '')

  function run<T>(fn: () => Promise<T>, after?: () => void) {
    setError('')
    startTransition(async () => {
      const r = (await fn()) as unknown as { error?: string }
      if (r && r.error) setError(r.error)
      else after?.()
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="bg-card rounded border border-border p-5">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
          Manage
        </p>
        <div className="flex flex-wrap gap-2">
          {policy.status !== 'active' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => updatePolicyStatus(policy.id, 'active'))}
              className="font-sans text-xs border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary"
            >
              Activate v{policy.version}
            </button>
          )}
          {policy.status === 'active' && (
            <>
              <button
                type="button"
                onClick={() => setShowSupersede(s => !s)}
                className="font-sans text-xs border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary"
              >
                {showSupersede ? 'Cancel supersede' : 'Supersede with new version'}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => updatePolicyStatus(policy.id, 'deprecated'))}
                className="font-sans text-xs border border-border px-3 py-1.5 rounded hover:border-orange-500 hover:text-orange-600"
              >
                Deprecate
              </button>
            </>
          )}
          {policyStatuses
            .filter(s => s !== policy.status && s !== 'active')
            .map(s => (
              <button
                key={s}
                type="button"
                disabled={isPending}
                onClick={() => run(() => updatePolicyStatus(policy.id, s))}
                className="font-sans text-xs border border-border px-3 py-1.5 rounded text-muted-foreground hover:text-foreground"
              >
                Set {s}
              </button>
            ))}
        </div>
      </div>

      {showSupersede && (
        <div className="bg-card rounded border border-border p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Supersede v{policy.version} with v{policy.version + 1}
          </p>
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
                Plain language (optional)
              </label>
              <textarea
                value={newPlain}
                onChange={e => setNewPlain(e.target.value)}
                rows={4}
                maxLength={100000}
                className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
                Formal text
              </label>
              <textarea
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
                rows={12}
                maxLength={100000}
                className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                run(
                  () =>
                    supersedePolicy({
                      policyId: policy.id,
                      body_formal: newBody,
                      body_plain: newPlain || null,
                    }),
                  () => setShowSupersede(false),
                )
              }
              className="bg-primary text-white font-sans text-sm font-medium px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isPending ? 'Creating draft...' : 'Create draft v' + (policy.version + 1)}
            </button>
          </div>
        </div>
      )}

      {error && <p className="font-mono text-xs text-red-500">{error}</p>}
    </div>
  )
}
