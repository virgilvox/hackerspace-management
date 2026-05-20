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

// The caller's own notification history. The notifications RLS SELECT is
// admin/board/treasurer only (mirrors member_billing), so the member
// self-view goes through the validated service client, same as getMyBilling.
export async function getMyNotifications() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data } = await createAdminClient()
    .from('notifications')
    .select('id, type, subject, status, created_at, sent_at')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .order('created_at', { ascending: false })
    .limit(15)

  return {
    data: (data ?? []).map(r => ({
      id: r.id as string,
      type: r.type as string,
      subject: r.subject as string,
      status: r.status as string,
      createdAt: r.created_at as string,
      sentAt: (r.sent_at as string | null) ?? null,
    })),
  }
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
