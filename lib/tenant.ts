// -----------------------------------------------------------------------------
// Tenant / deployment configuration — the single source of truth for whether
// this installation runs as a multi-tenant platform (the hackerspace.sh model,
// one deployment hosting many spaces) or a single-tenant instance (one org runs
// its own private deployment with exactly one space).
//
// The whole app is space-scoped either way; single-tenant mode does not change
// the data model. It only (a) forbids creating a second space, (b) turns the
// signup flow into "join THE space" instead of "create or join", (c) optionally
// opens join without an invite code, (d) hides the hackerspace.sh marketing
// shell, and (e) lets a deployer white-label the brand name and base URL.
//
// Pattern mirrors lib/auth-config.ts: a PURE resolver (unit-tested, no env) plus
// a thin env-reading wrapper. Flags that the browser needs (the signup page is a
// client component) are NEXT_PUBLIC_ so Next.js inlines them into the client
// bundle — hence the literal `process.env.NEXT_PUBLIC_*` member expressions.
//
// SECURITY: every NEXT_PUBLIC_ flag is visible to and forgeable by the browser.
// The server MUST re-enforce the same rules (see lib/auth-actions.ts). Treat the
// client-side use of this config as UX only, never as an authorization boundary.
// -----------------------------------------------------------------------------

export type TenantConfig = {
  /** True when this deployment hosts exactly one space and behaves as a
   *  dedicated instance rather than the multi-tenant platform. */
  singleTenant: boolean
  /** Brand name shown throughout the UI (logo wordmark, page titles). */
  siteName: string
  /** Canonical public base URL of this deployment, no trailing slash. Used for
   *  absolute links in emails, form-result links, and OAuth redirects. */
  appUrl: string
  /** In single-tenant mode, the slug of the one space new signups join. Null
   *  falls back to "the only space in the database" at join time. */
  spaceSlug: string | null
  /** Single-tenant only: allow signups to join without an invite code (still
   *  subject to the space's require_approval gate). Ignored in multi-tenant. */
  openJoin: boolean
  /** Whether the "create a space" flow (signup UI + createSpace action) is
   *  available. False in single-tenant mode so the instance cannot grow a
   *  second tenant through the app. */
  allowSpaceCreation: boolean
  /** Whether the public marketing/landing shell (`/`, the /resources subsite)
   *  is served. Defaults off in single-tenant mode. */
  showMarketing: boolean
}

export type TenantEnv = {
  singleTenant?: string
  siteName?: string
  appUrl?: string
  spaceSlug?: string
  openJoin?: string
  showMarketing?: string
}

const DEFAULT_SITE_NAME = 'hackerspace.sh'
const DEFAULT_APP_URL = 'http://localhost:3000'

function isTrue(v: string | undefined): boolean {
  return v === 'true'
}

/** Strip a trailing slash so callers can safely template `${appUrl}/path`. */
function normalizeUrl(v: string | undefined, fallback: string): string {
  const raw = v?.trim()
  if (!raw) return fallback
  return raw.replace(/\/+$/, '')
}

/**
 * Pure core: resolve the tenant configuration from raw flag strings. No
 * process.env access, so it is trivially unit-testable. All defaulting and
 * precedence lives here.
 */
export function resolveTenantConfig(env: TenantEnv): TenantConfig {
  const singleTenant = isTrue(env.singleTenant)
  const slug = env.spaceSlug?.trim().toLowerCase()

  return {
    singleTenant,
    siteName: env.siteName?.trim() || DEFAULT_SITE_NAME,
    appUrl: normalizeUrl(env.appUrl, DEFAULT_APP_URL),
    spaceSlug: singleTenant ? (slug || null) : null,
    // Open join only means anything in single-tenant mode. In multi-tenant the
    // invite code is the whole join model and is always required.
    openJoin: singleTenant && isTrue(env.openJoin),
    // Second-space creation is disabled in single-tenant mode. There is no
    // opt-out flag: the instance is single-tenant by definition.
    allowSpaceCreation: !singleTenant,
    // Marketing shell defaults to on for the platform, off for an instance,
    // but a single-tenant deployer can re-enable it explicitly.
    showMarketing: env.showMarketing !== undefined
      ? isTrue(env.showMarketing)
      : !singleTenant,
  }
}

/**
 * Env-reading wrapper. The `process.env.NEXT_PUBLIC_*` reads are written as
 * literals so Next.js statically inlines them into the client bundle. Safe to
 * call from both server and client components.
 */
export function tenantConfig(): TenantConfig {
  return resolveTenantConfig({
    singleTenant: process.env.NEXT_PUBLIC_SINGLE_TENANT,
    siteName: process.env.NEXT_PUBLIC_SITE_NAME,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    spaceSlug: process.env.NEXT_PUBLIC_SINGLE_TENANT_SPACE_SLUG,
    openJoin: process.env.NEXT_PUBLIC_SINGLE_TENANT_OPEN_JOIN,
    showMarketing: process.env.NEXT_PUBLIC_SHOW_MARKETING,
  })
}

/**
 * Canonical base URL for absolute links (emails, form results, self-serve
 * portal links). Replaces the scattered `NEXT_PUBLIC_APP_URL || 'https://hackerspace.sh'`
 * fallbacks so a single-tenant deploy never leaks the platform domain.
 */
export function appBaseUrl(): string {
  return tenantConfig().appUrl
}

/** The set of public marketing paths gated by `showMarketing`. Kept in sync
 *  with the /resources subsite routes and the landing page. */
export const MARKETING_PATHS = [
  '/',
  '/resources',
  '/zine',
  '/governance',
  '/space-after-dark',
  '/proposal-duel',
  '/atlas',
  '/atlas.html',
] as const

/** True when `pathname` is part of the marketing shell (exact or subpath). */
export function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.some(
    p => pathname === p || (p !== '/' && pathname.startsWith(p + '/')),
  )
}
