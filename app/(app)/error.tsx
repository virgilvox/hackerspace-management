'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[App Section Error]', error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Something went wrong
          </h2>
          
          <p className="text-sm text-muted-foreground mb-4">
            We encountered an error while loading this page.
          </p>

          {error.digest && (
            <p className="text-xs text-muted-foreground/60 font-mono mb-4 bg-muted px-2 py-1 rounded inline-block">
              {error.digest}
            </p>
          )}

          <div className="flex gap-2 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
            
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
