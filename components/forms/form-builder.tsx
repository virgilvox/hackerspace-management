'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SectionTitle } from '@/components/ui/page-title'
import { useConfirm } from '@/components/ui/confirm'
import { toast } from 'sonner'
import {
  createForm,
  updateForm,
  setFormStatus,
  deleteForm,
} from '@/lib/actions'
import { formFieldTypes } from '@/lib/validations'
import type { FormField } from '@/lib/forms-schema'
import { slugify, deriveFieldKeys } from '@/lib/forms-logic'
import { FormRenderer } from './form-renderer'

type Kind = 'form' | 'waiver'
type Visibility = 'public_anon' | 'public_auth' | 'members'
type Status = 'draft' | 'published' | 'closed'

export type BuilderForm = {
  id?: string
  slug: string
  title: string
  description: string
  kind: Kind
  visibility: Visibility
  legal_text: string
  status?: Status
  schema: FormField[]
}

const TYPE_LABELS: Record<(typeof formFieldTypes)[number], string> = {
  short_text: 'Text',
  long_text: 'Paragraph',
  email: 'Email',
  number: 'Number',
  date: 'Date',
  checkbox: 'Checkbox',
  select: 'Dropdown',
  radio: 'Choice',
}

const deriveKeys = (fields: FormField[]): FormField[] => deriveFieldKeys(fields)

export function FormBuilder({ initial }: { initial: BuilderForm }) {
  const router = useRouter()
  const confirm = useConfirm()
  const isEdit = Boolean(initial.id)

  const [slug, setSlug] = useState(initial.slug)
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [kind, setKind] = useState<Kind>(initial.kind)
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility)
  const [legalText, setLegalText] = useState(initial.legal_text)
  const [fields, setFields] = useState<FormField[]>(initial.schema)
  const [preview, setPreview] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)

  function onTitle(v: string) {
    setTitle(v)
    if (!isEdit && !slugTouched) setSlug(slugify(v, '-'))
  }

  function addField(type: (typeof formFieldTypes)[number]) {
    setFields(f => [
      ...f,
      {
        key: '',
        type,
        label: `Untitled ${TYPE_LABELS[type]}`,
        required: false,
        options: type === 'select' || type === 'radio' ? ['Option 1'] : undefined,
      },
    ])
  }

  function patch(i: number, p: Partial<FormField>) {
    setFields(f => f.map((x, idx) => (idx === i ? { ...x, ...p } : x)))
  }

  function move(i: number, dir: -1 | 1) {
    setFields(f => {
      const j = i + dir
      if (j < 0 || j >= f.length) return f
      const next = [...f]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function removeField(i: number) {
    const ok = await confirm({
      title: 'Remove this field?',
      description: 'It will be gone from the form. Save to make it permanent.',
      destructive: true,
      confirmText: 'Remove',
    })
    if (ok) setFields(f => f.filter((_, idx) => idx !== i))
  }

  async function save() {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    const schema = deriveKeys(fields)
    const common = {
      title: title.trim(),
      description: description.trim() || null,
      visibility,
      schema,
      legal_text: kind === 'waiver' ? legalText : null,
    }
    const res = isEdit
      ? await updateForm({ formId: initial.id, ...common })
      : await createForm({ slug, kind, ...common })
    setSaving(false)

    if ('error' in res && res.error) {
      toast.error(res.error || 'Could not save')
      return
    }
    toast.success(isEdit ? 'Form saved' : 'Form created')
    router.push('/forms')
    router.refresh()
  }

  async function changeStatus(status: Status) {
    setBusy(true)
    const res = await setFormStatus({ formId: initial.id, status })
    setBusy(false)
    if ('error' in res && res.error) {
      toast.error(res.error || 'Could not update')
      return
    }
    toast.success(`Form ${status}`)
    router.refresh()
  }

  async function remove() {
    const ok = await confirm({
      title: 'Delete this form?',
      description: 'This cannot be undone. Forms with submissions cannot be deleted.',
      destructive: true,
      confirmText: 'Delete',
    })
    if (!ok) return
    setBusy(true)
    const res = await deleteForm({ formId: initial.id })
    setBusy(false)
    if ('error' in res && res.error) {
      toast.error(res.error || 'Could not delete')
      return
    }
    toast.success('Form deleted')
    router.push('/forms')
    router.refresh()
  }

  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/f/${initial.slug}` : `/f/${initial.slug}`

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Editor */}
      <div className="space-y-6">
        {isEdit && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <Badge variant={initial.status === 'published' ? 'default' : 'secondary'}>
              {initial.status}
            </Badge>
            {initial.status !== 'published' && (
              <Button size="sm" disabled={busy} onClick={() => changeStatus('published')}>
                Publish
              </Button>
            )}
            {initial.status === 'published' && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => changeStatus('closed')}>
                Close
              </Button>
            )}
            {initial.status !== 'draft' && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => changeStatus('draft')}>
                Back to draft
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={remove}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        )}

        {isEdit && initial.status === 'published' && visibility !== 'members' && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <span className="truncate font-mono text-xs">{publicUrl}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard?.writeText(publicUrl)
                toast.success('Link copied')
              }}
            >
              Copy link
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <SectionTitle>Form details</SectionTitle>
          <div className="space-y-1.5">
            <Label htmlFor="fb-title">Title</Label>
            <Input id="fb-title" value={title} onChange={e => onTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-slug">Link slug</Label>
            <Input
              id="fb-slug"
              value={slug}
              disabled={isEdit}
              onChange={e => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
            />
            {isEdit ? (
              <p className="text-xs text-muted-foreground">The slug cannot change after creation.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Public address: /f/{slug || '…'}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-desc">Description</Label>
            <Textarea
              id="fb-desc"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fb-kind">Type</Label>
              <select
                id="fb-kind"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
                value={kind}
                disabled={isEdit}
                onChange={e => setKind(e.target.value as Kind)}
              >
                <option value="form">Form</option>
                <option value="waiver">Waiver</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fb-vis">Who can submit</Label>
              <select
                id="fb-vis"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={visibility}
                onChange={e => setVisibility(e.target.value as Visibility)}
              >
                <option value="members">Members only</option>
                <option value="public_auth">Anyone signed in</option>
                <option value="public_anon">Anyone (no account)</option>
              </select>
            </div>
          </div>
          {kind === 'waiver' && (
            <div className="space-y-1.5">
              <Label htmlFor="fb-legal">Waiver / consent text</Label>
              <Textarea
                id="fb-legal"
                rows={5}
                value={legalText}
                onChange={e => setLegalText(e.target.value)}
                placeholder="The legal text the signer must agree to. Snapshotted into every signature."
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <SectionTitle>Fields</SectionTitle>
          {fields.map((f, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="shrink-0">
                  {TYPE_LABELS[f.type]}
                </Badge>
                <Input
                  aria-label={`Field ${i + 1} label`}
                  value={f.label}
                  onChange={e => patch(i, { label: e.target.value })}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Move down"
                  disabled={i === fields.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove field"
                  className="text-destructive"
                  onClick={() => removeField(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {(f.type === 'select' || f.type === 'radio') && (
                <div className="space-y-1.5 pl-1">
                  {(f.options ?? []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <Input
                        aria-label={`Option ${oi + 1}`}
                        value={opt}
                        onChange={e =>
                          patch(i, {
                            options: (f.options ?? []).map((o, k) => (k === oi ? e.target.value : o)),
                          })
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Remove option"
                        onClick={() =>
                          patch(i, { options: (f.options ?? []).filter((_, k) => k !== oi) })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => patch(i, { options: [...(f.options ?? []), `Option ${(f.options?.length ?? 0) + 1}`] })}
                  >
                    <Plus className="size-4" /> Add option
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2 pl-1">
                <Checkbox
                  id={`req-${i}`}
                  checked={f.required === true}
                  onCheckedChange={c => patch(i, { required: c === true })}
                />
                <Label htmlFor={`req-${i}`} className="font-normal">
                  Required
                </Label>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            {formFieldTypes.map(t => (
              <Button key={t} size="sm" variant="outline" onClick={() => addField(t)}>
                <Plus className="size-4" /> {TYPE_LABELS[t]}
              </Button>
            ))}
          </div>
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create form'}
        </Button>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-4 h-fit space-y-3 rounded-lg border p-4">
        <SectionTitle>Live preview</SectionTitle>
        <h2 className="text-lg font-semibold">{title || 'Untitled form'}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {kind === 'waiver' && legalText && (
          <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{legalText}</div>
        )}
        <FormRenderer
          fields={deriveKeys(fields)}
          values={preview}
          onChange={(k, v) => setPreview(p => ({ ...p, [k]: v }))}
          idPrefix="pv"
        />
        {kind === 'waiver' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" disabled /> I agree to the waiver above
          </label>
        )}
      </div>
    </div>
  )
}
