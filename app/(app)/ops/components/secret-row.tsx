'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, Eye, EyeOff, Trash2, Copy, Check } from 'lucide-react'
import { revealSecret, deleteSecret } from '@/lib/actions/secrets'
import { OpsAclEditor } from '@/components/ops/ops-acl-editor'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm'
import type { AclRoleOption, Secret } from '../types'

// ─── Secret Row (reveal on click) ─────────────────────────────────────────────
export function SecretRow({ secret, onDelete, canManageAcl, aclRoleOptions, aclInitial }: {
  secret: Secret
  onDelete: (id: string) => void
  canManageAcl?: boolean
  aclRoleOptions?: AclRoleOption[]
  aclInitial?: string[]
}) {
  const confirm = useConfirm()
  const [revealed, setRevealed] = useState(false)
  const [value, setValue] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAcl, setShowAcl] = useState(false)
  const [copied, setCopied] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function hide() {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
    setRevealed(false)
    setValue(null)
    setCopied(false)
  }

  async function reveal() {
    if (revealed) { hide(); return }
    setLoading(true)
    const result = await revealSecret(secret.id)
    setLoading(false)
    if (result.error) { toast.error(result.error); return }
    setValue(result.value ?? '')
    setRevealed(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(hide, 30000)
  }

  async function copy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  // Re-hide a revealed secret when the window loses focus (screen share /
  // shoulder surfing), and drop the plaintext + timer on unmount.
  useEffect(() => {
    const onBlur = () => hide()
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  async function handleDelete() {
    if (!(await confirm({ title: 'Delete secret', description: `"${secret.title}" cannot be undone.`, confirmText: 'Delete', destructive: true }))) return
    const result = await deleteSecret(secret.id)
    if (result.error) { toast.error(result.error); return }
    toast.success('Secret deleted')
    onDelete(secret.id)
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
          <Lock className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-sm font-medium text-foreground">{secret.title}</p>
          {secret.area && <p className="font-mono text-[10px] text-muted-foreground">{secret.area}</p>}
          {revealed && value && (
            <div className="flex items-start gap-1.5 mt-1">
              <p className="flex-1 font-mono text-xs text-foreground bg-muted px-2 py-1 rounded break-all">{value}</p>
              <button
                type="button"
                onClick={copy}
                aria-label="Copy secret to clipboard"
                className="flex items-center gap-1 font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary hover:text-primary transition flex-shrink-0"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canManageAcl && (
            <button
              onClick={() => setShowAcl(v => !v)}
              className="flex items-center font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition"
              title="Who can access this secret"
            >
              Access
            </button>
          )}
          <button
            onClick={reveal}
            disabled={loading}
            className="flex items-center gap-1 font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition"
            title={revealed ? 'Hide' : 'Reveal'}
          >
            {loading ? '...' : revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {revealed ? 'Hide' : 'Reveal'}
          </button>
          <button onClick={handleDelete} className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 text-muted-foreground hover:text-red-500 transition" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {showAcl && canManageAcl && (
        <OpsAclEditor
          entityType="secret"
          entityId={secret.id}
          options={aclRoleOptions ?? []}
          initial={aclInitial ?? []}
        />
      )}
    </div>
  )
}
