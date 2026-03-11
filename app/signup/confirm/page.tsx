import Link from 'next/link'

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(oklch(0.4 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.4 0 0) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative z-10 w-full max-w-[480px] mx-4">
        <div className="h-1 w-full bg-[#d4f53c] rounded-t" />
        <div className="bg-[#1a1a1a] rounded-b px-10 py-10 text-center">
          <div className="mb-8">
            <span className="font-mono text-2xl font-bold">
              <span className="text-[#d4f53c]">{'{'}</span>
              <span className="text-white">hackerspace.sh</span>
              <span className="text-[#d4f53c]">{'}'}</span>
            </span>
          </div>

          <div className="w-16 h-16 rounded-full bg-[#d4f53c]/10 border-2 border-[#d4f53c]/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#d4f53c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <p className="font-mono text-[11px] tracking-widest text-zinc-500 mb-4 uppercase">
            Check your email
          </p>

          <p className="font-sans text-white text-lg font-semibold mb-3">
            Confirm your email address
          </p>

          <p className="font-sans text-sm text-zinc-400 leading-relaxed mb-2">
            We sent a confirmation link to
          </p>
          {email && (
            <p className="font-mono text-sm text-[#d4f53c] mb-6">{email}</p>
          )}
          <p className="font-sans text-xs text-zinc-600 mb-8 leading-relaxed">
            Click the link in the email to activate your account and set up your space. It may take a minute to arrive. Check your spam folder if you don&apos;t see it.
          </p>

          <Link
            href="/login"
            className="font-mono text-xs text-[#d4f53c] hover:underline"
          >
            Already confirmed? Sign in →
          </Link>
        </div>
      </div>
    </div>
  )
}
