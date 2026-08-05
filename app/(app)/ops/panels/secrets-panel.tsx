'use client'

import { Lock } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from '@/components/ui/empty'
import { SecretRow } from '../components/secret-row'
import type { AclRoleOption, Secret } from '../types'

// ─── Secrets & Credentials Panel ───────────────────────────────────────────────
export function SecretsPanel({
  canSeeSecrets,
  secrets,
  search,
  onAdd,
  onDelete,
  canManageAcl,
  aclRoleOptions,
  aclByEntity,
}: {
  canSeeSecrets: boolean
  secrets: Secret[]
  search: string
  onAdd: () => void
  onDelete: (id: string) => void
  canManageAcl?: boolean
  aclRoleOptions?: AclRoleOption[]
  aclByEntity?: Record<string, string[]>
}) {
  return (
    <div>
      {!canSeeSecrets ? (
        <Empty className="bg-card border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Lock /></EmptyMedia>
            <EmptyTitle>Admin or board access required to view secrets</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : secrets.length > 0 ? (
        <div className="bg-card rounded border border-border divide-y divide-border">
          {secrets.map(s => (
            <SecretRow
              key={s.id}
              secret={s}
              onDelete={onDelete}
              canManageAcl={canManageAcl}
              aclRoleOptions={aclRoleOptions}
              aclInitial={aclByEntity?.[`secret:${s.id}`] ?? []}
            />
          ))}
        </div>
      ) : (
        <Empty className="bg-card border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Lock /></EmptyMedia>
            <EmptyTitle>
              {search ? `No results for "${search}"` : 'No secrets stored yet'}
            </EmptyTitle>
          </EmptyHeader>
          {!search && (
            <EmptyContent>
              <button
                onClick={onAdd}
                className="font-mono text-xs text-primary hover:underline"
              >
                + Add first secret
              </button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </div>
  )
}
