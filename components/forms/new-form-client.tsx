'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FORM_TEMPLATES, type FormTemplate } from '@/lib/form-templates'
import { FormBuilder } from './form-builder'

// Template chooser shown first on /forms/new. Picking a template just seeds
// builder state (no DB row until the builder saves).
export function NewFormClient({ spaceSlug }: { spaceSlug: string }) {
  const [tpl, setTpl] = useState<FormTemplate | null>(null)

  if (tpl) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setTpl(null)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Choose a different template
        </button>
        <FormBuilder
          initial={{
            spaceSlug,
            slug: '',
            title: tpl.id === 'blank' ? '' : tpl.name,
            description: '',
            kind: tpl.kind,
            visibility: 'members',
            legal_text: tpl.legal_text,
            schema: tpl.schema,
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Start from a template or a blank form. You can change everything afterwards.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {FORM_TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => setTpl(t)}
            className="rounded-lg border p-4 text-left transition hover:border-primary"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{t.name}</span>
              {t.kind === 'waiver' && <Badge variant="secondary">Waiver</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
          </button>
        ))}
      </div>
      <Button variant="ghost" onClick={() => setTpl(FORM_TEMPLATES[0])}>
        Skip — start blank
      </Button>
    </div>
  )
}
