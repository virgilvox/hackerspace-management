import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Friendly, space-scoped landing for an invite link
// (/join/<spaceSlug>?code=CODE). Purely presentational: it resolves the
// space name for context and hands off to the existing, battle-tested
// /signup?invite=CODE join flow rather than reimplementing auth.
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string }>
  searchParams: Promise<{ code?: string }>
}) {
  const { space } = await params
  const { code } = await searchParams

  const admin = createAdminClient()
  const { data: spaceRow } = await admin
    .from('spaces')
    .select('name')
    .eq('slug', space)
    .maybeSingle()

  if (!spaceRow) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-semibold">Invite link not valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This space could not be found. Check the link or ask whoever invited you for a new one.
        </p>
      </main>
    )
  }

  const signupHref = code
    ? `/signup?invite=${encodeURIComponent(code)}`
    : '/signup'

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-semibold">Join {spaceRow.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You have been invited to join {spaceRow.name}
        {code ? ' with an invite code' : ''}. Create an account or sign in to continue.
      </p>
      <Link
        href={signupHref}
        className="mt-6 inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
      >
        Continue
      </Link>
    </main>
  )
}
