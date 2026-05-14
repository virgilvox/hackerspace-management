import type { ProposalStatus } from '@/lib/types'

const STATUS_STYLE: Record<ProposalStatus, string> = {
  draft: 'text-muted-foreground bg-muted',
  open: 'text-primary bg-primary/10',
  decided: 'text-blue-600 bg-blue-50',
  withdrawn: 'text-muted-foreground bg-muted',
  expired: 'text-orange-600 bg-orange-50',
}

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <span className={`font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded ${STATUS_STYLE[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
