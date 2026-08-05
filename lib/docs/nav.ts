// Docs information architecture, organized by the Diátaxis framework:
//   tutorials    — learning-oriented, start-to-finish lessons
//   how-to       — task-oriented, goal-focused recipes
//   reference    — information-oriented, dry technical facts
//   explanation  — understanding-oriented, background & rationale
//
// This registry is the single source of truth for the docs nav, the
// static-param generation, and the content pipeline. Each page's body lives at
// content/docs/<category>/<slug>.md and is rendered by <DocsMarkdown>.

export type DocCategoryId = 'tutorials' | 'how-to' | 'reference' | 'explanation'

export type DocPage = {
  slug: string
  title: string
  summary: string
}

export type DocCategory = {
  id: DocCategoryId
  label: string
  tagline: string
  /** Diátaxis one-liner shown on the docs home. */
  diataxis: string
  pages: DocPage[]
}

export const DOC_CATEGORIES: DocCategory[] = [
  {
    id: 'tutorials',
    label: 'Tutorials',
    tagline: 'Start here',
    diataxis: 'Learning-oriented lessons that take you from nothing to a working space, step by step.',
    pages: [
      { slug: 'getting-started', title: 'Set up your space', summary: 'Create or join a space, land as an admin, and get your bearings.' },
      { slug: 'onboard-members', title: 'Onboard your first members', summary: 'Invite people, shape the onboarding flow, and get everyone current.' },
      { slug: 'first-class', title: 'Run your first class', summary: 'Create a class, schedule a session, take signups, mark attendance, award a cert.' },
      { slug: 'dues-end-to-end', title: 'Track dues, end to end', summary: 'Add a pay-here link, import a payment, and reconcile it to a member.' },
    ],
  },
  {
    id: 'how-to',
    label: 'How-to guides',
    tagline: 'Get a task done',
    diataxis: 'Task-oriented recipes for a specific goal, assuming you already know the basics.',
    pages: [
      { slug: 'import-members', title: 'Import members from a spreadsheet', summary: 'Bulk-add members by pasting rows, with tiers and statuses.' },
      { slug: 'invite-links', title: 'Create role-granting invite links', summary: 'Generate invite codes with usage caps, expiry, and a granted role.' },
      { slug: 'configure-onboarding', title: 'Configure the onboarding flow', summary: 'Add, reorder, require, and disable onboarding steps.' },
      { slug: 'connect-payments', title: 'Connect payments & reconcile dues', summary: 'Add a platform, import transactions, and match them to members.' },
      { slug: 'build-a-form', title: 'Build a form or signable waiver', summary: 'Compose fields, set visibility, and capture immutable submissions.' },
      { slug: 'equipment-reservations', title: 'Set up equipment & reservations', summary: 'Register tools, take reservations, and gate a tool behind a certification.' },
      { slug: 'connect-a-door', title: 'Connect a door controller', summary: 'Wire a native or generic controller, assign cards, and read the access log.' },
      { slug: 'run-a-proposal', title: 'Run a proposal to a vote', summary: 'Open a proposal, set quorum and threshold, and record the outcome.' },
      { slug: 'handle-incidents', title: 'File & manage an incident', summary: 'Report an incident (anonymously if needed) and move it to a decision.' },
      { slug: 'publish-a-policy', title: 'Publish & version a policy', summary: 'Write a policy, publish it, and supersede it with a new version.' },
      { slug: 'customize-space', title: 'Customize roles, tiers & areas', summary: 'Rename roles, tune the permissions matrix, define tiers and areas.' },
    ],
  },
  {
    id: 'reference',
    label: 'Reference',
    tagline: 'Look it up',
    diataxis: 'Information-oriented, exhaustive descriptions of the machinery. Dry and accurate.',
    pages: [
      { slug: 'modules', title: 'Modules overview', summary: 'Every module in one place, with what it does and where it lives.' },
      { slug: 'roles-and-permissions', title: 'Roles & permissions', summary: 'Built-in roles, custom roles, and the per-space permission matrix.' },
      { slug: 'members', title: 'Members: statuses, tiers & fields', summary: 'Every member status, tier, and profile field, and what each controls.' },
      { slug: 'governance', title: 'Governance reference', summary: 'Proposal types, thresholds, quorum, incident and policy lifecycles.' },
      { slug: 'payments-and-dues', title: 'Payments & dues reference', summary: 'Platforms, link statuses, dues advancement, and pay-here links.' },
      { slug: 'access-control', title: 'Access control & doors reference', summary: 'Card slots, controller types, inbound ingest, and the access log.' },
      { slug: 'forms', title: 'Forms & waivers reference', summary: 'Field types, visibility, required-form gating, and submission snapshots.' },
      { slug: 'classes-and-equipment', title: 'Classes, certifications & equipment', summary: 'Sessions, waitlists, attendance, cert awards, and reservation rules.' },
      { slug: 'integrations', title: 'Integrations, cron & webhooks', summary: 'Notification dispatch, door inbound webhooks, and the cron endpoints.' },
    ],
  },
  {
    id: 'explanation',
    label: 'Explanation',
    tagline: 'Understand why',
    diataxis: 'Understanding-oriented discussion of how things fit together and why they are built this way.',
    pages: [
      { slug: 'architecture', title: 'Architecture overview', summary: 'Next.js App Router, Supabase, server actions, and the request path.' },
      { slug: 'permissions-model', title: 'The multi-space & permissions model', summary: 'How space-scoping, roles, and effective permissions actually work.' },
      { slug: 'governance-model', title: 'How governance works', summary: 'Why quorum, thresholds, recusal, and anonymity are modeled the way they are.' },
      { slug: 'security-model', title: 'Security & privacy model', summary: 'RLS, the encrypted secrets vault, authz gates, and what the server derives.' },
      { slug: 'data-and-reconciliation', title: 'Dues & reconciliation, explained', summary: 'The philosophy behind advance-only dues and hand/auto matching.' },
    ],
  },
]

export const DOC_CATEGORY_IDS = DOC_CATEGORIES.map(c => c.id)

export function findCategory(id: string): DocCategory | undefined {
  return DOC_CATEGORIES.find(c => c.id === id)
}

export function findPage(categoryId: string, slug: string): { category: DocCategory; page: DocPage } | undefined {
  const category = findCategory(categoryId)
  const page = category?.pages.find(p => p.slug === slug)
  if (!category || !page) return undefined
  return { category, page }
}

/** Flat, in-order list for prev/next navigation. */
export function flatPages(): { categoryId: DocCategoryId; slug: string; title: string }[] {
  return DOC_CATEGORIES.flatMap(c => c.pages.map(p => ({ categoryId: c.id, slug: p.slug, title: p.title })))
}
