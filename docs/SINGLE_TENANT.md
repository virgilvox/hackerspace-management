# Single-tenant mode

Run this app as a private instance for exactly one hackerspace, white-labeled with your own name and domain.

By default the app is the multi-tenant platform (the hackerspace.sh model): one deployment hosts many independent spaces, and anyone can create or join a space at signup. Single-tenant mode turns the same codebase into a dedicated, siloed instance for one organization.

## What single-tenant mode is

The data model does not change. Every table is still keyed by `space_id`, row-level security is still mandatory, and the app still runs against exactly one space either way. Single-tenant mode is a thin layer of deployment configuration (resolved in `lib/tenant.ts`) that:

1. Forbids creating a second space (the "create a space" flow is removed from the UI and the `createSpace` server action refuses).
2. Turns signup into "join THE space" instead of "create or join".
3. Optionally opens join without an invite code (still subject to the space's approval gate).
4. Hides the hackerspace.sh marketing and landing shell.
5. Lets you white-label the brand name and canonical base URL.

Think of it as pooled platform versus siloed instance. One org, one space, one deployment, your domain.

## Quick start

The infrastructure (Supabase plus the Next.js app) is provisioned exactly the same way as any deployment. Only the environment variables and the one-time setup step differ.

1. **Provision Supabase and the app.** Follow the self-hosted guide end to end: [DEPLOY_DO_SELFHOSTED.md](./DEPLOY_DO_SELFHOSTED.md) (single DigitalOcean Droplet, self-hosted Supabase behind Nginx). For the managed-Supabase path see [DEPLOYMENT.md](./DEPLOYMENT.md).

2. **Apply the database schema.** Run `scripts/schema.sql` once against the fresh Postgres database, then apply the numbered migrations (`scripts/0NN_*.sql`) in order. Each migration is applied exactly once and recorded in `public._migrations_applied`. Restart PostgREST afterward so it refreshes its schema cache. See section 9 of [DEPLOY_DO_SELFHOSTED.md](./DEPLOY_DO_SELFHOSTED.md) and [scripts/README.md](../scripts/README.md).

3. **Set the environment variables.** Fill in the required runtime keys plus the single-tenant keys (see the minimal example below and the [full table](#single-tenant-environment-variables)).

4. **Create the space and first admin.** Run `pnpm setup` once. It provisions your one space (the same shape `createSpace` produces, with the default channels, areas, and tiers auto-created by triggers) and creates the first admin login through the Supabase Admin API. See the [CLI reference](#the-setup-cli).

5. **Sign in.** Open your `NEXT_PUBLIC_APP_URL`, go to `/login`, and sign in with the admin email and password you set. You land on the dashboard as the founding admin.

### Minimal `.env.local`

Copy `.env.example` and fill in at least these keys. The `NEXT_PUBLIC_` values are inlined into the client bundle at build time, so a production instance must have them set before `pnpm build`.

```bash
# Required runtime
NEXT_PUBLIC_SUPABASE_URL=https://supabase.yourdomain.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...replace-with-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...replace-with-service-role-key
NEXT_PUBLIC_APP_URL=https://members.yourdomain.com

# Single-tenant mode
NEXT_PUBLIC_SINGLE_TENANT=true
NEXT_PUBLIC_SITE_NAME=Your Space Name
NEXT_PUBLIC_SINGLE_TENANT_SPACE_SLUG=yourspace
NEXT_PUBLIC_SINGLE_TENANT_OPEN_JOIN=true

# Used ONLY by `pnpm setup`, never read at runtime.
# Fill these in, run the CLI once, then you can clear the password.
SETUP_SPACE_NAME=Your Space Name
SETUP_SPACE_SLUG=yourspace
SETUP_SPACE_CITY=Your City
SETUP_ADMIN_EMAIL=you@yourdomain.com
SETUP_ADMIN_PASSWORD=pick-a-strong-password
SETUP_ADMIN_NAME=Your Name
```

`SETUP_SPACE_SLUG` must match `NEXT_PUBLIC_SINGLE_TENANT_SPACE_SLUG`. The tenant resolver lowercases the runtime slug, so keep the setup slug lowercase to avoid a mismatch. If you leave `NEXT_PUBLIC_SINGLE_TENANT_SPACE_SLUG` unset, the join flow falls back to "the only space in the database", which is fine for a true single-tenant instance.

## The setup CLI

`pnpm setup` (which runs `node scripts/setup.mjs`) is the one-time bootstrap. It reads the `SETUP_*` variables from your environment (or `.env.local`), or takes them from CLI flags, or prompts for them interactively. Precedence is flag, then environment variable, then interactive prompt. It never reads the `SETUP_*` values at runtime; they exist only for this CLI.

It uses `SUPABASE_SERVICE_ROLE_KEY` to talk to the database and to GoTrue, so that key must be set.

### Subcommands

| Command | What it does |
|---------|--------------|
| `pnpm setup` | Full bootstrap: run `doctor`, then `provision` the space, then `create-admin`. Safe to re-run. |
| `pnpm setup doctor` | Checks only. Verifies the Supabase URL and service-role key connect, that the `spaces` table exists (schema applied), and reports whether the space and the admin already exist. Makes no changes. |
| `pnpm setup provision` | Creates the one space only. Inserts the `spaces` row (`name`, `slug`, `city`, generated `invite_code`); the default comms channels, areas, and tiers are created by database triggers, not by the CLI. |
| `pnpm setup create-admin` | Creates the first admin only. Creates the auth user through the Supabase Admin API (email confirmed) and inserts the founder `space_members` row (`role: 'admin'`, `tier: 'plus'`, `status: 'current'`, approved and onboarded). |

### Flags

Every `SETUP_*` variable has a matching flag; the flag wins over the environment variable.

| Flag | Environment variable |
|------|----------------------|
| `--space-name` | `SETUP_SPACE_NAME` |
| `--space-slug` | `SETUP_SPACE_SLUG` |
| `--space-city` | `SETUP_SPACE_CITY` |
| `--admin-email` | `SETUP_ADMIN_EMAIL` |
| `--admin-password` | `SETUP_ADMIN_PASSWORD` |
| `--admin-name` | `SETUP_ADMIN_NAME` |
| `--yes` | (non-interactive: never prompt, error on any missing required value, auto-generate an admin password if none is given) |
| `--force` | (guard, see below) |

### Idempotency and the `--force` guard

The CLI is safe to re-run. `provision` looks up the space by slug first: if it already exists it is left untouched. `create-admin` looks up the admin by email: if that user already exists the CLI stops rather than creating a duplicate or silently changing the password.

`--force` is the explicit override for that guard. Use it only when you mean to reset an existing bootstrap (for example to set a new admin password on an existing account). Without `--force`, an already-provisioned instance is a no-op, which is what you want for a redeploy.

Because GoTrue owns password hashing, the admin auth user is always created through the Admin API (`auth.admin.createUser` with `email_confirm: true`). The CLI never writes to `auth.users` directly.

## Deploy

Single-tenant instances deploy exactly like any instance. The moving parts:

- `deploy/deploy.sh` runs the standard release: fetch, install, apply pending migrations, build, restart. It is idempotent, so a redeploy with no new migrations does not touch the database.
- `scripts/apply-migrations.sh` applies any `scripts/0NN_*.sql` not yet recorded in `public._migrations_applied` and records each filename. It does not restart PostgREST; do that separately afterward so PostgREST refreshes its schema cache (`deploy/deploy.sh` does this automatically, or run `docker compose restart rest` when applying migrations by hand).
- `docker-compose.full.yml` brings up the full stack (Supabase plus the app) for a container-based host.

Set every `NEXT_PUBLIC_` value on the host before building, because Next.js inlines them at build time. Run `pnpm setup` once after the first successful deploy (it is a no-op on later deploys). Full procedure: [DEPLOY_DO_SELFHOSTED.md](./DEPLOY_DO_SELFHOSTED.md).

## How single-tenant differs at runtime

| Behavior | Multi-tenant (default) | Single-tenant |
|----------|------------------------|---------------|
| Create a space | Available in signup UI; `createSpace` allowed | Removed from UI; `createSpace` refuses |
| Signup flow | Create or join a space | Join THE space |
| Join without invite code | Never (invite code is the whole join model) | Allowed when `NEXT_PUBLIC_SINGLE_TENANT_OPEN_JOIN=true` |
| Marketing and landing shell | Served | Hidden (redirected to `/login`) |
| Brand name and base URL | hackerspace.sh defaults | White-labeled via env |

These runtime rules are enforced on the server, not just in the UI. The `NEXT_PUBLIC_` flags are visible to and forgeable by the browser, so `createSpace` re-checks `allowSpaceCreation`, `joinSpace` re-checks the open-join and slug rules, and `proxy.ts` redirects marketing paths server-side. Treat the client-side config as UX only.

### Open join and approval

With `NEXT_PUBLIC_SINGLE_TENANT_OPEN_JOIN=true`, a new person can sign up and join your space with an empty invite code. This does not bypass approval: if the space has `require_approval` on, the new member lands in the `unverified` state and an admin approves them from the members page. Leave the flag unset to require an invite code even in single-tenant mode.

### Marketing shell

When marketing is hidden, `proxy.ts` redirects the marketing paths (the landing page `/`, and `/resources`, `/zine`, `/governance`, `/space-after-dark`, `/proposal-duel`, `/atlas`, `/atlas.html`) to `/login`. Marketing defaults off in single-tenant mode; set `NEXT_PUBLIC_SHOW_MARKETING=true` to re-enable the landing and resources shell on your instance.

## Single-tenant environment variables

All of these are `NEXT_PUBLIC_` (inlined at build time, so changing one requires a rebuild) and all are optional except `NEXT_PUBLIC_APP_URL`, which is required for every deployment. Values are resolved in `lib/tenant.ts`.

| Variable | Purpose | Default when unset |
|----------|---------|--------------------|
| `NEXT_PUBLIC_SINGLE_TENANT` | Set to `true` to run as a single-tenant instance. Anything else is multi-tenant. | multi-tenant (`false`) |
| `NEXT_PUBLIC_SITE_NAME` | Brand name shown in the UI wordmark and the page title. | `hackerspace.sh` |
| `NEXT_PUBLIC_SINGLE_TENANT_SPACE_SLUG` | Slug of the one space new signups join (matches `spaces.slug`). Lowercased by the resolver. | the only space in the database |
| `NEXT_PUBLIC_SINGLE_TENANT_OPEN_JOIN` | Set to `true` to allow join without an invite code. Ignored in multi-tenant. | invite code required (`false`) |
| `NEXT_PUBLIC_SHOW_MARKETING` | Override marketing shell visibility. | off in single-tenant, on in multi-tenant |
| `NEXT_PUBLIC_APP_URL` | Canonical public base URL, no trailing slash. Used for absolute links (emails, form results, OAuth redirects). | `http://localhost:3000` |

Setup-only variables (`SETUP_SPACE_NAME`, `SETUP_SPACE_SLUG`, `SETUP_SPACE_CITY`, `SETUP_ADMIN_EMAIL`, `SETUP_ADMIN_PASSWORD`, `SETUP_ADMIN_NAME`) are read only by `pnpm setup`, never at runtime. See the [CLI reference](#the-setup-cli).

## Troubleshooting

**`pnpm setup` cannot find the `spaces` table.** The schema has not been applied to the database the CLI is pointed at, or PostgREST is serving a stale cache. Confirm `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` point at the right project, run `scripts/schema.sql` and the numbered migrations, then restart PostgREST (`docker compose restart rest`). Re-run `pnpm setup doctor` to confirm.

**Admin already exists.** `create-admin` refuses to duplicate an existing auth user, so a second run reports the admin is already present and stops. This is expected on a redeploy. If you genuinely need to reset the password on that account, re-run with `--force`. To add a different admin, use a different `SETUP_ADMIN_EMAIL`, or invite them from the members page once you are signed in.

**Marketing pages 404 or redirect to `/login`.** That is the intended single-tenant behavior: with marketing hidden, `proxy.ts` redirects every marketing path to `/login`. If you want the landing and resources shell served on your instance, set `NEXT_PUBLIC_SHOW_MARKETING=true` and rebuild (it is a `NEXT_PUBLIC_` value, so a running build will not pick up the change until you rebuild and redeploy).

**Links point at localhost or hackerspace.sh.** `NEXT_PUBLIC_APP_URL` is unset or wrong. Every absolute link the app emits comes from `appBaseUrl()`, which reads this value. Set it to your real domain with no trailing slash, then rebuild and redeploy so the new value is inlined. If you changed it but old links persist, you are serving a build made before the change.
