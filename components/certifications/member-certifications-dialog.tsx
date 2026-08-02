'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm'
import {
  listMemberCertifications,
  listCertifications,
  grantCertification,
  revokeCertification,
  renewCertification,
} from '@/lib/actions'
import {
  certificationStatus,
  CERT_STATUS_LABEL,
  type CertStatus,
} from '@/lib/certifications-logic'

type Grant = {
  id: string
  certification_id: string
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
  revoked_reason: string | null
  note: string | null
  certifications: { name: string; validity_months: number | null; is_active: boolean } | null
}

type CertType = {
  id: string
  name: string
  is_active: boolean
}

const STATUS_CLASS: Record<CertStatus, string> = {
  active: 'text-primary bg-primary/10 border-primary/20',
  expiring_soon: 'text-amber-600 bg-amber-50 border-amber-200',
  expired: 'text-red-600 bg-red-50 border-red-200',
  revoked: 'text-muted-foreground bg-muted border-border',
}

export function MemberCertificationsDialog({
  member,
  onClose,
}: {
  member: { id: string; display_name: string | null } | null
  onClose: () => void
}) {
  const confirm = useConfirm()
  const open = !!member
  const [loading, setLoading] = useState(false)
  const [grants, setGrants] = useState<Grant[]>([])
  const [types, setTypes] = useState<CertType[]>([])
  const [certId, setCertId] = useState('')
  const [note, setNote] = useState('')
  const [expires, setExpires] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (memberId: string) => {
    setLoading(true)
    const [g, t] = await Promise.all([
      listMemberCertifications({ memberId }),
      listCertifications(),
    ])
    setLoading(false)
    if ('error' in g && g.error) {
      toast.error(g.error)
    } else {
      // TODO(types): remove after regenerating types/database.ts (missing FK relationship metadata)
      setGrants(((g as unknown as { data: Grant[] }).data) ?? [])
    }
    if (!('error' in t) || !t.error) {
      setTypes(((t as { data: CertType[] }).data ?? []).filter(c => c.is_active))
    }
  }, [])

  useEffect(() => {
    if (member) {
      setCertId('')
      setNote('')
      setExpires('')
      load(member.id)
    }
  }, [member, load])

  async function onGrant(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return
    if (!certId) {
      toast.error('Pick a certification')
      return
    }
    setBusy(true)
    const res = await grantCertification({
      memberId: member.id,
      certificationId: certId,
      note: note.trim() || null,
      expires_at: expires || null,
    })
    setBusy(false)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Certification awarded')
    setCertId('')
    setNote('')
    setExpires('')
    load(member.id)
  }

  async function onRevoke(g: Grant) {
    const ok = await confirm({
      title: 'Revoke certification',
      description: `Revoke "${g.certifications?.name ?? 'this certification'}" from ${member?.display_name ?? 'this member'}? The record is kept as history.`,
      confirmText: 'Revoke',
      destructive: true,
    })
    if (!ok || !member) return
    const res = await revokeCertification({ memberCertificationId: g.id })
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Revoked')
    load(member.id)
  }

  async function onRenew(g: Grant) {
    if (!member) return
    const res = await renewCertification({ memberCertificationId: g.id })
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Renewed')
    load(member.id)
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Certifications — {member?.display_name ?? 'Member'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onGrant} className="space-y-2 border border-border rounded p-3 bg-background">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Award a certification</p>
          <select
            value={certId}
            onChange={e => setCertId(e.target.value)}
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-2 focus:outline-none focus:border-primary"
          >
            <option value="">Select a certification…</option>
            {types.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={note}
            maxLength={2000}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional, e.g. completed in class)"
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-2 focus:outline-none focus:border-primary"
          />
          <label className="block font-mono text-[10px] text-muted-foreground">
            Expiry override (optional — defaults to the cert&rsquo;s validity period)
            <input
              type="date"
              value={expires}
              onChange={e => setExpires(e.target.value)}
              className="mt-1 w-full bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-2 focus:outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-white text-xs font-sans px-3 py-2 rounded hover:bg-primary/90 transition disabled:opacity-60"
          >
            Award certification
          </button>
        </form>

        <div className="mt-2">
          {loading ? (
            <p className="font-mono text-xs text-muted-foreground py-4">Loading…</p>
          ) : grants.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground py-4">No certifications yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {grants.map(g => {
                const status = certificationStatus(g)
                return (
                  <li key={g.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans text-sm font-medium text-foreground">
                          {g.certifications?.name ?? 'Certification'}
                        </span>
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${STATUS_CLASS[status]}`}>
                          {CERT_STATUS_LABEL[status]}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        granted {new Date(g.granted_at).toLocaleDateString()}
                        {g.expires_at ? ` · expires ${new Date(g.expires_at).toLocaleDateString()}` : ' · no expiry'}
                        {g.revoked_at ? ` · revoked ${new Date(g.revoked_at).toLocaleDateString()}` : ''}
                      </p>
                      {g.note && <p className="font-sans text-xs text-muted-foreground mt-0.5">{g.note}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!g.revoked_at && (
                        <>
                          <button
                            onClick={() => onRenew(g)}
                            className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary hover:text-primary transition"
                          >
                            Renew
                          </button>
                          <button
                            onClick={() => onRevoke(g)}
                            className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-red-500 hover:text-red-500 transition"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
