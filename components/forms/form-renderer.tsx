'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { FormField } from '@/lib/forms-schema'

// Renders a form's field schema as a controlled, fillable form. Shared by the
// builder's live preview and the public /f/[slug] page so the two can never
// drift.
export function FormRenderer({
  fields,
  values,
  onChange,
  disabled,
  idPrefix = 'f',
}: {
  fields: FormField[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  disabled?: boolean
  idPrefix?: string
}) {
  if (fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No fields yet. Add one to see it here.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {fields.map(field => {
        const id = `${idPrefix}-${field.key}`
        const v = values[field.key]
        return (
          <div key={field.key} className="space-y-1.5">
            {field.type !== 'checkbox' && (
              <Label htmlFor={id}>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
            )}

            {field.type === 'short_text' && (
              <Input
                id={id}
                value={(v as string) ?? ''}
                disabled={disabled}
                onChange={e => onChange(field.key, e.target.value)}
              />
            )}

            {field.type === 'long_text' && (
              <Textarea
                id={id}
                rows={4}
                value={(v as string) ?? ''}
                disabled={disabled}
                onChange={e => onChange(field.key, e.target.value)}
              />
            )}

            {field.type === 'email' && (
              <Input
                id={id}
                type="email"
                value={(v as string) ?? ''}
                disabled={disabled}
                onChange={e => onChange(field.key, e.target.value)}
              />
            )}

            {field.type === 'number' && (
              <Input
                id={id}
                type="number"
                value={v === undefined || v === null ? '' : String(v)}
                disabled={disabled}
                onChange={e => onChange(field.key, e.target.value)}
              />
            )}

            {field.type === 'date' && (
              <Input
                id={id}
                type="date"
                value={(v as string) ?? ''}
                disabled={disabled}
                onChange={e => onChange(field.key, e.target.value)}
              />
            )}

            {field.type === 'checkbox' && (
              <div className="flex items-start gap-2">
                <Checkbox
                  id={id}
                  checked={v === true}
                  disabled={disabled}
                  onCheckedChange={c => onChange(field.key, c === true)}
                />
                <Label htmlFor={id} className="font-normal leading-snug">
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </Label>
              </div>
            )}

            {field.type === 'select' && (
              <select
                id={id}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50"
                value={(v as string) ?? ''}
                disabled={disabled}
                onChange={e => onChange(field.key, e.target.value)}
              >
                <option value="">Select…</option>
                {(field.options ?? []).map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}

            {field.type === 'radio' && (
              <div className="space-y-1.5" role="radiogroup" aria-label={field.label}>
                {(field.options ?? []).map(o => (
                  <label key={o} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={id}
                      value={o}
                      checked={v === o}
                      disabled={disabled}
                      onChange={() => onChange(field.key, o)}
                    />
                    {o}
                  </label>
                ))}
              </div>
            )}

            {field.help && field.type !== 'checkbox' && (
              <p className="text-xs text-muted-foreground">{field.help}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
