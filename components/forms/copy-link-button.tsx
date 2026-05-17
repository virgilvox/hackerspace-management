'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// One reusable copy-to-clipboard control for a form's public link. Shared by
// the admin forms list and the member forms list so the behaviour and styling
// never drift.
export function CopyLinkButton({ path, label = 'Copy link' }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const url =
      typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
    try {
      await navigator.clipboard?.writeText(url)
      setCopied(true)
      toast.success('Public link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — copy it manually')
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={copy} aria-label={label}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {label}
    </Button>
  )
}
