import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Atomically claim one use of a multi-code invite via compare-and-swap on
 * `uses_count`, closing the check-then-increment TOCTOU where two concurrent
 * redemptions of a single-use invite could both succeed.
 *
 * The UPDATE only writes when `uses_count` still equals the value we based our
 * cap decision on, so of two racing claims exactly one wins; the loser sees a
 * 0-row result, re-reads, and retries while capacity remains. `uses_count` only
 * ever increases, so the CAS has no ABA hazard.
 *
 * Returns a discriminated result: `{ ok: true, count }` with the new
 * `uses_count` on success (the caller stores it to roll the claim back if the
 * subsequent membership insert fails), or `{ ok: false, reason }` where the
 * reason distinguishes a genuinely reached cap (`'cap_reached'`) from losing
 * the compare-and-swap on every attempt under contention (`'contention'`) so
 * the caller can surface a retryable message instead of a false cap error.
 */
export type ClaimInviteResult =
  | { ok: true; count: number }
  | { ok: false; reason: 'cap_reached' | 'contention' }

export async function claimInviteUse(
  admin: Admin,
  inviteId: string,
  knownCount: number,
  maxUses: number | null,
  maxAttempts = 5,
): Promise<ClaimInviteResult> {
  let current = knownCount
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (maxUses !== null && current >= maxUses) return { ok: false, reason: 'cap_reached' }
    const next = current + 1
    const { data } = await admin
      .from('space_invites')
      .update({ uses_count: next })
      .eq('id', inviteId)
      .eq('uses_count', current) // compare-and-swap guard
      .select('id')
    if (data && data.length > 0) return { ok: true, count: next }
    // Lost the race (or the row changed): re-read and retry while under cap.
    const { data: fresh } = await admin
      .from('space_invites')
      .select('uses_count')
      .eq('id', inviteId)
      .maybeSingle()
    if (!fresh) return { ok: false, reason: 'cap_reached' }
    current = (fresh as { uses_count: number }).uses_count
  }
  // Exhausted the attempt budget while still under cap: pure contention.
  return { ok: false, reason: 'contention' }
}
