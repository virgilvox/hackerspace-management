'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { oauthProviders, anyOAuthProvider } from '@/lib/auth-config'

export default function LoginPage() {
  const router = useRouter()
  const oauth = oauthProviders()
  const showOAuth = anyOAuthProvider(oauth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'github' | 'google' | null>(null)

  // Honor ?next= so a signed-out visitor to a public_auth form (or any gated
  // link) returns where they were headed. Only same-origin absolute paths are
  // allowed — never an external URL or protocol-relative // — to avoid an
  // open-redirect.
  function safeNext(): string {
    if (typeof window === 'undefined') return '/dashboard'
    const raw = new URLSearchParams(window.location.search).get('next')
    if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) {
      return raw
    }
    return '/dashboard'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push(safeNext())
      router.refresh()
    }
  }

  async function handleOAuthLogin(provider: 'github' | 'google') {
    setOauthLoading(provider)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext())}`,
      },
    })
    if (error) {
      setError(error.message)
      setOauthLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(oklch(0.4 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.4 0 0) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative z-10 w-full max-w-[460px] mx-4">
        {/* Yellow top border */}
        <div className="h-1 w-full bg-[#d4f53c] rounded-t" />
        <div className="bg-[#1a1a1a] rounded-b px-10 py-10">
          {/* Logo */}
          <div className="mb-8">
            <span className="font-mono text-2xl font-bold">
              <span className="text-[#d4f53c]">{'{'}</span>
              <span className="text-white">hackerspace.sh</span>
              <span className="text-[#d4f53c]">{'}'}</span>
            </span>
          </div>

          <p className="font-mono text-[11px] tracking-widest text-zinc-500 mb-6 uppercase">
            Sign in to your space
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase block mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="moheeb@heatsyncabs.org"
                required
                className="w-full bg-[#232323] border border-[#333] text-white font-mono text-sm rounded px-3 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-[#d4f53c] transition"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase block mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="············"
                required
                className="w-full bg-[#232323] border border-[#333] text-white font-mono text-sm rounded px-3 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-[#d4f53c] transition"
              />
            </div>

            {error && (
              <p className="font-mono text-xs text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#d4f53c] text-black font-mono text-sm font-bold tracking-widest uppercase py-3 rounded hover:bg-[#c5e635] transition disabled:opacity-60 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          {showOAuth && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#333]" />
                <span className="font-mono text-xs text-zinc-600">OR</span>
                <div className="flex-1 h-px bg-[#333]" />
              </div>

              <div className="flex gap-3">
                {oauth.github && (
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('github')}
                    disabled={oauthLoading !== null}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#232323] border border-[#333] text-white font-mono text-xs py-2.5 rounded hover:border-[#555] transition disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    {oauthLoading === 'github' ? 'Redirecting...' : 'GitHub'}
                  </button>
                )}
                {oauth.google && (
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('google')}
                    disabled={oauthLoading !== null}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#232323] border border-[#333] text-white font-mono text-xs py-2.5 rounded hover:border-[#555] transition disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {oauthLoading === 'google' ? 'Redirecting...' : 'Google'}
                  </button>
                )}
              </div>
            </>
          )}

          <p className="text-center font-mono text-xs text-zinc-600 mt-6">
            no account?{' '}
            <Link href="/signup" className="text-[#d4f53c] hover:underline">
              create or join a space →
            </Link>
          </p>
          <p className="text-center font-mono text-xs mt-4">
            <Link href="/" className="text-zinc-500 hover:text-[#d4f53c] hover:underline transition">
              ← Back to homepage
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
