'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { listMemberSubmissions } from '@/lib/actions'

type Submission = {
  id: string
  formId: string
  title: string
  kind: string
  version: number
  submittedAt: string
}

export function MemberFormsDialog({
  member,
  onClose,
}: {
  member: { id: string; display_name: string | null } | null
  onClose: () => void
}) {
  const open = !!member
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Submission[]>([])

  const load = useCallback(async (memberId: string) => {
    setLoading(true)
    const res = await listMemberSubmissions({ memberId })
    setLoading(false)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    setRows(((res as { data: Submission[] }).data) ?? [])
  }, [])

  useEffect(() => {
    if (member) load(member.id)
  }, [member, load])

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Forms submitted — {member?.display_name ?? 'Member'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="font-mono text-[11px] text-muted-foreground py-4">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground py-4">
            This member has no submitted forms on record. Submissions link automatically
            when the submitter email matches the member.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded border border-border">
            {rows.map(s => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans text-sm text-foreground truncate">{s.title}</span>
                    {s.kind === 'waiver' && <Badge variant="outline">waiver</Badge>}
                    <span className="font-mono text-[10px] text-muted-foreground">v{s.version}</span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                    {new Date(s.submittedAt).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/forms/${s.formId}/results`}
                  className="font-mono text-[10px] border border-border px-3 py-2 rounded hover:border-primary hover:text-primary transition shrink-0"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
