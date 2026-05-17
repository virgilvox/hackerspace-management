import { updateSession } from '@/lib/supabase/proxy'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  '/auth',
  '/api/health',
  // Public form / waiver fill page. Only /f/[slug] lives here and must be
  // reachable anonymously (the page serves only published public forms and
  // submitForm enforces visibility). The /forms* management routes do NOT
  // match the '/f/' prefix and stay auth-gated.
  '/f',
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
        setAll(cookiesToSet) {
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
