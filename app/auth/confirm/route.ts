// Email-change confirmation landing. Supabase's "Change Email Address"
// template must point here with ?token_hash={{ .TokenHash }}&type=email_change
// (NOT the OAuth code flow — that is /auth/callback). With "Secure email
// change" on (recommended), Supabase emails BOTH the old and new address and
// the change applies to auth.users only after both links are verified; this
// route is hit once per link and is idempotent.
//
// This route does EXACTLY ONE thing: confirm an email change. The OTP type is
// pinned to 'email_change' and the query `type` is intentionally ignored — a
// public endpoint that fed an attacker-chosen type into verifyOtp would be an
// unintended auth entrypoint (recovery/magiclink/signup tokens minting a
// session here, bypassing their real flows).
//
// The denormalized space_members.email is synced from the verifyOtp response
// user (NOT a follow-up getUser(), which is not guaranteed to reflect the
// just-verified identity in this SSR request). /me additionally reconciles on
// load, so a missed sync here self-heals.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=email_change`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({
    type: 'email_change',
    token_hash: tokenHash,
  })
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=email_change`)
  }

  // Use the verifyOtp response user. On the first of two secure-change links
  // auth.users.email is still the old value (no-op sync); the second link's
  // hit carries the new email. Idempotent; /me reconciles any miss.
  const user = data.user
  if (user?.email) {
    await createAdminClient()
      .from('space_members')
      .update({ email: user.email })
      .eq('user_id', user.id)
  }

  return NextResponse.redirect(`${origin}/me?email=confirmed`)
}
