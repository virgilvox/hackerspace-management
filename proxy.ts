import { updateSession } from '@/lib/supabase/proxy'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Shape `@supabase/ssr` passes to `setAll` (typing lost to the ssr/js version drift). */
type CookiesToSet = { name: string; value: string; options: CookieOptions }[]

// Public routes are reachable without an authenticated session. The
// /resources subsite is the legacy hackerspace.sh content baked in; the
// five individual resource routes (/zine, /governance, /space-after-dark,
// /proposal-duel, /atlas) must keep these exact paths so existing deep
// links and bookmarks survive the domain switch-over.
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/join',
  // Public anonymous-incident status lookup by reporter token.
  '/track',
  // Only the OAuth callback + email-change confirm are anonymous (the link
  // is clicked from an email, no session); scope to exact routes so a
  // future /auth/* page is not silently public.
  '/auth/callback',
  '/auth/confirm',
  '/api/health',
  // Stripe calls this unauthenticated; it is verified by the per-space
  // webhook signature, not a session. Must NOT be redirected to /login
  // (Stripe does not follow redirects). Scoped to the webhook path only —
  // the Stripe server actions are invoked from authenticated pages.
  '/api/stripe/webhook',
  // The notification dispatcher is hit by the droplet's crontab (no
  // session); it enforces its own CRON_SECRET shared-secret header.
  // Scoped to the exact route so a future /api/cron/* without its own
  // secret is not exposed.
  '/api/cron/notifications',
  // Door inbound-log poll, also crontab-driven; enforces its own CRON_SECRET.
  // Scoped to the exact route.
  '/api/cron/door-ingest',
  // Per-connection inbound door-event webhook. Called by a controller/relay
  // with no session; each request is authenticated by the connection's bearer
  // secret in the route handler. The [connection] segment varies, so this is a
  // prefix match (every /api/door/inbound/* path is session-exempt and must
  // self-authenticate).
  '/api/door/inbound',
  // Public form / waiver fill page. Only /f/[slug] lives here and must be
  // reachable anonymously (the page serves only published public forms and
  // submitForm enforces visibility). The /forms* management routes do NOT
  // match the '/f/' prefix and stay auth-gated.
  '/f',
  // Public documentation site. /docs and every /docs/<category>/<slug> page are
  // static, read-only marketing/help content and must be reachable anonymously
  // (they render no member data). Screenshots under /docs-media/* are static
  // image files and already bypass the middleware via the matcher below.
  '/docs',
  '/resources',
  '/zine',
  '/governance',
  '/space-after-dark',
  '/proposal-duel',
  '/atlas',
  '/atlas.html',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always update session to refresh cookies
  const response = await updateSession(request)

  // Allow public routes through without auth check
  const isPublic =
    pathname === '/' ||
    PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))

  if (isPublic) {
    return response
  }

  // For protected routes, check auth
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
