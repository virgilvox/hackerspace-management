import { describe, it, expect } from 'vitest'
import {
  publicIncidentView,
  visibleUpdate,
  INCIDENT_STATUS_LABELS,
  type RawIncident,
  type RawUpdate,
} from '@/lib/incident-logic'
import { trackIncidentSchema } from '@/lib/validations'

const baseIncident: RawIncident = {
  title: 'Unsafe saw guard',
  body: 'The table saw guard is missing.',
  category: 'safety',
  severity: 'high',
  status: 'received',
  disposition: 'Removed member X for 30 days',
  created_at: '2026-05-17T00:00:00Z',
  acknowledged_at: null,
  decided_at: null,
  closed_at: null,
}

const updates: RawUpdate[] = [
  { body: 'We are looking into this.', author_name: 'Board', visibility: 'all_parties', created_at: '2026-05-17T01:00:00Z' },
  { body: 'Internal: contact insurer.', author_name: 'Chair', visibility: 'board_only', created_at: '2026-05-17T02:00:00Z' },
  { body: 'A note just for you.', author_name: null, visibility: 'reporter_only', created_at: '2026-05-17T03:00:00Z' },
]

describe('visibleUpdate', () => {
  it('allows reporter_only and all_parties, denies board_only and unknown', () => {
    expect(visibleUpdate('reporter_only')).toBe(true)
    expect(visibleUpdate('all_parties')).toBe(true)
    expect(visibleUpdate('board_only')).toBe(false)
    expect(visibleUpdate('something_else')).toBe(false)
  })
})

describe('publicIncidentView redaction', () => {
  it('drops board_only updates and keeps the rest, defaulting author', () => {
    const v = publicIncidentView(baseIncident, updates)
    expect(v.updates).toHaveLength(2)
    expect(v.updates.some(u => u.body.includes('Internal'))).toBe(false)
    const reporterNote = v.updates.find(u => u.body === 'A note just for you.')
    expect(reporterNote?.author).toBe('Space team')
  })

  it('hides disposition until a decision is reached', () => {
    expect(publicIncidentView(baseIncident, []).disposition).toBeNull()
    expect(publicIncidentView({ ...baseIncident, status: 'under_review' }, []).disposition).toBeNull()
    expect(publicIncidentView({ ...baseIncident, status: 'decided' }, []).disposition).toBe(
      'Removed member X for 30 days',
    )
    expect(publicIncidentView({ ...baseIncident, status: 'closed' }, []).disposition).toBe(
      'Removed member X for 30 days',
    )
  })

  it('exposes only the safe projection keys (no subjects/decision makers/ids)', () => {
    const v = publicIncidentView(baseIncident, [])
    expect(Object.keys(v).sort()).toEqual(
      [
        'acknowledgedAt',
        'body',
        'category',
        'closedAt',
        'createdAt',
        'decidedAt',
        'disposition',
        'severity',
        'status',
        'statusLabel',
        'title',
        'updates',
      ].sort(),
    )
  })

  it('maps status to a human label', () => {
    expect(publicIncidentView({ ...baseIncident, status: 'under_review' }, []).statusLabel).toBe(
      INCIDENT_STATUS_LABELS.under_review,
    )
    // Unknown status falls back to the raw value.
    expect(publicIncidentView({ ...baseIncident, status: 'weird' }, []).statusLabel).toBe('weird')
  })
})

describe('trackIncidentSchema', () => {
  it('trims and bounds the token', () => {
    expect(trackIncidentSchema.safeParse({ token: '  ' + 'a'.repeat(20) + '  ' }).success).toBe(true)
    expect(trackIncidentSchema.safeParse({ token: 'short' }).success).toBe(false)
    expect(trackIncidentSchema.safeParse({ token: '' }).success).toBe(false)
    expect(trackIncidentSchema.safeParse({ token: 'a'.repeat(129) }).success).toBe(false)
    expect(trackIncidentSchema.safeParse({}).success).toBe(false)
  })
})
