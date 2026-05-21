# Deployment

The supported production target is a single DigitalOcean Droplet running self-hosted Supabase plus the Next.js app behind Caddy with automatic HTTPS. The end-to-end procedure lives in [DEPLOY_DO_SELFHOSTED.md](./DEPLOY_DO_SELFHOSTED.md).

## At a glance

| Component | Hosted on |
|-----------|-----------|
| Database (Postgres) | Supabase container on the Droplet, data on a persistent block volume |
| Auth (GoTrue) | Supabase container on the Droplet |
| REST and Realtime | Supabase containers on the Droplet |
| App (Next.js) | systemd service on the Droplet, port 3000 |
| Reverse proxy | Caddy 2 on the Droplet, ports 80 and 443 |
| Email | Resend (SMTP) |
| Backups | Daily `pg_dumpall` to `/mnt/data/backups`, 14-day retention |
| Continuous deployment | GitHub Actions runs `/opt/hackerspace-ops/deploy.sh` over SSH on every push to `main` |

## Required environment variables

All variables are listed in [.env.example](../.env.example). At minimum:

- `NEXT_PUBLIC_SUPABASE_URL` — public Supabase API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon JWT, public
- `SUPABASE_SERVICE_ROLE_KEY` — service-role JWT, server-side only
- `NEXT_PUBLIC_APP_URL` — public URL of the deployed app, used in OAuth redirects

Optional:

- `NEXT_PUBLIC_OAUTH_GITHUB` / `NEXT_PUBLIC_OAUTH_GOOGLE` — set to `"true"` only for an OAuth provider you have actually configured in Supabase Auth. The login page hides any provider button that is not enabled, and hides the whole social-sign-in block if neither is set. These are build-time public values, so a change requires a redeploy to take effect.
- `RESEND_API_KEY` — Resend HTTP API key for transactional email. Unset means the notification outbox still fills but nothing is sent (dispatcher records each row as failed with "transport not configured").
- `EMAIL_FROM` — from address for all platform email, e.g. `HeatSync Labs <noreply@hackerspace.sh>`. The domain must be verified in Resend (SPF + DKIM) for production delivery.
- `CRON_SECRET` — shared secret guarding the notification dispatcher. Generate with `openssl rand -hex 32`. Unset means the dispatcher returns 503 and never sends.

## How a deploy runs

1. A developer pushes to `main`.
2. GitHub Actions (`.github/workflows/deploy.yml`) opens an SSH connection to the Droplet using a deploy key stored in repository secrets.
3. The action invokes `/opt/hackerspace-ops/deploy.sh`, which:
   - Fetches latest `main`.
   - Runs `pnpm install --frozen-lockfile`.
   - Iterates over `scripts/0*.sql`. Any file not present in `public._migrations_applied` is applied and recorded.
   - Restarts PostgREST to refresh its schema cache.
   - Runs `pnpm build`.
   - Restarts the `hackerspace-app` systemd unit.
   - Probes the local app for a 200 response.

Migrations are idempotent. A redeploy that introduces no new migrations is a no-op on the database.

## Local development

See [LOCAL_DEV.md](./LOCAL_DEV.md) for the fresh-clone-to-running sequence using the Supabase CLI.

## First-time provisioning

For initial server provisioning (Docker, the Supabase stack, Caddy, firewall, SSH hardening, deploy-key registration, the systemd unit, backup cron), follow [DEPLOY_DO_SELFHOSTED.md](./DEPLOY_DO_SELFHOSTED.md) end to end.

### Notification dispatcher cron

Transactional email is an outbox drained by `POST /api/cron/notifications`. Add a once-a-minute root crontab entry on the Droplet (after `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` are set in the app `.env`):

```
* * * * * curl -fsS -m 30 -X POST http://127.0.0.1:3000/api/cron/notifications -H "Authorization: Bearer $CRON_SECRET" >/dev/null 2>&1
```

It hits the app locally (bypassing Caddy), self-throttles under Resend's rate limit, and is idempotent, so a missed or overlapping minute is harmless. Migration `041_notifications.sql` is applied automatically by `deploy.sh` like every other `scripts/0*.sql`; no manual database step.

### Door inbound-log poll cron (optional, door epic Phase 4)

If a space runs a native-HeatSync controller and turns on inbound ingest (per connection, on `/door/manage`), the once-a-minute poll pulls its `?z` log into the access log and matches each card to a member. It reuses the same `CRON_SECRET`; add a second crontab entry:

```
* * * * * curl -fsS -m 30 -X POST http://127.0.0.1:3000/api/cron/door-ingest -H "Authorization: Bearer $CRON_SECRET" >/dev/null 2>&1
```

No new env var. The route returns 503 if `CRON_SECRET` is unset and 401 on mismatch, polls only connections with `inbound_enabled` + `adapter='native_heatsync'`, and is idempotent (overlapping or missed minutes are harmless; events dedupe on `(connection_id, dedupe_key)`). Generic (non-HeatSync) controllers do NOT use this poll; they push to the per-connection webhook instead (`POST /api/door/inbound/[connection]`, authenticated by the connection's bearer secret from the vault — no env var, no crontab; the webhook URL is shown on `/door/manage` when inbound is enabled). Migration `053_door_inbound_ingest.sql` applies automatically with the rest.

### Member email change (Supabase Auth config — required)

The self-serve "change my login email" feature (`/me` Profile tab) needs Supabase project configuration that is NOT in code. Until this is set, requesting an email change will send a link that does not land correctly.

1. Authentication → URL Configuration: add `{APP_URL}/auth/confirm` to the redirect allowlist (alongside the existing `/auth/callback`).
2. Authentication → Providers → Email: keep **"Secure email change"** enabled (double confirm: both old and new address must verify).
3. Authentication → Email Templates → "Change Email Address": point the link at the confirm route with the recovery-style token, not the OAuth code flow:

```
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change">Confirm this email change</a>
```

With Secure email change on, Supabase sends this to both the old and new address; each link hits `/auth/confirm`, which `verifyOtp`s and (post-verification only) syncs the denormalized `space_members.email`. Email delivery uses the project's configured SMTP (or Supabase built-in if none); production should use a real SMTP provider.

## Operational checklist

- Monitor `/var/log/hackerspace-deploy.log` for deploy outcomes.
- Verify backups by restoring `pg_*.sql.gz` to a staging instance quarterly.
- Rotate the Supabase service-role key and JWT secret if the `.env` on the Droplet is ever exposed.
- Keep the host OS patched. The bootstrap installs `unattended-upgrades`.
