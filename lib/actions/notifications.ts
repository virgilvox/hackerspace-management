'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth-helpers'
import { notificationPreferenceSchema } from '@/lib/validations'
import {
  MUTEABLE_CATEGORIES,
  type NotificationCategory,
  type PrefMap,
} from '@/lib/notifications-prefs-logic'

// The caller's own notification history, plus the in-app inbox read state and
// an unread count. The notifications RLS SELECT is admin/board/treasurer only
// (mirrors member_billing), so the member self-view goes through the validated
// service client, same as getMyBilling. body_text is the plain-text message
// shown when the member expands an inbox item (never body_html, so the inbox
// never renders untrusted markup).
export async function getMyNotifications() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const admin = createAdminClient()
  const { data } = await admin
    .from('notifications')
    .select('id, type, subject, body_text, status, created_at, sent_at, read_at')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .order('created_at', { ascending: false })
    .limit(30)

  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .is('read_at', null)

  return {
    unreadCount: count ?? 0,
    data: (data ?? []).map(r => ({
      id: r.id as string,
      type: r.type as string,
      subject: r.subject as string,
      bodyText: (r.body_text as string | null) ?? '',
      status: r.status as string,
      createdAt: r.created_at as string,
      sentAt: (r.sent_at as string | null) ?? null,
      readAt: (r.read_at as string | null) ?? null,
    })),
  }
}

// Mark the caller's own notifications read (the in-app inbox). With ids, marks
// just those; without, marks all of the caller's unread. The `.eq('member_id')`
// scope means ids from another member can never be touched (the id filter only
// narrows within the caller's own rows). Service-client write, same convention
// as the rest of the notification self-view (no client write policy).
export async function markNotificationsRead(
  input: { ids?: string[] } = {},
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  let q = createAdminClient()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .is('read_at', null)

  if (input.ids && input.ids.length > 0) {
    // Defend the uuid column against a malformed client id (a non-uuid would
    // error the cast). Only well-formed ids pass; an empty result is a no-op.
    const ids = input.ids.filter(id => /^[0-9a-f-]{36}$/i.test(id))
    if (ids.length === 0) return { ok: true }
    q = q.in('id', ids)
  }

  const { error } = await q
  if (error) return { error: 'Could not update notifications' }

  revalidatePath('/me')
  return { ok: true }
}

// The caller's own notification preferences as a category -> enabled map.
// notification_preferences has no client policy (same convention as
// notifications / member_billing), so the read goes through the service client
// scoped to the caller's own member row. Absent categories are the default
// (enabled); only muteable categories are ever stored or returned.
export async function getMyNotificationPreferences(): Promise<{ data: PrefMap } | { error: string }> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data } = await createAdminClient()
    .from('notification_preferences')
    .select('category, enabled')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)

  const prefs: PrefMap = {}
  for (const c of MUTEABLE_CATEGORIES) prefs[c] = true
  for (const row of data ?? []) {
    const cat = row.category as NotificationCategory
    if ((MUTEABLE_CATEGORIES as readonly NotificationCategory[]).includes(cat)) {
      prefs[cat] = row.enabled as boolean
    }
  }
  return { data: prefs }
}

// Set one muteable category on/off for the caller. Billing is never settable
// (the Zod enum excludes it). Upserts the caller's own row through the service
// client; the (space_id, member_id, category) PK makes a re-toggle idempotent.
export async function setMyNotificationPreference(input: {
  category: string
  enabled: boolean
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const parsed = notificationPreferenceSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid notification preference' }

  const { error } = await createAdminClient()
    .from('notification_preferences')
    .upsert(
      {
        space_id: member.space_id,
        member_id: member.id,
        category: parsed.data.category,
        enabled: parsed.data.enabled,
      },
      { onConflict: 'space_id,member_id,category' },
    )
  if (error) return { error: 'Could not save preference' }

  revalidatePath('/me')
  return { ok: true }
}
