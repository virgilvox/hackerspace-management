'use client'

import { useState } from 'react'
import { Copy, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { rotateWebhookSecret } from '@/lib/actions'
import type { SaveStatus, Space } from '../types'

interface Props extends SaveStatus {
  space: Space
  isAdmin: boolean
}

export function WebhooksPanel({ space, isAdmin, saving, setSaving, setMessage }: Props) {
  const [webhookSecret, setWebhookSecret] = useState(space.webhook_secret || '')
  const [copiedWebhook, setCopiedWebhook] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)

  async function handleRotateWebhook() {
    if (!isAdmin) return
    setSaving(true)
    const result = await rotateWebhookSecret()
    if (result.secret) {
      setWebhookSecret(result.secret)
      setShowWebhookSecret(true)
      setMessage({ type: 'success', text: 'New signing secret generated. Copy it now and store it securely.' })
    }
    setSaving(false)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedWebhook(true)
    setTimeout(() => setCopiedWebhook(false), 2000)
  }

  function copySecretToClipboard(text: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  return (
    <div className="bg-card rounded border border-border p-6 space-y-6">
      <div>
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Webhook Endpoint</p>
        <p className="font-sans text-sm text-muted-foreground mb-4">
          POST members to this endpoint for external integration or automation.
        </p>
        <div className="bg-muted/50 border border-border rounded p-4 mb-4">
          <code className="font-mono text-xs text-primary break-all">
            https://api.hackerspace.sh/{space.slug}/members
          </code>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => copyToClipboard(`https://api.hackerspace.sh/${space.slug}/members`)}
            className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition flex items-center gap-1"
          >
            <Copy className="w-3 h-3" />
            {copiedWebhook ? 'Copied!' : 'Copy URL'}
          </button>
          <a
            href="https://github.com/virgilvox/hackerspace-management/blob/main/docs/WEBHOOKS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition"
          >
            View Docs
          </a>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Signing Secret</p>
        <p className="font-sans text-sm text-muted-foreground mb-4">
          Every delivery is signed with HMAC-SHA256 using this secret. See <a
            href="https://github.com/virgilvox/hackerspace-management/blob/main/docs/WEBHOOKS.md#signing-and-verification"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >the docs</a> for verification examples in Node and Python.
        </p>
        <div className="bg-muted/50 border border-border rounded p-4 mb-4 flex items-center gap-3">
          <code className="font-mono text-xs text-foreground break-all flex-1">
            {webhookSecret
              ? (showWebhookSecret ? webhookSecret : '•'.repeat(Math.min(webhookSecret.length, 48)))
              : <span className="text-muted-foreground italic">No secret set. Rotate to generate one.</span>}
          </code>
          {webhookSecret && (
            <button
              onClick={() => setShowWebhookSecret(v => !v)}
              className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition flex items-center gap-1 shrink-0"
              title={showWebhookSecret ? 'Hide secret' : 'Show secret'}
            >
              {showWebhookSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {webhookSecret && (
            <button
              onClick={() => copySecretToClipboard(webhookSecret)}
              className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              {copiedSecret ? 'Copied!' : 'Copy secret'}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleRotateWebhook}
              disabled={saving}
              className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition flex items-center gap-1 disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              {webhookSecret ? 'Rotate' : 'Generate'}
            </button>
          )}
        </div>
        {webhookSecret && (
          <p className="font-sans text-[11px] text-muted-foreground mt-3">
            Rotating immediately invalidates the previous secret. Update your receiver before rotating in production.
          </p>
        )}
      </div>
    </div>
  )
}
