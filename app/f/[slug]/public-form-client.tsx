'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormRenderer } from '@/components/forms/form-renderer'
import { submitForm } from '@/lib/actions'
import type { FormField } from '@/lib/forms-schema'

export function PublicFormClient({
  slug,
  title,
  description,
  kind,
  visibility,
  legalText,
  fields,
  authed,
}: {
  slug: string
  title: string
  description: string | null
  kind: string
  visibility: string
  legalText: string | null
  fields: FormField[]
  authed: boolean
}) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const needsSignIn = visibility === 'public_auth' && !authed
  const isWaiver = kind === 'waiver'
  const showEmail = visibility === 'public_anon'

  async function submit() {
    setError(null)
    setSubmitting(true)
    const res = await submitForm({
      slug,
      answers: values,
      email: showEmail && email ? email : undefined,
      consent: isWaiver ? consent : undefined,
    })
    setSubmitting(false)
    if ('error' in res && res.error) {
      setError(res.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <h1 className="text-xl font-semibold">Thank you</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your response has been recorded.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>

      {needsSignIn ? (
        <div className="rounded-lg border bg-muted/40 p-6 text-center">
          <p className="text-sm">You need to be signed in to submit this form.</p>
          <Button asChild className="mt-3">
            <a href={`/login?next=/f/${slug}`}>Sign in</a>
          </Button>
        </div>
      ) : (
        <>
          {isWaiver && legalText && (
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">
              {legalText}
            </div>
          )}

          <FormRenderer fields={fields} values={values} onChange={(k, v) => setValues(p => ({ ...p, [k]: v }))} />

          {showEmail && (
            <div className="space-y-1.5">
              <Label htmlFor="pf-email">Your email (optional)</Label>
              <Input
                id="pf-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used to link this to your account if you join later.
              </p>
            </div>
          )}

          {isWaiver && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-1"
              />
              I have read and agree to the terms above.
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </>
      )}
    </div>
  )
}
