'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { useConfirm } from '@/components/ui/confirm'
import { CopyLinkButton } from '@/components/forms/copy-link-button'
import { deleteForm, relinkAllSubmissions } from '@/lib/actions'

type FormRow = {
  id: string
  slug: string
  title: string
  kind: string
  visibility: string
  status: string
  version: number
  created_at: string
}

const VIS_LABEL: Record<string, string> = {
  members: 'Members only',
  public_auth: 'Signed in',
  public_anon: 'Public',
}

export function FormsClient({ forms: initial, spaceSlug }: { forms: FormRow[]; spaceSlug: string }) {
  const confirm = useConfirm()
  const [forms, setForms] = useState<FormRow[]>(initial)
  const [busy, setBusy] = useState(false)

  async function onRelink() {
    setBusy(true)
    const res = await relinkAllSubmissions()
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    const n = (res as { data: { linked: number } }).data.linked
    toast.success(n > 0 ? `Linked ${n} submission(s) to members` : 'All submissions already linked')
  }

  async function onDelete(f: FormRow) {
    const ok = await confirm({
      title: `Delete "${f.title}"?`,
      description:
        'This permanently deletes the form AND every response/submission for it, including any signed waivers. This cannot be undone. Export the results first if you need a record.',
      confirmText: 'Delete form and all responses',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    const res = await deleteForm({ formId: f.id, confirm: true })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    setForms(prev => prev.filter(x => x.id !== f.id))
    toast.success('Form deleted')
  }

  return (
    <>
      <PageHeader>
        <PageTitle>Forms &amp; waivers</PageTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={onRelink}>
            Re-link submissions
          </Button>
          <Button asChild size="sm">
            <Link href="/forms/new">
              <Plus className="size-4" /> New form
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="p-4 md:p-6">
        {forms.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>No forms yet</EmptyTitle>
              <EmptyDescription>
                Build a custom form or a signable waiver. Members-only or public, your choice.
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild>
              <Link href="/forms/new">
                <Plus className="size-4" /> Create your first form
              </Link>
            </Button>
          </Empty>
        ) : (
          <div className="divide-y rounded-lg border">
            {forms.map(f => (
              <div key={f.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/forms/${f.id}/edit`} className="font-medium hover:underline">
                      {f.title}
                    </Link>
                    {f.kind === 'waiver' && <Badge variant="secondary">Waiver</Badge>}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {f.visibility === 'members'
                      ? 'Members-only (filled from the in-app Forms page)'
                      : `/f/${spaceSlug}/${f.slug}`}
                  </p>
                </div>
                <Badge variant="outline">{VIS_LABEL[f.visibility] ?? f.visibility}</Badge>
                <Badge variant={f.status === 'published' ? 'default' : 'secondary'}>
                  {f.status}
                </Badge>
                <div className="flex gap-2">
                  {f.visibility !== 'members' && f.status === 'published' && (
                    <CopyLinkButton path={`/f/${spaceSlug}/${f.slug}`} />
                  )}
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/forms/${f.id}/results`}>Results</Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/forms/${f.id}/edit`}>Edit</Link>
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => onDelete(f)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
