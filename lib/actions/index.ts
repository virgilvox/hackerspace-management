/**
 * Barrel re-export for server actions.
 *
 * Client components and pages import action functions via `@/lib/actions`.
 * Each domain lives in its own file in this directory; this barrel keeps
 * the import path stable as the directory grows.
 *
 * Do NOT add `'use server'` here. The directive lives on the domain files
 * themselves; re-exports preserve the marking.
 */

export * from './tasks'
export * from './projects'
export * from './members'
export * from './contacts'
export * from './payments'
export * from './knowledge-base'
export * from './secrets'
export * from './area-leads'
export * from './settings'
export * from './imports'

// Governance kernel (Tier 1)
export * from './proposals'
export * from './incidents'
export * from './policies'

// Per-space configurable taxonomies
export * from './areas'
