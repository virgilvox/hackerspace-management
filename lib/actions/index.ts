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

// Forum and polymorphic comments
export * from './forum'

// User-creatable chat channels
export * from './comms'

// Custom tiers, custom roles, multi-code invites
export * from './tiers'
export * from './roles'
export * from './invites'

// Configurable member onboarding
export * from './onboarding'

// Customizable permissions, per-item Ops ACLs, area-lead roles
export * from './permissions'

// Custom forms and waivers
export * from './forms'

// Certifications + Instructor capability
export * from './certifications'

// Classes (offerings, sessions, signups)
export * from './classes'

// Equipment registry + reservations
export * from './equipment'

// Member access cards (Door epic)
export * from './member-cards'

// Door connections + executor (Door epic)
export * from './door'

// Presence & attendance (check-in / check-out / hosting)
export * from './presence'

// Stripe recurring dues (product spine Phase 1)
export * from './stripe'

// Transactional notifications outbox (product spine Phase 2)
export * from './notifications'
