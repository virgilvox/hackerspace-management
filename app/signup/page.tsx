'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createSpace, joinSpace } from '@/lib/auth-actions'
import { tenantConfig } from '@/lib/tenant'

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const prefix = 'HSL'
  const year = new Date().getFullYear()
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${prefix}-${year}-${code}`
}

export default function SignupPage() {
  const router = useRouter()
  // Single-tenant instances host one space: there is no "create a space" path,
  // so signup always means "join THE space". Preselect join and hide the
  // chooser. createSpace is also refused server-side (defense in depth).
  const tenant = tenantConfig()
  const [step, setStep] = useState<'account' | 'space'>('account')
  const [isReturningUser, setIsReturningUser] = useState(false)
  const [mode, setMode] = useState<'create' | 'join' | null>(tenant.singleTenant ? 'join' : null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [spaceName, setSpaceName] = useState('')
  const [spaceSlug, setSpaceSlug] = useState('')
  const [spaceCity, setSpaceCity] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // A shared invite link looks like /signup?invite=CODE. Prefill the code
    // and preselect "join" so the recipient lands on the right form.
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')
    if (invite) {
      setInviteCode(invite.trim().toUpperCase())
      setMode('join')
    }
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email || '')
        setFullName(user.user_metadata?.full_name || '')
        setIsReturningUser(true)
        setStep('space')
      }
    }
    checkAuth()
  }, [])

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mode) { setError('Please select create or join a space'); return }
    setError('')
    setStep('space')
  }

  async function handleSpaceSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mode) return
    setLoading(true)
    setError('')

    // Returning user — already has a session, just create/join
    if (isReturningUser) {
      const result = mode === 'create'
        ? await createSpace({ spaceName, spaceSlug, spaceCity, displayName: fullName })
        : await joinSpace({ inviteCode, displayName: fullName })

      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }
      // Hard navigate so server layout re-reads cookies fresh
      window.location.href = '/dashboard'
      return
    }

    // New user — sign up; trigger will create space/member
    const supabase = createClient()

    if (mode === 'join') {
      // Invite code is validated server-side in joinSpace (uses admin client, bypasses RLS).
      // Do NOT pre-validate here with the regular client — RLS blocks unauthenticated lookups.
    }

    const metadata: Record<string, string> = {
      full_name: fullName,
      space_action: mode,
      ...(mode === 'create'
        ? { space_name: spaceName, space_slug: spaceSlug, space_city: spaceCity, invite_code: generateInviteCode() }
        : { join_invite_code: inviteCode.trim().toUpperCase() }
      ),
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: metadata,
      },
    })

    if (authError) { setError(authError.message); setLoading(false); return }

    // If Supabase returns a session immediately it means email confirmation is
    // disabled — the user is fully signed up AND signed in in one step.
    // We still need to create the space/member record via the server action.
    if (authData.session) {
      // Manually set the session so server-side cookies are flushed before
      // we call the server action (which needs auth.getUser() to succeed).
      const supabaseClient = createClient()
      await supabaseClient.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      })

      const result = mode === 'create'
        ? await createSpace({ spaceName, spaceSlug, spaceCity, displayName: fullName })
        : await joinSpace({ inviteCode, displayName: fullName })

      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      // Hard navigate so the server re-reads cookies and picks up the session
      window.location.href = '/dashboard'
      return
    }

    // Email confirmation is required — redirect to the confirm page
    router.push('/signup/confirm?email=' + encodeURIComponent(email))
  }


  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(oklch(0.4 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.4 0 0) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative z-10 w-full max-w-[860px] mx-4">
        <div className="h-1 w-full bg-[#d4f53c] rounded-t" />
        <div className="bg-[#1a1a1a] rounded-b px-10 py-10">
          <div className="mb-8">
            <span className="font-mono text-2xl font-bold">
              <span className="text-[#d4f53c]">{'{'}</span>
              <span className="text-white">{tenant.siteName}</span>
              <span className="text-[#d4f53c]">{'}'}</span>
            </span>
          </div>

          <p className="font-mono text-[11px] tracking-widest text-zinc-500 mb-6 uppercase">
            {step === 'account' ? 'Create your account' : mode === 'create' ? 'Set up your Space' : mode === 'join' ? 'Join a Space' : 'Choose an option'}
            {isReturningUser && step === 'space' && (
              <span className="ml-2 normal-case text-zinc-600">({email})</span>
            )}
          </p>

          {step === 'account' ? (
            <form onSubmit={handleAccountSubmit}>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Moheeb Zara"
                    required
                    className="w-full bg-[#232323] border border-[#333] text-white font-mono text-sm rounded px-3 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-[#d4f53c] transition"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@space.org"
                    required
                    className="w-full bg-[#232323] border border-[#333] text-white font-mono text-sm rounded px-3 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-[#d4f53c] transition"
                  />
                </div>
              </div>

              <div className="mb-8">
                <label className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="min 8 characters"
                  required
                  minLength={8}
                  className="w-full bg-[#232323] border border-[#333] text-white font-mono text-sm rounded px-3 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-[#d4f53c] transition"
                />
              </div>

              {!tenant.singleTenant && (
              <>
              <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase mb-3">
                What are you doing?
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className={`p-6 rounded border-2 transition text-left ${
                    mode === 'create'
                      ? 'border-[#d4f53c] bg-[#232323]'
                      : 'border-[#333] bg-[#1a1a1a] hover:border-[#555]'
                  }`}
                >
                  <div className="mb-3">
                    <svg className="w-8 h-8 text-[#d4f53c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="font-mono font-bold text-white mb-1">Create a Space</p>
                  <p className="font-mono text-xs text-zinc-500">set up a new hackerspace</p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('join')}
                  className={`p-6 rounded border-2 transition text-left ${
                    mode === 'join'
                      ? 'border-[#d4f53c] bg-[#232323]'
                      : 'border-[#333] bg-[#1a1a1a] hover:border-[#555]'
                  }`}
                >
                  <div className="mb-3">
                    <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <p className="font-mono font-bold text-white mb-1">Join a Space</p>
                  <p className="font-mono text-xs text-zinc-500">use an invite code</p>
                </button>
              </div>
              </>
              )}

              {error && <p className="font-mono text-xs text-red-400 mb-4">{error}</p>}

              <button
                type="submit"
                disabled={!mode}
                className="w-full bg-[#d4f53c] text-black font-mono text-sm font-bold tracking-widest uppercase py-3 rounded hover:bg-[#c5e635] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSpaceSubmit}>
              {/* Mode picker - show inline for returning users who haven't selected yet */}
              {!mode && (
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <button
                    type="button"
                    onClick={() => setMode('create')}
                    className="p-6 rounded border-2 border-[#333] bg-[#1a1a1a] hover:border-[#d4f53c] transition text-left"
                  >
                    <div className="mb-3">
                      <svg className="w-8 h-8 text-[#d4f53c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="font-mono font-bold text-white mb-1">Create a Space</p>
                    <p className="font-mono text-xs text-zinc-500">set up a new hackerspace</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('join')}
                    className="p-6 rounded border-2 border-[#333] bg-[#1a1a1a] hover:border-[#d4f53c] transition text-left"
                  >
                    <div className="mb-3">
                      <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </div>
                    <p className="font-mono font-bold text-white mb-1">Join a Space</p>
                    <p className="font-mono text-xs text-zinc-500">use an invite code</p>
                  </button>
                </div>
              )}

              {mode === 'create' ? (
                <div className="space-y-4 mb-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase block mb-1">
                        Space Name
                      </label>
                      <input
                        type="text"
                        value={spaceName}
                        onChange={e => {
                          setSpaceName(e.target.value)
                          setSpaceSlug(
                            e.target.value.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
                          )
                        }}
                        placeholder="HeatSync Labs"
                        required
                        className="w-full bg-[#232323] border border-[#333] text-white font-mono text-sm rounded px-3 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-[#d4f53c] transition"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase block mb-1">
                        Slug
                      </label>
                      <input
                        type="text"
                        value={spaceSlug}
                        onChange={e => setSpaceSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                        placeholder="heatsynclabs"
                        required
                        pattern="[a-z0-9]+"
                        title="Lowercase letters and numbers only"
                        className="w-full bg-[#232323] border border-[#333] text-white font-mono text-sm rounded px-3 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-[#d4f53c] transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase block mb-1">
                      City / Location (Optional)
                    </label>
                    <input
                      type="text"
                      value={spaceCity}
                      onChange={e => setSpaceCity(e.target.value)}
                      placeholder="Mesa, AZ"
                      className="w-full bg-[#232323] border border-[#333] text-white font-mono text-sm rounded px-3 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-[#d4f53c] transition"
                    />
                  </div>
                  <div className="bg-[#232323] border border-[#333] rounded p-4">
                    <p className="font-mono text-[10px] text-zinc-500 mb-1">You&apos;ll be the admin of this space.</p>
                    <p className="font-mono text-[10px] text-zinc-500">Default channels (general, announcements, ops) will be created automatically.</p>
                  </div>
                </div>
              ) : tenant.singleTenant && tenant.openJoin ? (
                <div className="mb-6 bg-[#232323] border border-[#333] rounded p-4">
                  <p className="font-mono text-[10px] text-zinc-500 mb-1">
                    You&apos;re joining <span className="text-white">{tenant.siteName}</span>.
                  </p>
                  <p className="font-mono text-[10px] text-zinc-500">
                    An administrator may need to approve your membership before you gain full access.
                  </p>
                </div>
              ) : (
                <div className="mb-6">
                  <label className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase block mb-1">
                    Invite Code
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="HSL-2025-XXXX"
                    required
                    className="w-full bg-[#232323] border border-[#333] text-white font-mono text-sm rounded px-3 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-[#d4f53c] transition"
                  />
                  <p className="font-mono text-[10px] text-zinc-600 mt-1.5">Ask your space admin for the invite code from Settings.</p>
                </div>
              )}

              {error && <p className="font-mono text-xs text-red-400 mb-4">{error}</p>}

              <div className="flex gap-3">
                  {!isReturningUser && (
                    <button
                      type="button"
                      onClick={() => { setStep('account'); setError('') }}
                      className="px-6 bg-[#232323] border border-[#333] text-white font-mono text-sm py-3 rounded hover:border-[#555] transition"
                    >
                      Back
                    </button>
                  )}
                  {mode && (
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-[#d4f53c] text-black font-mono text-sm font-bold tracking-widest uppercase py-3 rounded hover:bg-[#c5e635] transition disabled:opacity-60"
                    >
                      {loading ? 'Please wait...' : mode === 'create' ? 'Create Space →' : 'Join Space →'}
                    </button>
                  )}
                </div>
            </form>
          )}

          {!isReturningUser && (
            <p className="text-center font-mono text-xs text-zinc-600 mt-6">
              already have an account?{' '}
              <Link href="/login" className="text-[#d4f53c] hover:underline">
                sign in →
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
