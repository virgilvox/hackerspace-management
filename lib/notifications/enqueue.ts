// Shared notifications-outbox helpers used by every enqueue site (the Stripe
// webhook, equipment/classes/forms server actions). Resolving the recipient
// from a member id and writing the idempotent outbox row are the only two
// things every caller needs to do; rendering and dedupe-key construction stay
// in lib/notifications-logic.ts (pure, unit-tested).
//
// enqueueNotification is BEST-EFFORT: it never throws into the caller. The
// money path can write its ledger and finalize status even if the
// notifications table or email infra is wedged; a missed enqueue is
// acceptable, a wedged calling path is not. The (space_id, dedupe_key)
// unique index makes duplicate enqueues a no-op via ignoreDuplicates.

import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type MemberContact = {
  email: string | null
  displayName: string | null
}

// Look up a member's email + display_name, scoped to the given space. Used
// by every enqueue site to derive a recipient from a member id. Returns null
// if the member is not in that space (cross-tenant safety: the (id, space_id)
// filter pins the lookup) OR if the lookup itself fails (best-effort: never
// throws into the calling action, so a transient DB error cannot turn a
// successful domain mutation into a client-visible error).
export async function resolveMemberContact(
  admin: AdminClient,
  spaceId: string,
  memberId: string,
): Promise<MemberContact | null> {
  try {
    const { data } = await admin
      .from('space_members')
      .select('email, display_name')
      .eq('id', memberId)
      .eq('space_id', spaceId)
      .maybeSingle()
    if (!data) return null
    return {
      email: (data.email as string | null) ?? null,
      displayName: (data.display_name as string | null) ?? null,
    }
  } catch (e) {
    console.error('[notifications] resolveMemberContact threw:', e instanceof Error ? e.message : e)
    return null
  }
}

export type EnqueueParams = {
  spaceId: string
  // null when the notification is not tied to a single member (e.g. a future
  // admin broadcast). For member-personal notifications this is the affected
  // member; for fan-outs (one row per recipient admin) it is the admin's id.
  memberId: string | null
  type: string
  recipient: string
  subject: string
  bodyHtml: string
  bodyText: string
  dedupeKey: string
}

// Idempotent best-effort outbox write. Never throws. The (space_id,
// dedupe_key) unique index collapses replays.
export async function enqueueNotification(
  admin: AdminClient,
  params: EnqueueParams,
): Promise<void> {
  try {
    if (!params.recipient || !params.recipient.includes('@')) return
    const { error } = await admin.from('notifications').upsert(
      {
        space_id: params.spaceId,
        member_id: params.memberId,
        type: params.type,
        channel: 'email',
        recipient: params.recipient,
        subject: params.subject,
        body_html: params.bodyHtml,
        body_text: params.bodyText,
        status: 'pending',
        dedupe_key: params.dedupeKey,
      },
      { onConflict: 'space_id,dedupe_key', ignoreDuplicates: true },
    )
    if (error) {
      console.error(`[notifications] enqueue ${params.type} failed:`, error.message)
    }
  } catch (e) {
    console.error(
      `[notifications] enqueue ${params.type} threw:`,
      e instanceof Error ? e.message : e,
    )
  }
}

// Read the space's name once per caller. Used for brand-neutral copy that
// injects the space name (this is a generic multi-space platform; never
// hard-code a tenant). Returns empty string on miss or on lookup failure
// (best-effort, same rationale as resolveMemberContact); the renderers all
// fall back to "your hackerspace" so the email still composes.
export async function getSpaceName(admin: AdminClient, spaceId: string): Promise<string> {
  try {
    const { data } = await admin.from('spaces').select('name').eq('id', spaceId).maybeSingle()
    return (data?.name as string | null) ?? ''
  } catch (e) {
    console.error('[notifications] getSpaceName threw:', e instanceof Error ? e.message : e)
    return ''
  }
}

// Build the member portal URL the way every enqueue site does. Header host
// takes precedence (lets a request to a non-canonical host link back to
// itself); otherwise falls back to NEXT_PUBLIC_APP_URL and finally the prod
// default. Same shape as the existing dues path.
export function buildManageUrl(host?: string | null, proto?: string | null): string {
  if (host) return `${proto || 'https'}://${host}/me`
  return `${process.env.NEXT_PUBLIC_APP_URL || 'https://hackerspace.sh'}/me`
}
