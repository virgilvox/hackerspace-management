// Pure, dependency-free logic for the Door epic. No Supabase/React/Next.
// Unit-tested directly. The card UID is a credential, so the canonical
// masking lives here and is reused everywhere a non-manager could see it.

export function last4(uid: string): string {
  return uid.length <= 4 ? uid : uid.slice(-4)
}

// "••••AB12" — never reveals more than the last 4 characters. For a UID of 4
// or fewer characters nothing is revealed.
export function maskCardUid(uid: string): string {
  if (uid.length <= 4) return '•'.repeat(uid.length || 4)
  return '•'.repeat(uid.length - 4) + uid.slice(-4)
}
