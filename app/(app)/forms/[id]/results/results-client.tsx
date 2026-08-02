'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download } from 'lucide-react'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { useConfirm } from '@/components/ui/confirm'
import { toast } from 'sonner'
import { exportFormResultsCsv, deleteForm, deleteSubmission } from '@/lib/actions'
import type { FormField } from '@/lib/forms-schema'

type Submission = {
  id: string
  member_id: string | null
  submitter_email: string | null
  answers: Record<string, unknown> | null
  form_version: number
  created_at: string
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  return typeof v === 'string' ? v : JSON.stringify(v)
}

export function ResultsClient({
  formId,
  title,
  fields,
  submissions: initial,
}: {
  formId: string
  title: string
  fields: FormField[]
  submissions: Submission[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [submissions, setSubmissions] = useState<Submission[]>(initial)
  const [exporting, setExporting] = useState(false)
  const [busy, setBusy] = useState(false)

  async function exportCsv() {
    setExporting(true)
    const res = await exportFormResultsCsv({ formId })
    setExporting(false)
    if ('error' in res && res.error) {
      toast.error(res.error || 'Export failed')
      return
    }
    if (!res.data) return
    const { filename, csv } = res.data
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onDeleteSubmission(id: string) {
    const ok = await confirm({
      title: 'Delete this response?',
      description: 'This permanently removes this single submission. This cannot be undone.',
      confirmText: 'Delete response',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    const res = await deleteSubmission({ submissionId: id })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    setSubmissions(prev => prev.filter(s => s.id !== id))
    toast.success('Response deleted')
  }

  async function onDeleteForm() {
    const ok = await confirm({
      title: `Delete "${title}"?`,
      description:
        'This permanently deletes the form AND every response, including any signed waivers. This cannot be undone. Export first if you need a record.',
      confirmText: 'Delete form and all responses',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    const res = await deleteForm({ formId, confirm: true })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    toast.success('Form deleted')
    router.push('/forms')
  }

  return (
    <>
      <PageHeader>
        <div className="flex items-center gap-2">
          <Button asChild size="icon" variant="ghost" aria-label="Back to forms">
            <Link href="/forms">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <PageTitle>{title} — responses</PageTitle>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={exportCsv} disabled={exporting || submissions.length === 0}>
            <Download className="size-4" /> {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onDeleteForm}>
            Delete form
          </Button>
        </div>
      </PageHeader>

      <div className="p-4 md:p-6">
        {submissions.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No responses yet</EmptyTitle>
              <EmptyDescription>Submissions will appear here as they come in.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2 font-medium">Submitted</th>
                  <th className="p-2 font-medium">Submitter</th>
                  {fields.map(f => (
                    <th key={f.key} className="p-2 font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="p-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {submissions.map(s => {
                  const a = s.answers ?? {}
                  return (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap p-2 text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {s.member_id ? 'Member' : s.submitter_email || 'Anonymous'}
                      </td>
                      {fields.map(f => (
                        <td key={f.key} className="p-2">
                          {cell(a[f.key])}
                        </td>
                      ))}
                      <td className="p-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => onDeleteSubmission(s.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
