'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { fileIncident } from '@/lib/actions'
import { incidentSeverities } from '@/lib/validations'

type Member = { id: string; display_name: string | null }

export function IncidentForm({ members }: { members: Member[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')
  const [severity, setSeverity] = useState<string>('medium')
  const [subjects, setSubjects] = useState<string[]>([])
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  function toggleSubject(id: string) {
    setSubjects(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const result = await fileIncident({
      title,
      body,
      category,
      severity,
      subjects,
      is_anonymous: isAnonymous,
    })

    if ('error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    if (isAnonymous && 'token' in result && result.token) {
      setToken(result.token as string)
      setSubmitting(false)
      return
    }

    if ('data' in result && result.data) {
      router.push(`/incidents/${(result.data as { id: string }).id}`)
    } else {
      router.push('/incidents')
    }
  }

  if (token) {
    return (
      <div className="bg-card rounded border border-border p-5 space-y-3">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Report filed anonymously</p>
        <p className="font-sans text-sm text-foreground">
          Save this tracking token. It is the only way to look the report up later. We never email
          or display it elsewhere.
        </p>
        <pre className="bg-background border border-border rounded p-3 font-mono text-sm break-all">{token}</pre>
        <p className="font-sans text-sm text-muted-foreground">
          Check the status any time at{' '}
          <Link href={`/track?token=${encodeURIComponent(token)}`} className="text-primary underline">
            /track
          </Link>{' '}
          with this code. Bookmark it now.
        </p>
        <Link
          href="/incidents"
          className="inline-block bg-primary text-white font-sans text-sm font-medium px-4 py-2 rounded hover:bg-primary/90 transition"
        >
          Done
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded border border-border p-5">
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
          placeholder="Brief summary"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
          What happened
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={8}
          maxLength={20000}
          required
          className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          placeholder="When, where, who was present, what was said or done."
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
            Category
          </label>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            maxLength={50}
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
            placeholder="general, safety, harassment, theft..."
          />
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">
            Severity
          </label>
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value)}
            className="w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
          >
            {incidentSeverities.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-2">
          Subjects (optional)
        </label>
        <div className="bg-background border border-border rounded p-3 max-h-48 overflow-y-auto">
          {members.length === 0 ? (
            <p className="font-sans text-xs text-muted-foreground">No other members in the space.</p>
          ) : (
            members.map(m => (
              <label key={m.id} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={subjects.includes(m.id)}
                  onChange={() => toggleSubject(m.id)}
                  className="rounded border-border"
                />
                <span className="font-sans">{m.display_name ?? 'Unnamed'}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={e => setIsAnonymous(e.target.checked)}
            className="rounded border-border mt-0.5"
          />
          <span className="font-sans">
            File anonymously. Your name is omitted from the record. You will get a tracking
            token in exchange. Be aware: an admin with direct database access can still see
            the row exists; this is not cryptographic anonymity.
          </span>
        </label>
      </div>

      {error && <p className="font-mono text-xs text-red-500">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/incidents"
          className="font-sans text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || !title.trim() || !body.trim()}
          className="bg-primary text-white font-sans text-sm font-medium px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'File report'}
        </button>
      </div>
    </form>
  )
}
