'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { toast } from 'sonner'
import { exportFormResultsCsv } from '@/lib/actions'
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
  submissions,
}: {
  formId: string
  title: string
  fields: FormField[]
  submissions: Submission[]
}) {
  const [exporting, setExporting] = useState(false)

  async function exportCsv() {
    setExporting(true)
    const res = await exportFormResultsCsv({ formId })
    setExporting(false)
    if ('error' in res && res.error) {
      toast.error(res.error || 'Export failed')
      return
    }
    const { filename, csv } = res.data
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
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
        <Button size="sm" onClick={exportCsv} disabled={exporting || submissions.length === 0}>
          <Download className="size-4" /> {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
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
