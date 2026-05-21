// Pure, dependency-free logic for the universal API-call buttons (Door epic
// phase 5). No Supabase/React/Next/fetch. The security-relevant part -- where
// the secret is injected (query param / custom header / bearer) and how the
// request is assembled -- lives here so it is unit-tested in isolation; the
// executor (lib/door/executor.ts callApi) consumes the result and performs the
// hardened SSRF egress.

export type ApiAuthMode = 'none' | 'query' | 'header' | 'bearer'
export const API_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export type ApiMethod = (typeof API_METHODS)[number]

export type BuiltApiRequest = {
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
}

// Assemble the outbound request. The secret (decrypted server-side, never from
// the client) is placed per auth_mode: a query param (name = authParam), a
// custom header (name = authParam), or an Authorization: Bearer header. A body
// is only carried for verbs that take one. Header keys are lower-cased so the
// caller cannot smuggle a second Host/host that would survive the executor's
// forced host (the executor also forces host last as defense-in-depth).
export function buildApiRequest(opts: {
  baseUrl: string
  urlTemplate?: string | null
  method: string
  headers?: Record<string, string> | null
  body?: string | null
  authMode: ApiAuthMode
  authParam?: string | null
  secret?: string | null
}): BuiltApiRequest {
  const method = opts.method.toUpperCase()
  let url = opts.baseUrl + (opts.urlTemplate ?? '')

  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    const key = k.trim().toLowerCase()
    if (key && key !== 'host') headers[key] = v
  }

  if (opts.secret) {
    if (opts.authMode === 'query' && opts.authParam) {
      const sep = url.includes('?') ? '&' : '?'
      url += `${sep}${encodeURIComponent(opts.authParam)}=${encodeURIComponent(opts.secret)}`
    } else if (opts.authMode === 'header' && opts.authParam) {
      headers[opts.authParam.trim().toLowerCase()] = opts.secret
    } else if (opts.authMode === 'bearer') {
      headers['authorization'] = `Bearer ${opts.secret}`
    }
  }

  const body = method === 'GET' || method === 'HEAD' ? null : (opts.body ?? null)
  return { method, url, headers, body }
}
