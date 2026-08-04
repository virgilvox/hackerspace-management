# Architecture

hackerspace-management is a **Next.js 16 App Router** app (TypeScript, Turbopack) on **Supabase**
(Postgres + Auth). Every space is a tenant; the product is single-space-per-user today (see Known
limitations). This document describes the layers and the exact recipe for adding a feature.

## Request & auth flow

1. **`proxy.ts`** (repo root) is the middleware (Next 16 renamed `middleware` → `proxy`). It refreshes
   the Supabase session and gates every route: anything not in its `PUBLIC_ROUTES` allowlist requires an
   authenticated user, else redirect to `/login`. Public routes (webhooks, cron, `/f/*` public forms,
   `/track`, the resources subsite) each **self-authenticate** (signature/secret/token) — they do not
   rely on a session.
2. **`app/(app)/layout.tsx`** is the second gate (defense in depth): it re-checks the user, loads the
   active `space_members` row, and redirects to signup/onboarding when appropriate. Everything under
   `app/(app)/` renders inside it.

## Layers

Data flows **UI → server action → (validation, guard, domain logic) → data access → Postgres**. Each
layer has one job:

| Layer | Where | Responsibility |
|---|---|---|
| **Generated types** | `types/database.ts` | Supabase-generated row/enum types. **Never hand-edited** — regenerate with `supabase gen types typescript --schema public > types/database.ts`. |
| **Domain types** | `types/domain/*` | Hand-written friendly aliases (`Space = Tables<'spaces'>`), composites, and result shapes. Import via `@/types/domain`. |
| **Validation** | `lib/validations/*` | Zod schemas, one file per feature + `primitives.ts`, re-exported from `lib/validations/index.ts`. Import via `@/lib/validations`. |
| **Domain logic** | `lib/<feature>-logic.ts`, `lib/<feature>/logic.ts` | Pure, side-effect-free decision functions. Unit-tested with no DB (e.g. `dues-payments-logic`, `door-logic`, `invite-claim`). |
| **Guards** | `lib/auth-helpers.ts`, `lib/<feature>-guard.ts`, `lib/actions/<feature>/_guard.ts` | `requireMember` / `requireMemberWithRole` / `parseInput` / `logActivity`; per-feature permission gates returning a `Gate` discriminated union. |
| **Data access** | `lib/supabase/{server,client,admin,proxy}.ts` | Supabase clients. `server`/`client` are **RLS-bound**. `admin` uses the service role and **bypasses RLS**. |
| **Server actions** | `lib/actions/<feature>[.ts \| /]` | `'use server'` mutations/queries. Re-exported through `lib/actions/index.ts`. Client code imports from `@/lib/actions`. |
| **UI** | `app/(app)/<route>/` | `page.tsx` (server: fetch + guard) → `<route>-client.tsx` (thin orchestrator) → `panels/` + `components/` + `types.ts`. |

### The server-action contract (memorize this)

Every action follows the same shape — see `lib/actions/members.ts` for the canonical example:

```ts
'use server'
export async function doThing(input: {...}) {
  const v = parseInput(thingSchema, input)          // 1. validate (Zod)
  if (!v.ok) return { error: v.error }
  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')  // 2. authorize
  if (!auth.ok) return { error: auth.error }
  const { member } = auth
  const { error } = await supabase
    .from('things').update(v.data)
    .eq('id', id)
    .eq('space_id', member.space_id)                // 3. SCOPE to the caller's space (mandatory)
  if (error) return { error: error.message }
  await logActivity(supabase, member, 'updated', 'thing', id)  // 4. audit
  revalidatePath('/things')                          // 5. revalidate
  return { success: true as const }
}
```

**The critical invariant:** whenever you use `createAdminClient()` (service role, RLS off), *every* read,
update, and delete **must** be scoped with `.eq('space_id', member.space_id)` (or an id already proven to
belong to that space). RLS will not save you there — the scope is the only thing preventing a cross-tenant
(IDOR) leak. `__tests__/actions.test.ts` locks this in; `__tests__/auth-helpers.test.ts` covers the gates.

## Feature-folder conventions

A large feature is a folder, not a file. The pattern already exists in the tree:

- **Actions**: `lib/actions/<feature>/` with `'use server'` sub-files split by capability, plain
  `_guard.ts`/`_helpers.ts` (NOT `'use server'` — they export non-async values), and a plain `index.ts`
  barrel. Examples: `lib/actions/{classes,door,forms}/`.
- **UI**: `app/(app)/<route>/` = `page.tsx` + a thin `<route>-client.tsx` orchestrator + `panels/`
  (one per tab/section) + `components/` (modals, rows) + `types.ts`. Exemplars:
  `app/(app)/{customize,ops,settings,members}/`.

Everything is wired through four barrels so features stay decoupled: `@/lib/validations`,
`@/types/domain`, `@/lib/actions`, and `lib/permissions-catalog.ts`.

## Adding a feature (extension) — step by step

A correct feature touches **one file per layer** and imports cross-feature code only through the barrels.

1. **Migration** — add `scripts/0NN_<feature>.sql` (table + RLS policies + any RPC). Enable RLS and write
   per-operation policies scoped by space membership. Then regenerate `types/database.ts`.
2. **Validation** — `lib/validations/<feature>.ts` with `create<Feature>Schema` etc., reusing
   `lib/validations/primitives.ts`. Add `export * from './<feature>'` to `lib/validations/index.ts`.
3. **Domain types** — `types/domain/<feature>.ts`: `export type Feature = Tables<'features'>` + composites.
   Barrel from `types/domain/index.ts`.
4. **Domain logic** — `lib/<feature>/logic.ts`: pure decision functions, unit-tested (no DB).
5. **Guard** — `lib/actions/<feature>/_guard.ts`: `require<Feature>Manager()` returning the `Gate` union
   (copy `lib/actions/classes/_guard.ts` and swap the permission string). Register the permission in
   `lib/permissions-catalog.ts`.
6. **Actions** — `lib/actions/<feature>/<capability>.ts` (`'use server'`). Follow the contract above:
   validate → authorize → **space-scope every query** → `logActivity` → `revalidatePath`. Barrel via
   `lib/actions/<feature>/index.ts`, then `export * from './<feature>'` in `lib/actions/index.ts`.
7. **UI** — `app/(app)/<feature>/page.tsx` (server: fetch + guard, pass data as props) +
   `<feature>-client.tsx` (thin orchestrator) + `panels/` + `components/` + `types.ts`. Client components
   call server actions from `@/lib/actions` — **never write to the DB from the browser client** (that
   skips validation, the authz gate, the activity log, and — for encrypted data — encryption).
8. **Tests** — pure-logic unit tests in `__tests__/`; an action-layer test asserting the space-scope and
   the guard rejection (mirror `__tests__/actions.test.ts`).

## Security model (summary)

- **Two enforcement layers**: Postgres RLS (all 50 tables) *and* explicit code-side authz +
  `space_id` scoping in every action. The admin (service-role) client bypasses RLS, so code-side scoping
  is mandatory there.
- **Roles/statuses** live in `lib/permissions.ts`. `PRIVILEGE_STATUSES` excludes `unverified` — a member
  pending approval in a `require_approval` space holds no privileged capability.
- **Secrets** are AES-256-GCM encrypted at rest (`lib/secrets/*`); always write them via the
  `createSecret`/`updateSecret` server actions (the key is server-only).
- **Public endpoints** self-authenticate: Stripe (per-space signing secret + replay guard), door inbound
  (per-connection vault bearer, `timingSafeEqual`), crons (`CRON_SECRET`), `/track` (192-bit token).

## Build & CI

- `pnpm run typecheck` (`tsc --noEmit`), `pnpm run lint` (ESLint 9 flat config, `eslint.config.mjs`),
  `pnpm run test:run` (Vitest). `.github/workflows/ci.yml` runs all three on PRs and `main`.
- `next build` type-checks (no `ignoreBuildErrors`). **`main` deploys to production on every push**
  (`.github/workflows/deploy.yml` → SSH → the droplet's `deploy.sh`).

## Known limitations / follow-ups

- **Single active space per user** (`getAuthMember` uses `.single()`, fail-closed). Multi-space needs an
  explicit active-space selector before that changes.
- **Regenerate `types/database.ts`** to drop the hand-added RPC entries and the `// TODO(types)` join
  casts, and to de-duplicate the governance row types in `types/domain/governance.ts` into `Tables<>`.
- **Ops area-lead writes** still go directly to the DB from the browser (RLS-protected). They can't reuse
  `upsertAreaLead` (a different `area_code`-keyed interface), so migrating them needs a small dedicated
  server-action trio reconciled with that interface.
- **`markOnboardingStepDone`** read-modify-writes a JSON column; a concurrent double-submit can drop a
  step. A DB-side atomic append (RPC / jsonb operator) is the fix.
- Integration + e2e suites need a DB service wired into CI.
