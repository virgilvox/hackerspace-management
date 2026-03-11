'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { checkRateLimit, sanitizeString, sanitizeSlug } from '@/lib/security'

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const prefix = 'HSL'
  const year = new Date().getFullYear()
  let code = ''
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
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

  // Add user as admin
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

  // Use admin client for operations
  const admin = createAdminClient()

  const { data: space, error: lookupErr } = await admin
    .from('spaces')
    .select('id, require_approval')
    .eq('invite_code', formData.inviteCode.trim().toUpperCase())
    .single()

  if (lookupErr || !space) return { error: 'Invalid invite code' }

  const { error: memberErr } = await admin
    .from('space_members')
    .insert({
      space_id: space.id,
      user_id: user.id,
      display_name: formData.displayName || user.email,
      email: user.email,
      role: 'member',
      tier: 'basic',
      status: space.require_approval ? 'unverified' : 'current',
      approved: true,
    })

  if (memberErr) return { error: memberErr.message }

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
