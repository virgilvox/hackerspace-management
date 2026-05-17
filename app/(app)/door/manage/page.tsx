import { requireDoorManagerPage } from '@/lib/door-guard'
import { listDoorConnections, listSecretTitles, listDoorAccessLog } from '@/lib/actions'
import { DoorManageClient } from './door-manage-client'

export const dynamic = 'force-dynamic'

export default async function DoorManagePage() {
  const { supabase, member } = await requireDoorManagerPage()

  const { data: canOperate } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'door.operate',
  })

  const [conns, secrets, log] = await Promise.all([
    listDoorConnections(),
    listSecretTitles(),
    listDoorAccessLog(),
  ])

  return (
    <DoorManageClient
      initial={'data' in conns ? (conns.data as unknown[]) : []}
      secrets={'data' in secrets ? (secrets.data as { id: string; title: string }[]) : []}
      log={'data' in log ? (log.data as unknown[]) : []}
      canOperate={!!canOperate}
    />
  )
}
