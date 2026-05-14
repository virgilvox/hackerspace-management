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

## Operational checklist

- Monitor `/var/log/hackerspace-deploy.log` for deploy outcomes.
- Verify backups by restoring `pg_*.sql.gz` to a staging instance quarterly.
- Rotate the Supabase service-role key and JWT secret if the `.env` on the Droplet is ever exposed.
- Keep the host OS patched. The bootstrap installs `unattended-upgrades`.
