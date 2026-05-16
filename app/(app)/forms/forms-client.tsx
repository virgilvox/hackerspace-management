'use client'

import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'

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

export function FormsClient({ forms }: { forms: FormRow[] }) {
  return (
    <>
      <PageHeader>
        <PageTitle>Forms &amp; waivers</PageTitle>
        <Button asChild size="sm">
          <Link href="/forms/new">
            <Plus className="size-4" /> New form
          </Link>
        </Button>
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
                  <p className="font-mono text-xs text-muted-foreground">/f/{f.slug}</p>
                </div>
                <Badge variant="outline">{VIS_LABEL[f.visibility] ?? f.visibility}</Badge>
                <Badge variant={f.status === 'published' ? 'default' : 'secondary'}>
                  {f.status}
                </Badge>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/forms/${f.id}/results`}>Results</Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/forms/${f.id}/edit`}>Edit</Link>
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
