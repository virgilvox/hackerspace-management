'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth-helpers'

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
