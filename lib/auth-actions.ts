'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { checkRateLimit, sanitizeString, sanitizeSlug } from '@/lib/security'
import { ACTIVE_STATUSES } from '@/lib/permissions'
import { claimInviteUse } from '@/lib/invite-claim'

function generateInviteCode() {
  // Cryptographically random, and wider (8 chars) so the code space is not
  // brute-forceable under the joinSpace rate limit.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const prefix = 'HSL'
  const year = new Date().getFullYear()
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length]
  return `${prefix}-${year}-${code}`
}

export async function createSpace(formData: {
  spaceName: string
  spaceSlug: string
  spaceCity?: string
  displayName: string
}) {
  // Verify user is authenticated using regular client
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) return { error: 'Not authenticated' }

  // Rate limit space creation
  const rateLimit = checkRateLimit(`createspace:${user.id}`, 3, 3600000) // 3 per hour
  if (!rateLimit.allowed) {
    return { error: 'Too many space creation attempts. Please try again later.' }
  }

  // Sanitize inputs
  const spaceName = sanitizeString(formData.spaceName).slice(0, 100)
  const spaceSlug = sanitizeSlug(formData.spaceSlug)
  const spaceCity = formData.spaceCity ? sanitizeString(formData.spaceCity).slice(0, 100) : null
  const displayName = sanitizeString(formData.displayName).slice(0, 100)

  if (!spaceName || !spaceSlug || !displayName) {
    return { error: 'Invalid input. Please check your entries.' }
  }

  // Use admin client for inserts (bypasses RLS)
  const admin = createAdminClient()

  // Check if slug already exists
  const { data: existingSpace } = await admin
    .from('spaces')
    .select('id')
    .eq('slug', spaceSlug)
    .maybeSingle()

  if (existingSpace) {
    return { error: 'A space with this URL slug already exists. Please choose a different one.' }
  }

  // Create the space
  const { data: space, error: spaceErr } = await admin
    .from('spaces')
    .insert({
      name: spaceName,
      slug: spaceSlug,
      city: spaceCity,
      invite_code: generateInviteCode(),
    })
    .select('id')
    .single()

  if (spaceErr || !space) {
    if (spaceErr?.code === '23505') {
      return { error: 'A space with this URL slug already exists. Please choose a different one.' }
    }
    return { error: spaceErr?.message ?? 'Failed to create space' }
  }

  // Add user as admin. The founder configures the space; they do not go
  // through the member onboarding flow, so mark it complete up front.
  const { error: memberErr } = await admin
    .from('space_members')
    .insert({
      space_id: space.id,
      user_id: user.id,
      display_name: displayName || user.email,
      email: user.email,
      role: 'admin',
      tier: 'plus',
      status: 'current',
      approved: true,
      onboarding_completed_at: new Date().toISOString(),
    })

  if (memberErr) {
    return { error: memberErr.message }
  }

  return { success: true }
}

export async function joinSpace(formData: {
  inviteCode: string
  displayName: string
}) {
  // Verify user is authenticated
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) return { error: 'Not authenticated' }

  // Throttle to bound invite-code guessing (parity with createSpace/signIn).
  const rateLimit = checkRateLimit(`joinspace:${user.id}`, 10, 3600000) // 10 per hour
  if (!rateLimit.allowed) {
    return { error: 'Too many join attempts. Please try again later.' }
  }

  // Use admin client for operations
  const admin = createAdminClient()

  const code = formData.inviteCode.trim().toUpperCase()

  // Try the new multi-code invites table first. Falls back to the legacy
  // spaces.invite_code (a permanent default) if the code isn't found there.
  const { data: inviteRow } = await admin
    .from('space_invites')
    .select('id, space_id, max_uses, uses_count, expires_at, is_enabled, role')
    .eq('code', code)
    .maybeSingle()
  const invite = inviteRow

  let spaceId: string | null = null
  if (invite) {
    if (!invite.is_enabled) return { error: 'This invite is disabled.' }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { error: 'This invite has expired.' }
    if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) return { error: 'This invite has reached its use cap.' }
    spaceId = invite.space_id
  } else {
    const { data: legacy } = await admin
      .from('spaces')
      .select('id')
      .eq('invite_code', code)
      .maybeSingle()
    if (!legacy) return { error: 'Invalid invite code' }
    spaceId = legacy.id
  }

  const { data: space, error: lookupErr } = await admin
    .from('spaces')
    .select('id, require_approval')
    .eq('id', spaceId)
    .single()

  if (lookupErr || !space) return { error: 'Invalid invite code' }

  // Honor the invite's granted role (default 'member' for the legacy
  // spaces.invite_code path or any invite created before migration 029).
  // Validated against the enum defensively even though the DB constrains it.
  const grantedRole =
    invite && ['admin', 'board', 'treasurer', 'member', 'associate'].includes(invite.role)
      ? invite.role
      : 'member'

  // Single active membership per user (the product's locked single-space
  // model; getAuthMember's .single() fails closed on 2+). Reject a second
  // join rather than letting it self-DoS the user out of every action.
  const { data: existingMembership } = await admin
    .from('space_members')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ACTIVE_STATUSES)
    .maybeSingle()
  if (existingMembership) {
    return { error: 'You are already a member of a space.' }
  }

  // Claim an invite use ATOMICALLY before creating the membership, so a
  // single-use invite can never be redeemed twice under concurrent joins.
  // (The pre-check above is a fast UX reject; this is the authoritative guard.)
  let claimedCount: number | null = null
  if (invite) {
    claimedCount = await claimInviteUse(admin, invite.id, invite.uses_count, invite.max_uses)
    if (claimedCount === null) return { error: 'This invite has reached its use cap.' }
  }

  const { data: newMember, error: memberErr } = await admin
    .from('space_members')
    .insert({
      space_id: space.id,
      user_id: user.id,
      display_name: formData.displayName || user.email,
      email: user.email,
      role: grantedRole,
      tier: 'basic',
      status: space.require_approval ? 'unverified' : 'current',
      approved: true,
    })
    .select('id')
    .single()

  if (memberErr) {
    // Roll back the claimed use (best-effort, CAS-guarded) so a failed join
    // does not burn an invite slot.
    if (invite && claimedCount !== null) {
      await admin
        .from('space_invites')
        .update({ uses_count: claimedCount - 1 })
        .eq('id', invite.id)
        .eq('uses_count', claimedCount)
    }
    return { error: memberErr.message }
  }

  // Retro-link prior anonymous form/waiver submissions in this space to the
  // new member, but only for a verified email (locked decision). Best-effort:
  // a linking hiccup must never fail the join.
  if (newMember && user.email && user.email_confirmed_at) {
    await admin
      .from('form_submissions')
      .update({ member_id: newMember.id })
      .eq('space_id', space.id)
      .is('member_id', null)
      .eq('submitter_email', user.email.toLowerCase())
  }

  return { success: true }
}

export async function signIn(email: string, password: string) {
  // Rate limit by email to prevent brute force
  const rateLimit = checkRateLimit(`signin:${email.toLowerCase()}`, 5, 60000)
  if (!rateLimit.allowed) {
    return { error: 'Too many login attempts. Please try again later.' }
  }

  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function signUp(formData: {
  email: string
  password: string
  fullName: string
  action: 'create' | 'join'
  spaceName?: string
  spaceSlug?: string
  city?: string
  inviteCode?: string
}) {
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        full_name: formData.fullName,
        action: formData.action,
        space_name: formData.spaceName,
        space_slug: formData.spaceSlug,
        city: formData.city,
        invite_code: formData.inviteCode,
      },
    },
  })

  if (authError) {
    return { error: authError.message }
  }

  return { data: authData }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  return user
}

export async function getCurrentMembership() {
  const supabase = await createClient()
  const user = await getUser()
  
  if (!user) return null

  const { data, error } = await supabase
    .from('space_members')
    .select('*, spaces(*)')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .maybeSingle()

  if (error || !data) return null

  return data
}
