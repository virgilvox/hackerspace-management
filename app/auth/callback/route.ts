import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Only a same-origin absolute path is an allowed post-login target.
// Rejects open-redirect vectors: protocol-relative (//evil.com),
// backslash tricks (/\evil.com), and any scheme/host.
function safeNext(raw: string | null): string {
  const fallback = '/dashboard'
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return fallback
  }
  return raw
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`)
}
