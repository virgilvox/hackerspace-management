import { requireDoorManagerPage } from '@/lib/door-guard'
import { listDoorConnections, listSecretTitles, listDoorAccessLog } from '@/lib/actions'
import { DoorManageClient } from './door-manage-client'

export const dynamic = 'force-dynamic'

export default async function DoorManagePage() {
  await requireDoorManagerPage()

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
    />
  )
}
