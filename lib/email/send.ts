// Server-only email transport seam. One function, sendEmail. Today it talks
// to Resend's HTTP API (no SDK dependency, just fetch); a self-hosted deploy
// can replace the body of this module with SMTP without touching any caller.
// When RESEND_API_KEY / EMAIL_FROM are unset the call is a non-retryable
// no-op with a clear reason, so a fresh clone or dev box without mail config
// still runs (the dispatcher records 'failed' rather than crashing).
//
// SendResult.retryable tells the dispatcher whether to leave the row pending
// for another minute (transient: 429 / 5xx / network) or stop (config or
// validation error that a retry will not fix).

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export type SendInput = {
  to: string
  subject: string
  html: string
  text: string
  // Passed as Resend's Idempotency-Key so a dispatcher retry of the same row
  // cannot double-send (Resend dedupes for 24h on key + payload).
  idempotencyKey?: string
}

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; retryable: boolean }

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    return {
      ok: false,
      error: 'Email transport not configured (RESEND_API_KEY / EMAIL_FROM unset).',
      retryable: false,
    }
  }
  if (!input.to || !input.to.includes('@')) {
    return { ok: false, error: `Invalid recipient: ${input.to || '(empty)'}`, retryable: false }
  }

  let res: Response
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    })
  } catch (e) {
    // Network / DNS / timeout: transient, worth another attempt.
    return { ok: false, error: e instanceof Error ? e.message : 'Network error', retryable: true }
  }

  if (res.ok) {
    try {
      const body = (await res.json()) as { id?: string }
      return { ok: true, id: body.id ?? 'sent' }
    } catch {
      return { ok: true, id: 'sent' }
    }
  }

  let detail = ''
  try {
    const body = (await res.json()) as { name?: string; message?: string }
    detail = [body.name, body.message].filter(Boolean).join(': ')
  } catch {
    detail = await res.text().catch(() => '')
  }
  // 429 (rate limit) and 5xx are transient; 4xx config/validation is not.
  const retryable = res.status === 429 || res.status >= 500
  return {
    ok: false,
    error: `Resend ${res.status}${detail ? ` ${detail}` : ''}`,
    retryable,
  }
}
