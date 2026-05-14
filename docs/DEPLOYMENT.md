# Hackerspace.sh — Deployment Guide

Complete instructions for every supported deployment target that uses **managed Supabase Cloud** as the database / auth layer.

For a fully self-hosted deployment where you run Supabase yourself on a DigitalOcean Droplet (Postgres, GoTrue, PostgREST, Realtime, Storage, Studio — all on your own server), see [DEPLOY_DO_SELFHOSTED.md](./DEPLOY_DO_SELFHOSTED.md). That guide is end-to-end and assumes nothing else.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Supabase Setup (required for all targets)](#2-supabase-setup)
3. [Environment Variables Reference](#3-environment-variables)
4. [Option A — Vercel (recommended)](#4-option-a--vercel)
5. [Option B — DigitalOcean App Platform](#5-option-b--digitalocean-app-platform)
6. [Option C — DigitalOcean Droplet (Docker / self-hosted)](#6-option-c--digitalocean-droplet)
7. [Post-Deploy Checklist](#7-post-deploy-checklist)
8. [Upgrading an Existing Deployment](#8-upgrading)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Local development |
| pnpm | 9+ | Package manager |
| Git | any | Source control |
| Supabase account | free tier works | Database + auth + realtime |
| Vercel / DigitalOcean account | — | Hosting |

Clone the repo:

```bash
git clone https://github.com/virgilvox/hackerspace-management.git
cd hackerspace-management
pnpm install
```

---

## 2. Supabase Setup

This step is identical regardless of which hosting option you choose.

### 2.1 Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a region close to your users
3. Set a strong database password and save it — you won't need it directly but keep it safe
4. Wait ~2 minutes for provisioning

### 2.2 Apply the schema

1. In the Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Paste the entire contents of `scripts/schema.sql`
4. Click **Run** (or Ctrl+Enter)

You should see no errors. The script is idempotent — safe to re-run.

### 2.3 Configure Auth

In the Supabase dashboard:

**Authentication → Settings → General**
- Set **Site URL** to your app's public URL (e.g. `https://yourapp.vercel.app`)
- Add the same URL to **Redirect URLs**
- Also add `http://localhost:3000` for local dev

**Authentication → Settings → Email**
- Enable **Confirm email** if you want verified signups
- Customize the email templates as needed

**Authentication → Providers**
- Email/Password is enabled by default — no changes needed
- Optionally enable Google, GitHub, etc. (social login buttons are wired in the UI)

### 2.4 Enable Realtime

The schema script already runs `ALTER PUBLICATION supabase_realtime ADD TABLE ...` for `comms_messages` and `comms_channels`. Verify in:

**Database → Replication** — confirm both tables appear under `supabase_realtime`.

### 2.5 Get your API keys

**Project Settings → API**

Copy these four values — you'll need them in every deployment:

```
NEXT_PUBLIC_SUPABASE_URL        = https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY       = eyJhbGci...   (keep this SECRET — server-side only)
```

### 2.6 Create your first Space + Admin user

After deploying the app, navigate to `/signup`. The signup flow will:
1. Create an `auth.users` row in Supabase
2. Trigger `handle_space_signup()` which inserts a `space_members` row

To make yourself an admin, run this in the SQL editor (replace values):

```sql
UPDATE public.space_members
SET role = 'admin', status = 'current'
WHERE email = 'your@email.com';
```

---

## 3. Environment Variables

The repo ships an `.env.example` file. Copy it locally:

```bash
cp .env.example .env.local
```

Then fill in real values. For deployed environments, set the same keys in the host's dashboard.

Required variables:

| Key | Where it is used |
|-----|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server, in every request |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Bypasses RLS. Used by createSpace / joinSpace |
| `NEXT_PUBLIC_APP_URL` | OAuth callback URLs |
| `NODE_ENV` | Runtime mode |

Per-space integration credentials (PayPal, Zeffy, Venmo, Stripe) are stored in the `integrations` table, not in env. The Settings UI writes them; `/api/paypal/sync` reads them.

`.env.local` is git-ignored. Never commit real secrets.

---

## 4. Option A — Vercel

The simplest and fastest path. Zero server management.

### 4.1 Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
pnpm add -g vercel

# From the project root:
vercel

# Follow the prompts:
#   - Link to existing project or create new
#   - Framework: Next.js (auto-detected)
#   - Root directory: ./  (default)
```

### 4.2 Set environment variables

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_APP_URL production
```

Or set them in the Vercel dashboard: **Project → Settings → Environment Variables**

### 4.3 Deploy to production

```bash
vercel --prod
```

### 4.4 Connect a custom domain (optional)

Vercel dashboard → **Domains** → add your domain → follow DNS instructions.

### 4.5 Continuous deployment

Push to `main` branch → Vercel auto-deploys. Push to any other branch → preview deployment at a unique URL.

```bash
git push origin main  # triggers production deploy
git push origin feat/my-feature  # triggers preview deploy
```

---

## 5. Option B — DigitalOcean App Platform

Managed container hosting. No Docker knowledge required. Scales automatically.

The repo ships an App Platform spec at `.do/app.yaml`. You can either apply it directly with `doctl` or use the UI flow below.

### 5.1 Push your repo to GitHub

App Platform deploys directly from GitHub.

```bash
git remote add origin https://github.com/YOUR_ORG/hackerspace-management.git
git push -u origin main
```

### 5.2a Create the app via `doctl` (recommended)

Edit `.do/app.yaml` and replace `REPO_OWNER/REPO_NAME` and the placeholder env values. Then:

```bash
doctl apps create --spec .do/app.yaml
```

### 5.2b Or create via the UI

1. Go to [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
2. Click **Create App** then **GitHub**, authorize and select your repo
3. Select branch: `main`
4. App Platform auto-detects Next.js. Confirm the build settings:
   - **Build command**: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
   - **Run command**: `pnpm start`
   - **HTTP port**: `3000`
   - **Health check path**: `/api/health`

### 5.3 Set environment variables

In the App Platform UI, go to **Settings → App-Level Environment Variables** and add:

```
NEXT_PUBLIC_SUPABASE_URL        = (your value)
NEXT_PUBLIC_SUPABASE_ANON_KEY   = (your value)
SUPABASE_SERVICE_ROLE_KEY       = (mark as Encrypted)
NEXT_PUBLIC_APP_URL             = https://your-app.ondigitalocean.app
NODE_ENV                        = production
```

Mark `SUPABASE_SERVICE_ROLE_KEY` as **Encrypted** so it's not visible in logs.

### 5.4 Choose a plan

- **Basic** ($5/mo): fine for small hackerspaces (<50 members)
- **Professional** ($12/mo): recommended for production — includes more RAM and 99.99% SLA

### 5.5 Deploy

Click **Create Resources** → wait ~3 minutes for the first build.

### 5.6 Custom domain

App Platform dashboard → **Settings → Domains** → add domain → update your DNS with the CNAME provided.

### 5.7 Continuous deployment

App Platform auto-deploys on every push to `main` by default. You can also configure it to deploy only on tagged releases.

---

## 6. Option C — DigitalOcean Droplet

Full self-hosted on a VPS. Maximum control. Use this if you want everything on your own infrastructure.

### 6.1 Create a Droplet

1. Go to [cloud.digitalocean.com/droplets](https://cloud.digitalocean.com/droplets)
2. **Create Droplet**
   - Image: **Ubuntu 24.04 LTS**
   - Plan: **Basic — Regular — $12/mo** (2 vCPU, 2GB RAM) minimum; $24/mo recommended
   - Datacenter: closest to your users
   - Authentication: SSH key (strongly recommended over password)
3. Note the Droplet IP address

### 6.2 Initial server setup

SSH in and harden the server:

```bash
ssh root@YOUR_DROPLET_IP

# Create a non-root user
adduser deploy
usermod -aG sudo deploy

# Copy SSH key to new user
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Switch to deploy user
su - deploy
```

### 6.3 Install Docker and Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy

# Install Docker Compose plugin
sudo apt-get install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

### 6.4 Install Nginx and Certbot

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 6.5 Clone the repo on the server

```bash
cd /opt
sudo git clone https://github.com/YOUR_ORG/hackerspace-management.git hackerspace
sudo chown -R deploy:deploy /opt/hackerspace
cd /opt/hackerspace
```

### 6.6 Use the bundled Dockerfile and Compose file

Both files ship in the repo root:

```
Dockerfile          (multi-stage build, standalone output, healthcheck)
docker-compose.yml  (service definition, env_file, healthcheck)
.dockerignore
```

You do not need to write your own. The Dockerfile sets `DOCKER_BUILD=1` during build so `next.config.mjs` emits standalone output. The compose file reads `.env.local` by default; for production swap that to `.env.production` (next step) or edit the compose file inline.

### 6.7 Create the production env file

```bash
cp /opt/hackerspace/.env.example /opt/hackerspace/.env.production
nano /opt/hackerspace/.env.production
```

Fill in the real Supabase URL, anon key, service role key, and your app URL. Then lock the file:

```bash
chmod 600 /opt/hackerspace/.env.production
```

Update `docker-compose.yml` to point at `.env.production` instead of `.env.local`, or symlink:

```bash
ln -sf .env.production /opt/hackerspace/.env.local
```

### 6.8 Build and start the container

```bash
cd /opt/hackerspace
docker compose build
docker compose up -d

# Check logs
docker compose logs -f app

# Verify health endpoint
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"..."}
```

### 6.11 Configure Nginx as reverse proxy

```bash
sudo nano /etc/nginx/sites-available/hackerspace
```

Paste:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/hackerspace /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.12 SSL with Let's Encrypt

Point your domain's A record to the Droplet IP first, then:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will auto-configure HTTPS and set up auto-renewal. Verify renewal works:

```bash
sudo certbot renew --dry-run
```

### 6.13 Set up automatic deployments (optional)

Create a deploy script:

```bash
cat > /opt/hackerspace/deploy.sh << 'EOF'
#!/bin/bash
set -e
cd /opt/hackerspace
git pull origin main
docker compose build app
docker compose up -d --no-deps app
docker image prune -f
echo "Deploy complete: $(date)"
EOF
chmod +x /opt/hackerspace/deploy.sh
```

To trigger a deploy from your local machine:

```bash
ssh deploy@YOUR_DROPLET_IP '/opt/hackerspace/deploy.sh'
```

Or set up a GitHub Actions workflow:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Droplet

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DROPLET_IP }}
          username: deploy
          key: ${{ secrets.DROPLET_SSH_KEY }}
          script: /opt/hackerspace/deploy.sh
```

Add `DROPLET_IP` and `DROPLET_SSH_KEY` to your GitHub repo's **Settings → Secrets**.

### 6.14 Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 7. Post-Deploy Checklist

Run through this after every fresh deployment:

- [ ] App loads at your domain over HTTPS
- [ ] `GET /api/health` returns `{ "status": "ok" }`
- [ ] `/signup` creates a user and redirects to `/dashboard`
- [ ] Dashboard renders without errors (counts may be zero)
- [ ] Supabase dashboard, Authentication > Users shows the signup
- [ ] `space_members` table has a row for the new user, with `role = 'admin'` for the first user (`createSpace` sets this)
- [ ] Chat page loads the three default channels (`general`, `announcements`, `ops`)
- [ ] Send a message and watch it appear in another tab without refresh (verifies realtime)
- [ ] Settings page saves without error
- [ ] PayPal integration accepts credentials and shows the connected badge

---

## 8. Upgrading

When the schema changes, a new numbered script is added to `scripts/` (for example `scripts/014_member_user_id_nullable.sql`). On an existing database, run only the new script in the Supabase SQL editor.

```
scripts/
  schema.sql                          fresh deployment, full schema
  001_create_schema.sql               historical, not used for fresh deploys
  ...
  014_member_user_id_nullable.sql     most recent incremental
```

`scripts/schema.sql` is also idempotent: it uses `IF NOT EXISTS` for tables and indexes, `DROP POLICY IF EXISTS` before recreating policies, and `EXCEPTION WHEN duplicate_object` for enums and realtime publications. Re-running it on an existing database is safe but unnecessary.

For Vercel and App Platform: push to `main`, the build auto-deploys.

For Droplet: `ssh deploy@IP '/opt/hackerspace/deploy.sh'`

---

## 9. Troubleshooting

### "relation does not exist" errors

The schema was not applied or was partially applied. Re-run `scripts/schema.sql` in the Supabase SQL editor.

### Users can sign up but see no data

The `handle_space_signup` trigger is not firing or the `space_id` metadata was not passed during signup. Check:

```sql
SELECT * FROM public.space_members ORDER BY joined_at DESC LIMIT 5;
```

If empty, ensure a `spaces` row exists first:

```sql
INSERT INTO public.spaces (name, slug, invite_code)
VALUES ('My Hackerspace', 'my-hackerspace', 'INVITE123');
```

Then re-run signup with the space's `id` in the metadata.

### Chat messages not appearing in realtime

Verify realtime is enabled:

```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

Both `comms_messages` and `comms_channels` must appear. If not:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.comms_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comms_channels;
```

### 500 errors on API routes

Check that `SUPABASE_SERVICE_ROLE_KEY` is set in your deployment environment. This key is required for server-side actions.

### Docker container exits immediately

```bash
docker compose logs app
```

Most common cause: missing `.env.production` file or a missing required env var.

### SSL certificate not renewing

```bash
sudo systemctl status certbot.timer
sudo journalctl -u certbot
```

If the timer is not running: `sudo systemctl enable --now certbot.timer`
