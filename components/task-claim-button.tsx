'use client'

import { useState } from 'react'
import { claimTask, completeTask } from '@/lib/actions'

export function ClaimButton({ taskId }: { taskId: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleClaim() {
    setLoading(true)
    const result = await claimTask(taskId)
    if (!result.error) setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <span className="font-mono text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded">
        CLAIMED
      </span>
    )
  }

  return (
    <button
      onClick={handleClaim}
      disabled={loading}
      className="font-mono text-[10px] border border-border px-2 py-0.5 rounded hover:border-primary hover:text-primary transition disabled:opacity-50"
    >
      {loading ? '...' : 'CLAIM'}
    </button>
  )
}

export function CompleteButton({ taskId }: { taskId: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleComplete() {
    setLoading(true)
    const result = await completeTask(taskId)
    if (!result.error) setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
        DONE
      </span>
    )
  }

  return (
    <button
      onClick={handleComplete}
      disabled={loading}
      className="font-mono text-[10px] border border-green-200 text-green-700 px-2 py-0.5 rounded hover:bg-green-50 transition disabled:opacity-50"
    >
      {loading ? '...' : 'DONE'}
    </button>
  )
}
