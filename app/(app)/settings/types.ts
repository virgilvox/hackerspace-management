// Shared shapes for the Settings page panels. The orchestrator owns activeTab
// and the shared save status (saving flag + message banner); each panel owns
// its own form state and calls the server actions directly.

import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { Tables } from '@/types/database'

export type Space = Tables<'spaces'>
export type Integration = Tables<'integrations'>

// Some governance columns are not yet in the generated types.
export type SpaceExt = Space & {
  mission_statement?: string | null
  financial_visibility?: string
  member_directory_visibility?: string
}

export type SaveMessage = { type: 'success' | 'error'; text: string } | null

// Shared save status handed down from the orchestrator so panels can drive the
// single banner and disable their submit buttons while a write is in flight.
export interface SaveStatus {
  saving: boolean
  setSaving: Dispatch<SetStateAction<boolean>>
  setMessage: Dispatch<SetStateAction<SaveMessage>>
}

export interface IntegrationField {
  key: string
  label: string
  type: string
  placeholder?: string
  options?: string[]
}

export interface IntegrationConfig {
  platform: string
  name: string
  description: string
  icon: ReactNode
  fields: IntegrationField[]
  docs: string
}
