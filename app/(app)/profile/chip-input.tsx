'use client'

import { useState, type KeyboardEvent } from 'react'

type Props = {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  maxLength?: number
  maxItems?: number
  suggestions?: string[]
}

/**
 * Minimal chip / token input. Press Enter or comma to commit the current
 * value. Backspace on an empty input removes the last chip. Optional
 * suggestion list shows un-used suggestions as click-to-add chips below.
 */
export function ChipInput({
  values,
  onChange,
  placeholder,
  maxLength = 80,
  maxItems = 50,
  suggestions,
}: Props) {
  const [draft, setDraft] = useState('')

  function commit(raw: string) {
    const v = raw.trim()
    if (!v) return
    if (values.includes(v)) return
    if (values.length >= maxItems) return
    onChange([...values, v.slice(0, maxLength)])
    setDraft('')
  }

  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      e.preventDefault()
      onChange(values.slice(0, -1))
    }
  }

  const remainingSuggestions = (suggestions ?? []).filter(s => !values.includes(s))

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 bg-background border border-border rounded px-2 py-1.5 focus-within:border-primary">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 bg-muted rounded px-2 py-0.5 font-mono text-xs"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
          placeholder={values.length === 0 ? placeholder : ''}
          maxLength={maxLength}
          className="flex-1 min-w-[120px] bg-transparent text-foreground font-sans text-sm py-1 px-1 focus:outline-none"
        />
      </div>
      {remainingSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {remainingSuggestions.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              className="font-mono text-[10px] tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-primary rounded px-2 py-0.5"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
