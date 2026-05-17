// Pure projection logic for the anonymous incident tracking page. No deps so
// it is unit-testable. The single rule that matters here is REDACTION: a
// holder of a reporter token is not authenticated and must never see
// board-only notes, internal decision-maker ids, named subjects, or anything
// beyond their own report's status and the official updates meant for them.

export const INCIDENT_STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  under_review: 'Under review',
  decided: 'Decided',
  appealed: 'Appealed',
  closed: 'Closed',
}

// Updates a token holder may see. board_only is intentionally excluded.
const VISIBLE_UPDATE_VISIBILITIES = ['reporter_only', 'all_parties'] as const

export interface RawIncident {
  title: string
  body: string
  category: string
  severity: string
  status: string
  disposition: string | null
  created_at: string
  acknowledged_at: string | null
  decided_at: string | null
  closed_at: string | null
}

export interface RawUpdate {
  body: string
  author_name: string | null
  visibility: string
  created_at: string
}

export interface PublicIncidentView {
  title: string
  body: string
  category: string
  severity: string
  status: string
  statusLabel: string
  createdAt: string
  acknowledgedAt: string | null
  decidedAt: string | null
  closedAt: string | null
  // Only surfaced once a decision exists — never leak an in-progress lean.
  disposition: string | null
  updates: { body: string; author: string; createdAt: string }[]
}

export function visibleUpdate(visibility: string): boolean {
  return (VISIBLE_UPDATE_VISIBILITIES as readonly string[]).includes(visibility)
}

export function publicIncidentView(
  incident: RawIncident,
  updates: RawUpdate[],
): PublicIncidentView {
  const decisionReached = incident.status === 'decided' || incident.status === 'closed'
  return {
    title: incident.title,
    body: incident.body,
    category: incident.category,
    severity: incident.severity,
    status: incident.status,
    statusLabel: INCIDENT_STATUS_LABELS[incident.status] ?? incident.status,
    createdAt: incident.created_at,
    acknowledgedAt: incident.acknowledged_at,
    decidedAt: incident.decided_at,
    closedAt: incident.closed_at,
    disposition: decisionReached ? incident.disposition : null,
    updates: updates
      .filter(u => visibleUpdate(u.visibility))
      .map(u => ({
        body: u.body,
        author: u.author_name ?? 'Space team',
        createdAt: u.created_at,
      })),
  }
}
