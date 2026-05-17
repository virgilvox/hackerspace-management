// Shared shapes for the Customize hub panels. The DB tables are loosely typed
// in queries; these are the props contracts between the page and the panels.

export interface RoleLabelRow {
  role: string
  display_name: string | null
  description: string | null
  color: string | null
}

export interface CustomRole {
  id: string
  slug: string
  name: string
  description: string | null
  color: string | null
  sort_order: number
}

export interface Tier {
  id: string
  slug: string
  name: string
  description: string | null
  monthly_price_cents: number
  billing_cadence: string
  is_system: boolean
  is_archived: boolean
  sort_order: number
}

export interface Invite {
  id: string
  code: string
  label: string | null
  expires_at: string | null
  max_uses: number | null
  uses_count: number
  is_enabled: boolean
  role: string
  created_at: string
}

export type OnboardingStepType = 'welcome' | 'code_of_conduct' | 'profile' | 'payment' | 'content' | 'form'

export interface FormOption {
  id: string
  title: string
  kind: string
  status: string
}

export interface Step {
  id: string
  step_key: string
  step_type: OnboardingStepType
  title: string
  body: string | null
  config: Record<string, unknown>
  is_enabled: boolean
  is_required: boolean
  is_system: boolean
  sort_order: number
}

export interface Area {
  id: string
  code: string
  name: string
  icon: string | null
  sort_order: number
  is_archived: boolean
}
