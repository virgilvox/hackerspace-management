import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listAttendance, listPresentNow } from '@/lib/actions'
import { AttendanceClient } from './attendance-client'

export const dynamic = 'force-dynamic'

export default async function AttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [presentRes, historyRes] = await Promise.all([listPresentNow(), listAttendance()])
  const present = ('data' in presentRes ? presentRes.data : []) as {
    id: string; name: string; isHost: boolean; isMe: boolean; checkedInAt: string; note: string | null
  }[]
  const history = ('data' in historyRes ? historyRes.data : []) as {
    id: string; name: string; isHost: boolean; status: 'present' | 'checked_out' | 'stale'
    checkedInAt: string; checkedOutAt: string | null; checkInNote: string | null; checkOutNote: string | null
  }[]

  return <AttendanceClient present={present} history={history} />
}
