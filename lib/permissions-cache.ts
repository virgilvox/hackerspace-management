import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Request-scoped memoized permission check. The same (uid, sid, perm) is
// resolved at most once per server render, so the layout and the page it
// renders no longer double-round-trip the `user_has_permission` RPC for
// overlapping permissions (e.g. door.manage / forms.manage). Semantics are
// identical to calling the RPC directly -- this only dedupes, it does NOT
// reimplement permission logic (that stays in the SQL function + RLS).
export const hasPermission = cache(
  async (uid: string, sid: string, perm: string): Promise<boolean> => {
    const supabase = await createClient()
    const { data } = await supabase.rpc('user_has_permission', { uid, sid, perm })
    return !!data
  },
)
