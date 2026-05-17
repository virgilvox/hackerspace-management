import { TrackClient } from './track-client'

export const dynamic = 'force-dynamic'

// Public, unauthenticated. An anonymous incident reporter pastes the tracking
// token they were given at filing time to see their report's status and the
// official updates meant for them. /track is in middleware PUBLIC_ROUTES.
export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return (
    <main className="mx-auto max-w-xl p-4 md:p-10">
      <h1 className="text-2xl font-semibold">Track a report</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the tracking code you were given when you filed an anonymous report. It is the
        only way to look the report up — we cannot recover it for you.
      </p>
      <div className="mt-6">
        <TrackClient initialToken={token ?? ''} autoSubmit={Boolean(token)} />
      </div>
    </main>
  )
}
