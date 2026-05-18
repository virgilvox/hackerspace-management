// Email-change confirmation landing. Supabase's "Change Email Address"
// template must point here with ?token_hash={{ .TokenHash }}&type=email_change
// (NOT the OAuth code flow — that is /auth/callback). With "Secure email
// change" on (recommended), Supabase emails BOTH the old and new address and
// the change applies to auth.users only after both links are verified; this
// route is hit once per link and is idempotent.
//
// The denormalized space_members.email is synced to the authoritative
// auth.users email ONLY here, after a successful verifyOtp — never at request
// time (the user has not proven ownership yet).
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = (searchParams.get('type') ?? 'email_change') as EmailOtpType

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=email_change`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=email_change`)
  }

  // Sync the denormalized copy to whatever auth.users now holds. On the first
  // of two secure-change links the email may still be the old one (no-op);
  // the second link's hit syncs it. Idempotent either way.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user?.email) {
    await createAdminClient()
      .from('space_members')
      .update({ email: user.email })
      .eq('user_id', user.id)
  }

  return NextResponse.redirect(`${origin}/me?email=confirmed`)
}
