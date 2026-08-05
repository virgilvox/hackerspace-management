hackerspace.sh is a Next.js 16 App Router app written in TypeScript, backed by Supabase (Postgres plus Auth). Every space is a tenant, and the whole platform is built around one idea: reads flow through row-level security, and writes flow through server actions that authorize and scope themselves. This page explains that shape and why it is drawn this way.

## The stack

The app is a single Next.js codebase. The UI is React Server Components under `app/(app)/`, the database is Postgres managed by Supabase, and authentication runs on Supabase Auth (GoTrue). There is no separate API service, the browser talks to Next.js, and Next.js talks to Postgres. In production, both the app and a self-hosted Supabase stack run on one DigitalOcean droplet behind Caddy, and every push to `main` deploys automatically: a GitHub Actions workflow runs the deploy script over SSH, which applies any new SQL migrations, rebuilds, and restarts the app.

## Route groups

The `app/` directory uses App Router route groups, parenthesized folders that organize routes without adding a URL segment:

- `app/(app)/` holds the authenticated product: `/members`, `/customize`, `/proposals`, `/door`, and the rest. Its `layout.tsx` is the gate every one of those screens renders inside.
- `app/(landing)/` holds the public marketing page at `/`.

A screen under `app/(app)/<route>/` follows one convention: a server `page.tsx` fetches data and runs its guard, then hands the data as props to a thin `<route>-client.tsx` orchestrator that composes `panels/` and `components/`. Authorization and data-loading live in the server component; the client component only orchestrates interaction.

## Three Supabase clients

There are three ways to reach Postgres, and choosing the right one is the core security decision in any change.

| Client | Factory | Key | RLS | Use for |
|---|---|---|---|---|
| Server | `lib/supabase/server.ts` → `createClient()` | anon | Enforced | Server components and most server actions |
| Browser | `lib/supabase/client.ts` → `createClient()` | anon | Enforced | Auth (login/signup) and the comms realtime subscription only |
| Admin | `lib/supabase/admin.ts` → `createAdminClient()` | service role | **Bypassed** | Trusted server-only work that must cross a normal RLS boundary |

The server client is cookie-bound: it reads the caller's Supabase session from cookies and runs every query as that user, so RLS decides what rows come back. The browser client uses the same anon key and is deliberately confined, client components never write to the database directly, because a direct browser write skips validation, the authorization gate, the activity log, and (for encrypted data) encryption.

The admin client uses the service-role key and bypasses RLS entirely. That makes code-side scoping non-negotiable: **every read, update, and delete on the admin client must be constrained with `.eq('space_id', member.space_id)`** (or an id already proven to belong to that space). RLS will not catch a mistake there, the scope is the only thing standing between a query and a cross-tenant leak.

## The request path

A request to an authenticated screen passes two gates before it renders:

1. `proxy.ts` at the repo root is the Next 16 middleware (the framework renamed `middleware` to `proxy`). It refreshes the Supabase session cookie on every request and checks the path against a `PUBLIC_ROUTES` allowlist. Anything not on the list requires a session, or the request is redirected to `/login`. Public routes, webhooks, cron endpoints, the `/f/` public forms, `/track`, the resources subsite, are exempt from the session check because each one self-authenticates with its own signature, bearer secret, or token.
2. `app/(app)/layout.tsx` is the second gate, defense in depth. It re-checks the user with `auth.getUser()`, loads the active `space_members` row, and redirects to `/signup` when there is no space or `/onboarding` when onboarding is incomplete. It is marked `force-dynamic` so it never caches, the membership check runs on every request.

## Server actions are the write path

Every mutation is a `'use server'` action under `lib/actions/`, and they all follow one contract:

```ts
const v = parseInput(schema, input)        // 1. validate with Zod
if (!v.ok) return { error: v.error }
const supabase = await createClient()
const auth = await requireMemberWithRole(supabase, ADMIN_ROLES)  // 2. authorize
if (!auth.ok) return { error: auth.error }
const { member } = auth
// 3. mutate, scoped by member.space_id
await logActivity(supabase, member, 'updated', 'thing', id)      // 4. audit
revalidatePath('/things')                  // 5. revalidate
```

The shared helpers in `lib/auth-helpers.ts` make that uniform: `parseInput` runs a Zod schema and returns a discriminated result; `requireMember` loads the caller's active membership; `requireMemberWithRole` additionally checks role and rejects a member whose status is `unverified` (pending approval holds no privileged capability); `logActivity` writes an advisory row to `activity_log`. `getAuthMember` selects the single active membership with `.single()`, the platform is one active space per user today, and that call fails closed rather than guess if a user somehow has two.

## Why it is drawn this way

The design exists to make cross-tenant isolation hard to get wrong. RLS on all tables is the backstop, but RLS alone is fragile: the moment code reaches for the admin client to do something legitimate, the backstop is gone. So the platform pairs RLS with an explicit, repeated pattern, validate, authorize, scope by `space_id`, audit, revalidate, that a reviewer can check at a glance and a test can lock in. Keeping writes in server actions rather than the browser makes that pattern the *only* way data changes, so validation, permission checks, and the activity trail can never be skipped. The uniformity is the point: every feature is built the same way, so the security-critical steps stay boring and visible.
