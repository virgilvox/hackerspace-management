# Hackerspace.sh — Deployment Guide

Complete instructions for every supported deployment target.

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

Create `.env.local` for local dev. For deployed environments, set these in your host's dashboard.

```bash
# ── Supabase ──────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# ── App ───────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# ── PayPal (optional — set in app Settings UI too) ────────────
# These are also stored per-space in the integrations table.
# The API route reads from the DB, not from env vars.
# No env vars needed for PayPal.

# ── Node ──────────────────────────────────────────────────────
NODE_ENV=production
```

**Never commit `.env.local` to git.** The `.gitignore` already excludes it.

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

### 5.1 Push your repo to GitHub

DigitalOcean App Platform deploys directly from GitHub.

```bash
git remote add origin https://github.com/YOUR_ORG/hackerspace-management.git
git push -u origin main
```

### 5.2 Create the app

1. Go to [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
2. Click **Create App** → **GitHub** → authorize and select your repo
3. Select branch: `main`
4. DigitalOcean auto-detects Next.js — confirm the build settings:
   - **Build command**: `pnpm install && pnpm build`
   - **Run command**: `pnpm start`
   - **HTTP port**: `3000`

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

### 6.6 Create the Docker Compose file

```bash
cat > /opt/hackerspace/docker-compose.yml << 'EOF'
version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: hackerspace_app
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  default:
    name: hackerspace_net
EOF
```

### 6.7 Create the Dockerfile

```bash
cat > /opt/hackerspace/Dockerfile << 'EOF'
FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
EOF
```

### 6.8 Enable standalone output in Next.js config

Edit `next.config.mjs` and ensure it contains:

```js
const nextConfig = {
  output: 'standalone',
  // ...rest of your config
}
```

### 6.9 Create the production env file

```bash
cat > /opt/hackerspace/.env.production << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
EOF

# Lock down permissions — this file contains secrets
chmod 600 /opt/hackerspace/.env.production
```

### 6.10 Build and start the container

```bash
cd /opt/hackerspace
docker compose build
docker compose up -d

# Check logs
docker compose logs -f app
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

- [ ] App loads at your domain with HTTPS
- [ ] `/signup` creates a user and redirects to `/dashboard`
- [ ] Dashboard shows "No members yet" (not an error)
- [ ] Supabase dashboard → **Authentication → Users** shows the signup
- [ ] `space_members` table has a row for the new user
- [ ] Chat page loads channels (general, announcements, ops)
- [ ] Send a message — it appears immediately without page refresh
- [ ] Upgrade your user to admin via SQL (see section 2.6)
- [ ] Settings page → save space settings → no error toast
- [ ] PayPal integration → save credentials → "LIVE" badge appears

---

## 8. Upgrading

When the schema changes, a new numbered script will be added to `scripts/`. For example `scripts/012_add_feature.sql`. Run only the new script in the Supabase SQL editor — do not re-run `schema.sql` on an existing database.

```
scripts/
  schema.sql          ← fresh deployment only
  012_add_feature.sql ← incremental upgrade
  013_...sql
```

For Vercel / App Platform: push to `main`, the build auto-deploys.

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
