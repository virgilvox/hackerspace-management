'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPolicy } from '@/lib/actions'

export function NewPolicyForm() {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [sectionRef, setSectionRef] = useState('')
  const [bodyFormal, setBodyFormal] = useState('')
  const [bodyPlain, setBodyPlain] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const result = await createPolicy({
      slug,
      title,
      section_ref: sectionRef || null,
      body_formal: bodyFormal,
      body_plain: bodyPlain || null,
    })

    if ('error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    router.push(`/policies/${slug}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded border border-border p-5">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
            Slug
          </label>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            maxLength={80}
            required
            pattern="[a-z0-9-]+"
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
            placeholder="bylaws"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
            Section reference (optional)
          </label>
          <input
            type="text"
            value={sectionRef}
            onChange={e => setSectionRef(e.target.value)}
            maxLength={80}
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
            placeholder="Article III §2"
          />
        </div>
      </div>

      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={200}
          required
          className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          placeholder="Bylaws"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
          Plain-language summary (optional)
        </label>
        <textarea
          value={bodyPlain}
          onChange={e => setBodyPlain(e.target.value)}
          rows={4}
          maxLength={100000}
          className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          placeholder="In short: be excellent to each other and pay your dues."
        />
      </div>

      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
          Formal text
        </label>
        <textarea
          value={bodyFormal}
          onChange={e => setBodyFormal(e.target.value)}
          rows={16}
          maxLength={100000}
          className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary font-mono"
          placeholder="WHEREAS..."
        />
      </div>

      {error && <p className="font-mono text-xs text-red-500">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/policies"
          className="font-sans text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || !slug.trim() || !title.trim()}
          className="bg-primary text-white font-sans text-sm font-medium px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save as draft v1'}
        </button>
      </div>
    </form>
  )
}
