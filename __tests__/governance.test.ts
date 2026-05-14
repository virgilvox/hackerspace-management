import { describe, it, expect } from 'vitest'
import {
  createProposalSchema,
  castVoteSchema,
  decideProposalSchema,
  withdrawProposalSchema,
  fileIncidentSchema,
  updateIncidentStatusSchema,
  addIncidentUpdateSchema,
  appealIncidentSchema,
  createPolicySchema,
  supersedePolicySchema,
  updatePolicyStatusSchema,
  proposalTypes,
  thresholdRules,
  votePositions,
  incidentSeverities,
  incidentStatuses,
  policyStatuses,
} from '@/lib/validations'

const UUID = '11111111-2222-3333-4444-555555555555'

// =============================================================================
// Proposals
// =============================================================================

describe('createProposalSchema', () => {
  it('accepts minimal valid input', () => {
    const r = createProposalSchema.safeParse({ title: 'Approve new laser station rules' })
    expect(r.success).toBe(true)
  })

  it('defaults proposal_type to advisory_poll', () => {
    const r = createProposalSchema.safeParse({ title: 'X' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.proposal_type).toBe('advisory_poll')
  })

  it('accepts every database proposal_type', () => {
    for (const t of proposalTypes) {
      const r = createProposalSchema.safeParse({ title: 'X', proposal_type: t })
      expect(r.success, `proposal_type=${t}`).toBe(true)
    }
  })

  it('rejects unknown proposal_type', () => {
    const r = createProposalSchema.safeParse({ title: 'X', proposal_type: 'referendum' })
    expect(r.success).toBe(false)
  })

  it('rejects empty title', () => {
    const r = createProposalSchema.safeParse({ title: '' })
    expect(r.success).toBe(false)
  })

  it('rejects title over 200 chars', () => {
    const r = createProposalSchema.safeParse({ title: 'x'.repeat(201) })
    expect(r.success).toBe(false)
  })

  it('accepts every threshold rule', () => {
    for (const t of thresholdRules) {
      const r = createProposalSchema.safeParse({ title: 'X', threshold: t })
      expect(r.success, `threshold=${t}`).toBe(true)
    }
  })
})

describe('castVoteSchema', () => {
  it('accepts a yes vote without recusal reason', () => {
    const r = castVoteSchema.safeParse({ proposalId: UUID, position: 'yes' })
    expect(r.success).toBe(true)
  })

  it('accepts a no, abstain vote without recusal reason', () => {
    expect(castVoteSchema.safeParse({ proposalId: UUID, position: 'no' }).success).toBe(true)
    expect(castVoteSchema.safeParse({ proposalId: UUID, position: 'abstain' }).success).toBe(true)
  })

  it('rejects a recused vote without a reason', () => {
    const r = castVoteSchema.safeParse({ proposalId: UUID, position: 'recused' })
    expect(r.success).toBe(false)
  })

  it('rejects a recused vote with an empty-string reason', () => {
    const r = castVoteSchema.safeParse({ proposalId: UUID, position: 'recused', recusal_reason: '   ' })
    expect(r.success).toBe(false)
  })

  it('accepts a recused vote with a real reason', () => {
    const r = castVoteSchema.safeParse({
      proposalId: UUID,
      position: 'recused',
      recusal_reason: 'I am a named party in the underlying incident.',
    })
    expect(r.success).toBe(true)
  })

  it('accepts every vote position', () => {
    for (const p of votePositions) {
      const r = castVoteSchema.safeParse({
        proposalId: UUID,
        position: p,
        recusal_reason: p === 'recused' ? 'reason' : undefined,
      })
      expect(r.success, `position=${p}`).toBe(true)
    }
  })

  it('rejects invalid proposal id', () => {
    expect(castVoteSchema.safeParse({ proposalId: 'nope', position: 'yes' }).success).toBe(false)
  })
})

describe('decideProposalSchema and withdrawProposalSchema', () => {
  it('require a uuid', () => {
    expect(decideProposalSchema.safeParse({ proposalId: UUID }).success).toBe(true)
    expect(decideProposalSchema.safeParse({ proposalId: 'bad' }).success).toBe(false)
    expect(withdrawProposalSchema.safeParse({ proposalId: UUID }).success).toBe(true)
    expect(withdrawProposalSchema.safeParse({ proposalId: 'bad' }).success).toBe(false)
  })
})

// =============================================================================
// Incidents
// =============================================================================

describe('fileIncidentSchema', () => {
  it('accepts minimal valid input', () => {
    const r = fileIncidentSchema.safeParse({
      title: 'Unsafe handling at laser station',
      body: 'On Tuesday, I observed...',
    })
    expect(r.success).toBe(true)
  })

  it('defaults severity to medium and category to general', () => {
    const r = fileIncidentSchema.safeParse({ title: 'x', body: 'y' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.severity).toBe('medium')
      expect(r.data.category).toBe('general')
    }
  })

  it('accepts every severity', () => {
    for (const s of incidentSeverities) {
      const r = fileIncidentSchema.safeParse({ title: 'x', body: 'y', severity: s })
      expect(r.success, `severity=${s}`).toBe(true)
    }
  })

  it('rejects empty title and body', () => {
    expect(fileIncidentSchema.safeParse({ title: '', body: 'y' }).success).toBe(false)
    expect(fileIncidentSchema.safeParse({ title: 'x', body: '' }).success).toBe(false)
  })

  it('accepts an array of subject UUIDs', () => {
    const r = fileIncidentSchema.safeParse({
      title: 'x',
      body: 'y',
      subjects: [UUID, '22222222-2222-2222-2222-222222222222'],
    })
    expect(r.success).toBe(true)
  })

  it('rejects non-uuid subject entries', () => {
    const r = fileIncidentSchema.safeParse({ title: 'x', body: 'y', subjects: ['not-a-uuid'] })
    expect(r.success).toBe(false)
  })
})

describe('updateIncidentStatusSchema', () => {
  it('accepts every status', () => {
    for (const s of incidentStatuses) {
      const r = updateIncidentStatusSchema.safeParse({ incidentId: UUID, status: s })
      expect(r.success, `status=${s}`).toBe(true)
    }
  })

  it('allows a disposition when deciding', () => {
    const r = updateIncidentStatusSchema.safeParse({
      incidentId: UUID,
      status: 'decided',
      disposition: 'No violation found.',
    })
    expect(r.success).toBe(true)
  })

  it('rejects unknown status', () => {
    expect(updateIncidentStatusSchema.safeParse({ incidentId: UUID, status: 'pending' }).success).toBe(false)
  })
})

describe('addIncidentUpdateSchema', () => {
  it('requires a body', () => {
    expect(addIncidentUpdateSchema.safeParse({ incidentId: UUID, body: '' }).success).toBe(false)
    expect(addIncidentUpdateSchema.safeParse({ incidentId: UUID, body: 'note' }).success).toBe(true)
  })

  it('defaults visibility to all_parties', () => {
    const r = addIncidentUpdateSchema.safeParse({ incidentId: UUID, body: 'note' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.visibility).toBe('all_parties')
  })

  it('rejects unknown visibility', () => {
    const r = addIncidentUpdateSchema.safeParse({
      incidentId: UUID,
      body: 'note',
      visibility: 'whisper',
    })
    expect(r.success).toBe(false)
  })
})

describe('appealIncidentSchema', () => {
  it('accepts a valid appeal payload', () => {
    const r = appealIncidentSchema.safeParse({
      incidentId: UUID,
      title: 'Appeal of dismissed complaint',
      body: 'I disagree with the board...',
    })
    expect(r.success).toBe(true)
  })

  it('rejects empty title', () => {
    expect(appealIncidentSchema.safeParse({ incidentId: UUID, title: '', body: '' }).success).toBe(false)
  })
})

// =============================================================================
// Policies
// =============================================================================

describe('createPolicySchema', () => {
  it('accepts minimal valid input', () => {
    const r = createPolicySchema.safeParse({ slug: 'code-of-conduct', title: 'Code of Conduct' })
    expect(r.success).toBe(true)
  })

  it('enforces slug character set', () => {
    expect(createPolicySchema.safeParse({ slug: 'CoC', title: 'X' }).success).toBe(false)
    expect(createPolicySchema.safeParse({ slug: 'code of conduct', title: 'X' }).success).toBe(false)
    expect(createPolicySchema.safeParse({ slug: 'code-of-conduct-2', title: 'X' }).success).toBe(true)
  })

  it('rejects empty slug and title', () => {
    expect(createPolicySchema.safeParse({ slug: '', title: 'X' }).success).toBe(false)
    expect(createPolicySchema.safeParse({ slug: 'x', title: '' }).success).toBe(false)
  })

  it('accepts a plain-language body alongside formal', () => {
    const r = createPolicySchema.safeParse({
      slug: 'bylaws',
      title: 'Bylaws',
      body_formal: 'WHEREAS...',
      body_plain: 'In short: be excellent to each other.',
    })
    expect(r.success).toBe(true)
  })
})

describe('supersedePolicySchema', () => {
  it('requires a policy id and accepts new bodies', () => {
    const r = supersedePolicySchema.safeParse({
      policyId: UUID,
      body_formal: 'updated...',
      adopted_by_proposal_id: UUID,
    })
    expect(r.success).toBe(true)
  })

  it('rejects bad policy id', () => {
    expect(supersedePolicySchema.safeParse({ policyId: 'nope' }).success).toBe(false)
  })
})

describe('updatePolicyStatusSchema', () => {
  it('accepts every policy_status value', () => {
    for (const s of policyStatuses) {
      const r = updatePolicyStatusSchema.safeParse({ policyId: UUID, status: s })
      expect(r.success, `status=${s}`).toBe(true)
    }
  })

  it('rejects unknown status', () => {
    expect(updatePolicyStatusSchema.safeParse({ policyId: UUID, status: 'archived' }).success).toBe(false)
  })
})

// =============================================================================
// Cross-cutting: type contracts as documentation
// =============================================================================

// =============================================================================
// Member profile and visibility (Tier 2 + Tier 3)
// =============================================================================

import {
  updateMyProfileSchema,
  discloseAffiliationsSchema,
  updateSpaceVisibilitySchema,
  meetingMinutesSchema,
  financialVisibilities,
  directoryVisibilities,
} from '@/lib/validations'

describe('updateMyProfileSchema', () => {
  it('accepts empty input (all fields optional)', () => {
    expect(updateMyProfileSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a typical profile update', () => {
    const r = updateMyProfileSchema.safeParse({
      display_name: 'Alex',
      handle: 'alex',
      skills: ['woodworking', 'electronics'],
      willing_to: ['board_candidate', 'host_volunteer'],
    })
    expect(r.success).toBe(true)
  })

  it('rejects skills array longer than 40', () => {
    const r = updateMyProfileSchema.safeParse({
      skills: Array.from({ length: 41 }, (_, i) => `skill-${i}`),
    })
    expect(r.success).toBe(false)
  })

  it('rejects a willing_to entry over 60 chars', () => {
    const r = updateMyProfileSchema.safeParse({ willing_to: ['x'.repeat(61)] })
    expect(r.success).toBe(false)
  })
})

describe('discloseAffiliationsSchema', () => {
  it('accepts an empty disclosure (still valid; user has no affiliations)', () => {
    const r = discloseAffiliationsSchema.safeParse({ affiliations: [] })
    expect(r.success).toBe(true)
  })

  it('accepts a list of affiliations', () => {
    const r = discloseAffiliationsSchema.safeParse({
      affiliations: ['ACME Robotics, contractor', 'Friends of the Library, board'],
    })
    expect(r.success).toBe(true)
  })

  it('rejects too-long affiliation strings', () => {
    const r = discloseAffiliationsSchema.safeParse({ affiliations: ['x'.repeat(201)] })
    expect(r.success).toBe(false)
  })
})

describe('updateSpaceVisibilitySchema', () => {
  it('accepts every financial_visibility value', () => {
    for (const v of financialVisibilities) {
      const r = updateSpaceVisibilitySchema.safeParse({ financial_visibility: v })
      expect(r.success, `financial_visibility=${v}`).toBe(true)
    }
  })

  it('accepts every directory_visibility value', () => {
    for (const v of directoryVisibilities) {
      const r = updateSpaceVisibilitySchema.safeParse({ member_directory_visibility: v })
      expect(r.success, `member_directory_visibility=${v}`).toBe(true)
    }
  })

  it('rejects unknown visibility', () => {
    expect(
      updateSpaceVisibilitySchema.safeParse({ financial_visibility: 'public' }).success,
    ).toBe(false)
  })
})

describe('meetingMinutesSchema', () => {
  it('accepts a typical input', () => {
    const r = meetingMinutesSchema.safeParse({
      entryId: UUID,
      is_meeting_minutes: true,
      meeting_date: '2026-05-14T18:00:00Z',
    })
    expect(r.success).toBe(true)
  })

  it('defaults is_meeting_minutes to true', () => {
    const r = meetingMinutesSchema.safeParse({ entryId: UUID })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.is_meeting_minutes).toBe(true)
  })

  it('rejects invalid entry id', () => {
    expect(meetingMinutesSchema.safeParse({ entryId: 'nope' }).success).toBe(false)
  })
})

import { updateSpaceSettingsSchema } from '@/lib/validations'

describe('updateSpaceSettingsSchema (mission statement)', () => {
  it('accepts a mission statement', () => {
    const r = updateSpaceSettingsSchema.safeParse({
      mission_statement: 'A community-driven hackerspace committed to radical inclusivity.',
    })
    expect(r.success).toBe(true)
  })

  it('accepts a null mission statement (clears the column)', () => {
    const r = updateSpaceSettingsSchema.safeParse({ mission_statement: null })
    expect(r.success).toBe(true)
  })

  it('rejects a mission statement longer than 5000 chars', () => {
    const r = updateSpaceSettingsSchema.safeParse({ mission_statement: 'x'.repeat(5001) })
    expect(r.success).toBe(false)
  })

  it('still accepts the other space-settings fields', () => {
    const r = updateSpaceSettingsSchema.safeParse({
      name: 'New name',
      city: 'Mesa, AZ',
      require_approval: false,
    })
    expect(r.success).toBe(true)
  })
})

describe('governance contract surface', () => {
  it('exports the expected proposal_type enum', () => {
    expect([...proposalTypes].sort()).toEqual(
      ['advisory_poll', 'board_action', 'budget', 'bylaw_change', 'membership_vote', 'recall'].sort(),
    )
  })

  it('exports the expected threshold rules in privilege order', () => {
    expect([...thresholdRules]).toEqual(['simple_majority', 'two_thirds', 'three_fourths', 'unanimous'])
  })

  it('exports the expected incident statuses in workflow order', () => {
    expect([...incidentStatuses]).toEqual(['received', 'under_review', 'decided', 'appealed', 'closed'])
  })
})
