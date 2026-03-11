'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('[App Error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Something went wrong
        </h1>
        
        <p className="text-muted-foreground mb-6">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>

        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono mb-6">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
