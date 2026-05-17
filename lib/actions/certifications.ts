'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  requireMember,
  logActivity,
  parseInput,
  type Member,
  type ServerSupabase,
} from '@/lib/auth-helpers'
import {
  createCertificationSchema,
  updateCertificationSchema,
  certificationIdSchema,
  grantCertificationSchema,
  revokeCertificationSchema,
  renewCertificationSchema,
  listMemberCertificationsSchema,
} from '@/lib/validations'
import { computeExpiry } from '@/lib/certifications-logic'

type Gate =
  | { ok: true; supabase: ServerSupabase; member: Member }
  | { ok: false; error: string }

// Permission gate. Errors here are advisory UX; the RLS on certifications /
// member_certifications independently enforces the same permission, so a
// bypass cannot write.
async function requirePermission(perm: 'certifications.manage' | 'certifications.grant'): Promise<Gate> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { ok: false, error: auth.error }
  const { member } = auth

  const { data: allowed, error } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm,
  })
  if (error) return { ok: false, error: error.message }
  if (!allowed) {
    return {
      ok: false,
      error:
        perm === 'certifications.manage'
          ? 'You do not have permission to manage certification types'
          : 'You do not have permission to award or revoke certifications',
    }
  }
  return { ok: true, supabase, member }
}

function isUniqueViolation(message: string): boolean {
  return /duplicate key value|already exists|unique constraint/i.test(message)
}

// ─── Certification types (certifications.manage) ─────────────────────────────

export async function createCertification(input: unknown) {
  const gate = await requirePermission('certifications.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(createCertificationSchema, input)
  if (!v.ok) return { error: v.error }
  const c = v.data

  const { data, error } = await supabase
    .from('certifications')
    .insert({
      space_id: member.space_id,
      name: c.name,
      description: c.description ?? null,
      validity_months: c.validity_months ?? null,
      created_by: member.id,
    })
    .select('id')
    .single()

  if (error) {
    if (isUniqueViolation(error.message)) {
      return { error: 'A certification with that name already exists in this space.' }
    }
    return { error: error.message }
  }

  await logActivity(supabase, member, 'created', 'certification', data.id as string, c.name)
  revalidatePath('/certifications')
  return { data: { id: data.id as string } }
}

export async function updateCertification(input: unknown) {
  const gate = await requirePermission('certifications.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(updateCertificationSchema, input)
  if (!v.ok) return { error: v.error }
  const u = v.data

  const patch: Record<string, unknown> = {}
  if (u.name !== undefined) patch.name = u.name
  if (u.description !== undefined) patch.description = u.description ?? null
  if (u.validity_months !== undefined) patch.validity_months = u.validity_months ?? null
  if (u.is_active !== undefined) patch.is_active = u.is_active
  if (Object.keys(patch).length === 0) return { data: { id: u.certificationId } }

  const { error } = await supabase
    .from('certifications')
    .update(patch)
    .eq('id', u.certificationId)
    .eq('space_id', member.space_id)

  if (error) {
    if (isUniqueViolation(error.message)) {
      return { error: 'A certification with that name already exists in this space.' }
    }
    return { error: error.message }
  }

  await logActivity(supabase, member, 'updated', 'certification', u.certificationId)
  revalidatePath('/certifications')
  return { data: { id: u.certificationId } }
}

export async function deleteCertification(input: unknown) {
  const gate = await requirePermission('certifications.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(certificationIdSchema, input)
  if (!v.ok) return { error: v.error }

  // A cert that has ever been granted is part of members' records; archive it
  // (is_active=false) instead of destroying history.
  const { count } = await supabase
    .from('member_certifications')
    .select('id', { count: 'exact', head: true })
    .eq('certification_id', v.data.certificationId)
  if ((count ?? 0) > 0) {
    return { error: 'This certification has been granted to members. Archive it instead of deleting.' }
  }

  const { error } = await supabase
    .from('certifications')
    .delete()
    .eq('id', v.data.certificationId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'deleted', 'certification', v.data.certificationId)
  revalidatePath('/certifications')
  return { data: { id: v.data.certificationId } }
}

// Readable by anyone who can manage OR grant (the admin list and the per-member
// award panel both need the catalog). RLS already scopes to the caller's space.
export async function listCertifications() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data: allowed } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'certifications.manage',
  })
  let permitted = !!allowed
  if (!permitted) {
    const { data: canGrant } = await supabase.rpc('user_has_permission', {
      uid: member.user_id as string,
      sid: member.space_id,
      perm: 'certifications.grant',
    })
    permitted = !!canGrant
  }
  if (!permitted) return { error: 'You do not have permission to view certifications' }

  const { data, error } = await supabase
    .from('certifications')
    .select('id, name, description, validity_months, is_active, created_at, updated_at')
    .eq('space_id', member.space_id)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// ─── Grants (certifications.grant — the Instructor capability) ───────────────

export async function grantCertification(input: unknown) {
  const gate = await requirePermission('certifications.grant')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(grantCertificationSchema, input)
  if (!v.ok) return { error: v.error }
  const g = v.data

  // Cert must exist, be in this space, and be active.
  const { data: cert, error: certErr } = await supabase
    .from('certifications')
    .select('id, name, validity_months, is_active, space_id')
    .eq('id', g.certificationId)
    .eq('space_id', member.space_id)
    .single()
  if (certErr || !cert) return { error: 'Certification not found' }
  if (!cert.is_active) return { error: 'That certification is archived and cannot be granted.' }

  // Target member must be in the same space.
  const { data: target, error: targetErr } = await supabase
    .from('space_members')
    .select('id, space_id, display_name')
    .eq('id', g.memberId)
    .eq('space_id', member.space_id)
    .single()
  if (targetErr || !target) return { error: 'Member not found in this space' }

  const grantedAt = new Date().toISOString()
  const expiresAt = g.expires_at ?? computeExpiry(grantedAt, cert.validity_months)

  const { data, error } = await supabase
    .from('member_certifications')
    .insert({
      space_id: member.space_id,
      member_id: g.memberId,
      certification_id: g.certificationId,
      granted_by: member.id,
      granted_at: grantedAt,
      expires_at: expiresAt,
      note: g.note ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (isUniqueViolation(error.message)) {
      return { error: 'This member already holds an active grant of that certification.' }
    }
    return { error: error.message }
  }

  await logActivity(supabase, member, 'granted', 'certification', g.certificationId, cert.name)
  revalidatePath('/members')
  revalidatePath('/me')
  return { data: { id: data.id as string } }
}

export async function revokeCertification(input: unknown) {
  const gate = await requirePermission('certifications.grant')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(revokeCertificationSchema, input)
  if (!v.ok) return { error: v.error }

  const { data: grant, error: loadErr } = await supabase
    .from('member_certifications')
    .select('id, space_id, revoked_at, certification_id')
    .eq('id', v.data.memberCertificationId)
    .eq('space_id', member.space_id)
    .single()
  if (loadErr || !grant) return { error: 'Grant not found' }
  if (grant.revoked_at) return { error: 'That certification is already revoked.' }

  const { error } = await supabase
    .from('member_certifications')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: member.id,
      revoked_reason: v.data.reason ?? null,
    })
    .eq('id', v.data.memberCertificationId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'revoked', 'certification', grant.certification_id as string)
  revalidatePath('/members')
  revalidatePath('/me')
  return { data: { id: v.data.memberCertificationId } }
}

// Renew a still-valid or expired (but not revoked) grant: reset granted_at to
// now and recompute expiry from the cert's current validity. A revoked grant
// is terminal — issue a fresh grant instead.
export async function renewCertification(input: unknown) {
  const gate = await requirePermission('certifications.grant')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(renewCertificationSchema, input)
  if (!v.ok) return { error: v.error }

  const { data: grant, error: loadErr } = await supabase
    .from('member_certifications')
    .select('id, space_id, revoked_at, certification_id, note')
    .eq('id', v.data.memberCertificationId)
    .eq('space_id', member.space_id)
    .single()
  if (loadErr || !grant) return { error: 'Grant not found' }
  if (grant.revoked_at) return { error: 'That certification is revoked. Grant a new one instead.' }

  const { data: cert, error: certErr } = await supabase
    .from('certifications')
    .select('validity_months, name')
    .eq('id', grant.certification_id as string)
    .eq('space_id', member.space_id)
    .single()
  if (certErr || !cert) return { error: 'Certification not found' }

  const grantedAt = new Date().toISOString()
  const { error } = await supabase
    .from('member_certifications')
    .update({
      granted_at: grantedAt,
      expires_at: computeExpiry(grantedAt, cert.validity_months),
      granted_by: member.id,
      note: v.data.note ?? grant.note ?? null,
    })
    .eq('id', v.data.memberCertificationId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'renewed', 'certification', grant.certification_id as string, cert.name)
  revalidatePath('/members')
  revalidatePath('/me')
  return { data: { id: v.data.memberCertificationId } }
}

// All grants for one member (the per-member award panel). Manager or granter.
export async function listMemberCertifications(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const v = parseInput(listMemberCertificationsSchema, input)
  if (!v.ok) return { error: v.error }

  const { data: canManage } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'certifications.manage',
  })
  let permitted = !!canManage
  if (!permitted) {
    const { data: canGrant } = await supabase.rpc('user_has_permission', {
      uid: member.user_id as string,
      sid: member.space_id,
      perm: 'certifications.grant',
    })
    permitted = !!canGrant
  }
  if (!permitted) return { error: 'You do not have permission to view member certifications' }

  const { data, error } = await supabase
    .from('member_certifications')
    .select(
      'id, member_id, certification_id, granted_at, expires_at, revoked_at, revoked_reason, note, certifications(name, validity_months, is_active)',
    )
    .eq('space_id', member.space_id)
    .eq('member_id', v.data.memberId)
    .order('granted_at', { ascending: false })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// The signed-in member's own certifications (the /me view). No params: the
// member is resolved from the session, and RLS independently allows a member
// to read only their own grants.
export async function getMyCertifications() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('member_certifications')
    .select(
      'id, certification_id, granted_at, expires_at, revoked_at, revoked_reason, note, certifications(name, description, validity_months)',
    )
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .order('granted_at', { ascending: false })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}
