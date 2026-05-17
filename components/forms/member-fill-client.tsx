'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FormRenderer } from '@/components/forms/form-renderer'
import { submitForm } from '@/lib/actions'
import type { FormField } from '@/lib/forms-schema'

// Authenticated member fill surface for members-only / in-app forms. The
// member is already signed in, so submitForm's visibility check passes;
// submission is by formId (slugs are per-space now).
export function MemberFillClient({
  formId,
  description,
  kind,
  legalText,
  fields,
}: {
  formId: string
  description: string | null
  kind: string
  legalText: string | null
  fields: FormField[]
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const isWaiver = kind === 'waiver'

  async function submit() {
    setError(null)
    setSubmitting(true)
    const res = await submitForm({
      formId,
      answers: values,
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
      <div className="space-y-4 rounded-lg border p-8 text-center">
        <h2 className="text-xl font-semibold">Thank you</h2>
        <p className="text-sm text-muted-foreground">Your response has been recorded.</p>
        <Button variant="secondary" onClick={() => router.push('/my-forms')}>
          Back to forms
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {description && <p className="text-muted-foreground">{description}</p>}

      {isWaiver && legalText && (
        <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">
          {legalText}
        </div>
      )}

      <FormRenderer
        fields={fields}
        values={values}
        onChange={(k, v) => setValues(p => ({ ...p, [k]: v }))}
      />

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
    </div>
  )
}
