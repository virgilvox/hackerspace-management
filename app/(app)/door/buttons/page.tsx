import { requireDoorManagerPage } from '@/lib/door-guard'
import { listApiButtons, listSecretTitles, listApiCallLog } from '@/lib/actions'
import { PERMISSIONS } from '@/lib/permissions-catalog'
import { ApiButtonsClient } from './api-buttons-client'

export const dynamic = 'force-dynamic'

export default async function ApiButtonsPage() {
  await requireDoorManagerPage()

  const [buttons, secrets, log] = await Promise.all([
    listApiButtons(),
    listSecretTitles(),
    listApiCallLog(),
  ])

  return (
    <ApiButtonsClient
      initial={'data' in buttons ? (buttons.data as unknown[]) : []}
      secrets={'data' in secrets ? (secrets.data as { id: string; title: string }[]) : []}
      log={'data' in log ? (log.data as unknown[]) : []}
      permissions={PERMISSIONS.map(p => ({ code: p.code, label: p.label }))}
    />
  )
}
