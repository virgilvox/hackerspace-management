# Full self-hosted deployment on DigitalOcean

End-to-end guide to run the entire stack on your own hardware: self-hosted Supabase plus the Next.js app, both on a single DigitalOcean Droplet. No managed Supabase, no Vercel, no third-party SaaS for application data.

What you get at the end:
- `https://yourdomain.com` serves the Next.js app.
- `https://supabase.yourdomain.com` serves the Supabase API gateway (auth, REST, realtime).
- `https://studio.yourdomain.com` serves Supabase Studio (password-protected).
- Postgres, GoTrue (auth), PostgREST, Realtime, Storage, and Studio all run as Docker containers on the same Droplet.
- Automatic SSL via Let's Encrypt.
- Nightly Postgres backups to local disk (and optionally DigitalOcean Spaces).

If you want the managed-Supabase version instead, see [DEPLOYMENT.md](./DEPLOYMENT.md). That path is simpler but locks you into Supabase Cloud.

---

## Table of contents

1. [Architecture](#1-architecture)
2. [Cost](#2-cost)
3. [Prerequisites](#3-prerequisites)
4. [Provision the Droplet](#4-provision-the-droplet)
5. [Initial server hardening](#5-initial-server-hardening)
6. [Install Docker, Nginx, Certbot](#6-install-docker-nginx-certbot)
7. [DNS records](#7-dns-records)
8. [Self-host Supabase](#8-self-host-supabase)
9. [Apply the app schema and migrations](#9-apply-the-app-schema-and-migrations)
10. [Deploy the Next.js app](#10-deploy-the-nextjs-app)
11. [Nginx reverse proxy + SSL](#11-nginx-reverse-proxy--ssl)
12. [Post-deploy verification](#12-post-deploy-verification)
13. [Backups](#13-backups)
14. [Operations: upgrades, logs, monitoring](#14-operations-upgrades-logs-monitoring)
15. [Hardening checklist](#15-hardening-checklist)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Architecture

```
Internet
   |
   v
DigitalOcean Droplet (Ubuntu 24.04)
   |
   |-- Nginx (80, 443)
   |     |
   |     |-- yourdomain.com           -> localhost:3000   (Next.js app)
   |     |-- supabase.yourdomain.com  -> localhost:8000   (Kong, Supabase API gateway)
   |     `-- studio.yourdomain.com    -> localhost:3001   (Supabase Studio, basic-auth gated)
   |
   |-- Docker network: hackerspace_net
         |
         |-- hackerspace_app          (Next.js, port 3000)
         |
         `-- Docker network: supabase_default
               |-- supabase-db        (Postgres 15)
               |-- supabase-auth      (GoTrue)
               |-- supabase-rest      (PostgREST)
               |-- supabase-realtime  (Realtime)
               |-- supabase-storage   (Storage API)
               |-- supabase-kong      (API gateway, port 8000)
               |-- supabase-studio    (Dashboard, port 3000 -> host 3001)
               |-- supabase-meta      (Postgres meta API)
               |-- supabase-imgproxy
               `-- supabase-vector    (logs)
```

The Next.js app and Supabase live in separate Docker networks. Nginx is the only public entry point. The app talks to Supabase over `https://supabase.yourdomain.com` (public URL) so it works the same locally and in production.

You can also expose Supabase only over the internal docker network and have the app talk to `http://supabase-kong:8000` directly. That is faster but breaks browser-side Supabase calls because the browser cannot resolve internal hostnames. Stick with the public URL pattern unless you understand the trade-off.

---

## 2. Cost

| Item | Spec | Monthly |
|------|------|---------|
| Droplet | 8 GB RAM, 4 vCPU, 160 GB SSD (Regular) | $48 |
| Reserved IP | static IPv4 | included |
| Domain | from any registrar | ~$1 |
| **Total** | | **~$49/mo** |

You can run on a 4 GB / 2 vCPU Droplet ($24/mo) if you tune Postgres and disable a few Supabase services (Storage, Edge Functions). 8 GB is the comfort floor.

For larger spaces (200+ members, heavy chat, file uploads), split into two Droplets: one 8 GB for Supabase, one 2 GB for the app, joined via a VPC.

---

## 3. Prerequisites

- DigitalOcean account.
- A domain you control. Two A records (or one A record with two CNAMEs) point to the Droplet IP. See section 7.
- An SSH public key on your local machine (`~/.ssh/id_ed25519.pub` or similar).
- Local tools: `ssh`, `git`, `curl`, `openssl`, `docker` (for testing builds), `node` (for the JWT generator one-liner).
- An SMTP provider for auth emails (Resend, SendGrid, AWS SES, Postmark, Mailgun). Free tiers are fine. You need:
  - SMTP host, port (587 or 465), username, password
  - A verified `from` address

---

## 4. Provision the Droplet

1. cloud.digitalocean.com → Droplets → Create.
2. Image: **Ubuntu 24.04 (LTS) x64**.
3. Plan: **Basic — Regular — 8 GB / 4 vCPU / 160 GB SSD**.
4. Datacenter: closest to your users.
5. Authentication: **SSH Key** (add your public key, never use password auth).
6. Hostname: `hackerspace-prod` (or whatever).
7. Click **Create Droplet**.
8. Note the public IPv4 address. Reserve it under Networking → Reserved IPs if you want it permanent.

---

## 5. Initial server hardening

SSH in as root:

```bash
ssh root@<droplet-ip>
```

Update and create a deploy user:

```bash
apt-get update && apt-get -y upgrade
adduser deploy                              # set a strong password
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Disable root SSH and password auth:

```bash
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

From a NEW terminal (keep the old one open until you confirm), test:

```bash
ssh deploy@<droplet-ip>
```

If that works, close the root session and continue as `deploy`.

Set up a firewall (allow SSH, HTTP, HTTPS only):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Confirm: `sudo ufw status`.

---

## 6. Install Docker, Nginx, Certbot

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
newgrp docker

# Compose v2 plugin is bundled with the install above. Verify:
docker --version
docker compose version

# Nginx and Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx git

# pnpm for occasional ad-hoc commands (optional; the app runs from Docker)
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

Log out and back in so the `docker` group takes effect.

---

## 7. DNS records

At your registrar, add A records pointing to the Droplet IP:

| Host | Type | Value |
|------|------|-------|
| `yourdomain.com` | A | `<droplet-ip>` |
| `www.yourdomain.com` | A | `<droplet-ip>` |
| `supabase.yourdomain.com` | A | `<droplet-ip>` |
| `studio.yourdomain.com` | A | `<droplet-ip>` |

Wait for propagation (`dig +short supabase.yourdomain.com` should return your IP).

---

## 8. Self-host Supabase

### 8.1 Clone the Supabase repo

```bash
sudo mkdir -p /opt && cd /opt
sudo git clone --depth 1 https://github.com/supabase/supabase.git
sudo chown -R deploy:deploy /opt/supabase
cd /opt/supabase/docker
cp .env.example .env
```

### 8.2 Generate secrets

You need four critical secrets: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`. Generate them on your **local machine** (not the Droplet) and paste them into `.env`.

```bash
# Strong random Postgres password (32 chars)
openssl rand -base64 24

# Strong JWT secret (40+ chars, alphanumeric)
openssl rand -hex 32
```

Now generate the JWTs. Pick the JWT_SECRET you just generated and run this Node one-liner on your local machine:

```bash
# Save the JWT_SECRET from above into a variable first.
export JWT_SECRET='paste-your-jwt-secret-here'

# Generate ANON_KEY (10-year expiry):
npx -y -p jsonwebtoken@9 node -e "
const jwt = require('jsonwebtoken');
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 10;
console.log(jwt.sign({ role: 'anon', iss: 'supabase', iat, exp }, process.env.JWT_SECRET));
"

# Generate SERVICE_ROLE_KEY (10-year expiry):
npx -y -p jsonwebtoken@9 node -e "
const jwt = require('jsonwebtoken');
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 10;
console.log(jwt.sign({ role: 'service_role', iss: 'supabase', iat, exp }, process.env.JWT_SECRET));
"
```

Save all four values somewhere safe. The service role key is a god-mode key; treat it like root credentials.

Also generate two more secrets:

```bash
# Dashboard credentials (for Supabase Studio basic auth)
openssl rand -base64 16    # use as DASHBOARD_PASSWORD

# Logflare API keys (Supabase logs analytics; required even if you don't use Logflare cloud)
openssl rand -hex 32       # use as LOGFLARE_API_KEY
openssl rand -hex 32       # use as LOGFLARE_LOGGER_BACKEND_API_KEY
```

### 8.3 Edit `/opt/supabase/docker/.env`

Open the file: `nano /opt/supabase/docker/.env`. Set:

```bash
# Postgres
POSTGRES_PASSWORD=<from step 8.2>
POSTGRES_PORT=5432
POSTGRES_HOST=db
POSTGRES_DB=postgres

# JWT
JWT_SECRET=<from step 8.2>
JWT_EXPIRY=3600
ANON_KEY=<JWT from step 8.2>
SERVICE_ROLE_KEY=<JWT from step 8.2>

# Public URLs (set to your domain, NOT the Droplet IP)
SITE_URL=https://yourdomain.com
ADDITIONAL_REDIRECT_URLS=https://yourdomain.com,http://localhost:3000
API_EXTERNAL_URL=https://supabase.yourdomain.com
SUPABASE_PUBLIC_URL=https://supabase.yourdomain.com

# Studio
STUDIO_DEFAULT_ORGANIZATION=hackerspace
STUDIO_DEFAULT_PROJECT=hackerspace
STUDIO_PORT=3000                        # internal; we remap on the host in docker-compose.override.yml
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<from step 8.2>

# Kong
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

# SMTP for auth emails (use your provider's values)
SMTP_ADMIN_EMAIL=admin@yourdomain.com
SMTP_HOST=smtp.resend.com               # or sendgrid, ses, etc.
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<your SMTP API key>
SMTP_SENDER_NAME=hackerspace.sh

# Auth behavior
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false          # set to true for dev; false in prod
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false

# Logs / analytics
LOGFLARE_API_KEY=<from step 8.2>
LOGFLARE_LOGGER_BACKEND_API_KEY=<from step 8.2>
LOGFLARE_PUBLIC_ACCESS_TOKEN=<reuse LOGFLARE_API_KEY or generate another>

# Postgrest
PGRST_DB_SCHEMAS=public,storage,graphql_public

# Functions (you probably don't use these; keep default)
FUNCTIONS_VERIFY_JWT=true

# Pooler (Supavisor) — keep defaults unless you know you need to change
POOLER_TENANT_ID=hackerspace
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_DB_POOL_SIZE=5
POOLER_PROXY_PORT_TRANSACTION=6543
POOLER_PROXY_PORT_SESSION=5432
SECRET_KEY_BASE=<openssl rand -hex 32>
VAULT_ENC_KEY=<openssl rand -hex 32>
```

Lock the file:

```bash
chmod 600 /opt/supabase/docker/.env
```

### 8.4 Remap Studio off port 3000

The Next.js app uses host port 3000, and Supabase Studio also defaults to host port 3000. Create an override so Studio binds to 3001 instead.

```bash
cat > /opt/supabase/docker/docker-compose.override.yml << 'EOF'
services:
  studio:
    ports:
      - "127.0.0.1:3001:3000/tcp"
  kong:
    ports:
      - "127.0.0.1:8000:8000/tcp"
      - "127.0.0.1:8443:8443/tcp"
EOF
```

Binding to `127.0.0.1` means these ports are only reachable locally; Nginx will proxy them publicly. The default Supabase compose binds to `0.0.0.0`, which would expose them on the public internet. This override fixes that.

### 8.5 Start Supabase

```bash
cd /opt/supabase/docker
docker compose pull
docker compose up -d
docker compose ps    # all services should be "running" or "healthy"
```

First boot pulls about 4 GB of images and takes 5–10 minutes.

Once everything is up, the API is at `http://localhost:8000` and Studio is at `http://localhost:3001`. Both are private to the host (we bound them to `127.0.0.1`). We'll expose them with Nginx in section 11.

### 8.6 Confirm Postgres is healthy

```bash
docker compose exec db psql -U postgres -c '\dt public.*'
```

You should see an empty table list. Postgres is ready; the application schema goes in next.

---

## 9. Apply the app schema and migrations

The hackerspace-management app stores everything in Postgres. We apply the schema directly to the self-hosted Postgres instance.

### 9.1 Copy the schema files onto the Droplet

From your local machine:

```bash
scp scripts/schema.sql deploy@<droplet-ip>:/tmp/
scp scripts/014_member_user_id_nullable.sql deploy@<droplet-ip>:/tmp/
scp scripts/015_prevent_member_self_role_change.sql deploy@<droplet-ip>:/tmp/
```

(Or `git clone` the repo on the Droplet, see section 10.1.)

### 9.2 Run the schema

```bash
cd /opt/supabase/docker

# Pipe each file into psql inside the Postgres container.
docker compose exec -T db psql -U postgres -d postgres < /tmp/schema.sql
docker compose exec -T db psql -U postgres -d postgres < /tmp/014_member_user_id_nullable.sql
docker compose exec -T db psql -U postgres -d postgres < /tmp/015_prevent_member_self_role_change.sql
```

No errors expected. Verify:

```bash
docker compose exec db psql -U postgres -d postgres -c '\dt public.*'
docker compose exec db psql -U postgres -d postgres -c "SELECT count(*) FROM pg_policies WHERE schemaname = 'public';"
docker compose exec db psql -U postgres -d postgres -c "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"
```

Expect: 13 tables, ~45 policies, `comms_messages` and `comms_channels` in the realtime publication.

### 9.3 Restart PostgREST so it picks up the new schema

PostgREST caches the schema on start. After applying tables, restart it:

```bash
docker compose restart rest
```

---

## 10. Deploy the Next.js app

### 10.1 Clone the app repo on the Droplet

```bash
sudo mkdir -p /opt/hackerspace
sudo chown deploy:deploy /opt/hackerspace
cd /opt
git clone https://github.com/<owner>/hackerspace-management.git hackerspace
cd hackerspace
```

### 10.2 Create the production env file

```bash
cp .env.example .env.local
nano .env.local
```

Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://supabase.yourdomain.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from step 8.2>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from step 8.2>
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

Lock the file:

```bash
chmod 600 /opt/hackerspace/.env.local
```

### 10.3 Build and start the app

The repo ships with a Dockerfile that produces a standalone Next.js image, and a docker-compose.yml that runs it. The Dockerfile expects build-time access to the public Supabase URL and anon key (Next.js inlines `NEXT_PUBLIC_*` at build time), so pass them as build args.

```bash
cd /opt/hackerspace
docker compose build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://supabase.yourdomain.com \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="<ANON_KEY>" \
  --build-arg NEXT_PUBLIC_APP_URL=https://yourdomain.com

docker compose up -d
docker compose logs -f app
```

Wait for `Ready in <ms>`. Then verify locally on the Droplet:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"..."}
```

The app is now running on `127.0.0.1:3000`. Public access still requires Nginx, which we set up next.

---

## 11. Nginx reverse proxy + SSL

Create one server block per public hostname.

### 11.1 App: `yourdomain.com`

```bash
sudo nano /etc/nginx/sites-available/hackerspace-app
```

Paste:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
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

### 11.2 Supabase API: `supabase.yourdomain.com`

```bash
sudo nano /etc/nginx/sites-available/supabase-api
```

Paste:

```nginx
server {
    listen 80;
    server_name supabase.yourdomain.com;

    # Generous body size for storage uploads
    client_max_body_size 50m;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Realtime / WebSockets
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### 11.3 Studio (admin dashboard): `studio.yourdomain.com`

Studio is a god-mode dashboard. Gate it behind HTTP basic auth in addition to its own login.

```bash
sudo apt-get install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd_studio admin    # set a strong password
sudo nano /etc/nginx/sites-available/supabase-studio
```

Paste:

```nginx
server {
    listen 80;
    server_name studio.yourdomain.com;

    # Restrict to your office/home IPs if you have a static one.
    # allow 1.2.3.4;
    # deny all;

    auth_basic           "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd_studio;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### 11.4 Enable and reload

```bash
sudo ln -s /etc/nginx/sites-available/hackerspace-app  /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/supabase-api     /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/supabase-studio  /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 11.5 SSL with Let's Encrypt

Make sure all four hostnames resolve to the Droplet before running:

```bash
sudo certbot --nginx \
  -d yourdomain.com -d www.yourdomain.com \
  -d supabase.yourdomain.com \
  -d studio.yourdomain.com
```

Pick option `2` (redirect HTTP to HTTPS) when prompted. Certbot rewrites the Nginx configs to add `listen 443 ssl;` blocks and sets up auto-renewal via a systemd timer.

Confirm renewal works:

```bash
sudo certbot renew --dry-run
```

---

## 12. Post-deploy verification

Run through this list. Everything should pass on the first try.

```bash
# 1. App health
curl https://yourdomain.com/api/health
# -> {"status":"ok","timestamp":"..."}

# 2. Supabase API health (Kong should reject without an apikey)
curl https://supabase.yourdomain.com/rest/v1/
# -> {"hint":"...","message":"Invalid API key"} or similar (proves Kong is reachable)

# 3. Supabase API with anon key (should return empty array or a hint)
curl https://supabase.yourdomain.com/rest/v1/spaces \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
# -> [] (empty because RLS filters out everything for an unauthenticated request)

# 4. Studio
# Open https://studio.yourdomain.com in a browser. Pass basic auth (admin / your password).
# Studio's own login uses DASHBOARD_USERNAME / DASHBOARD_PASSWORD.
```

App flow:

- [ ] Visit `https://yourdomain.com/signup`. Create an account, create a space, land on `/dashboard`.
- [ ] In Studio, Table Editor, `space_members`: confirm a row exists with `role = 'admin'`, `status = 'current'`.
- [ ] `comms_channels`: confirm three rows (`general`, `announcements`, `ops`).
- [ ] Open `/comms`, send a message, open a second tab, watch the message appear without refresh (realtime works).
- [ ] In Studio, run as the `anon` role:
  ```sql
  UPDATE public.space_members SET role = 'admin' WHERE user_id = auth.uid();
  ```
  This must fail with `Members cannot change their own role, tier, status, approval, card access, or space.` That confirms migration 015 is active.

---

## 13. Backups

### 13.1 Daily Postgres dump to local disk

```bash
sudo mkdir -p /var/backups/supabase
sudo chown deploy:deploy /var/backups/supabase

cat > /opt/hackerspace/backup-db.sh << 'EOF'
#!/bin/bash
set -euo pipefail

TS=$(date +%Y%m%d_%H%M%S)
DEST=/var/backups/supabase/postgres_${TS}.sql.gz

cd /opt/supabase/docker
docker compose exec -T db pg_dump -U postgres --clean --if-exists postgres | gzip > "$DEST"

# Keep last 14 days
find /var/backups/supabase -name "postgres_*.sql.gz" -mtime +14 -delete

echo "[$(date)] backup -> $DEST ($(du -h "$DEST" | cut -f1))"
EOF

chmod +x /opt/hackerspace/backup-db.sh
```

Schedule daily at 3 AM:

```bash
( crontab -l 2>/dev/null; echo "0 3 * * * /opt/hackerspace/backup-db.sh >> /var/log/db-backup.log 2>&1" ) | crontab -
```

### 13.2 Off-site backups to DigitalOcean Spaces (recommended)

Local backups die with the Droplet. Push them to Spaces (S3-compatible).

1. Spaces dashboard → Create Space → note the bucket name and endpoint URL.
2. Spaces → Access Keys → generate one. Save the key and secret.
3. Install `s3cmd`:
   ```bash
   sudo apt-get install -y s3cmd
   s3cmd --configure
   # Endpoint: nyc3.digitaloceanspaces.com (or your region)
   # Use HTTPS, no encryption
   ```
4. Add an upload line to the backup script:
   ```bash
   echo "s3cmd put $DEST s3://<your-space>/db/" >> /opt/hackerspace/backup-db.sh
   ```
5. Lifecycle policy on the Space: rotate to cold storage / delete after N days.

### 13.3 Restoring

```bash
gunzip -c /var/backups/supabase/postgres_20260514_030000.sql.gz | \
  docker compose -f /opt/supabase/docker/docker-compose.yml exec -T db psql -U postgres -d postgres
```

Test restores at least quarterly on a staging Droplet. A backup you have not restored is not a backup.

---

## 14. Operations: upgrades, logs, monitoring

### 14.1 App upgrades

```bash
cd /opt/hackerspace
git pull origin main
docker compose build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://supabase.yourdomain.com \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="<ANON_KEY>" \
  --build-arg NEXT_PUBLIC_APP_URL=https://yourdomain.com
docker compose up -d --no-deps app
docker image prune -f
```

Wrap in `/opt/hackerspace/deploy.sh` and trigger from GitHub Actions on push to `main` if you want CI auto-deploy.

### 14.2 Database migrations

When the app ships a new `scripts/NNN_*.sql`, apply it:

```bash
cd /opt/supabase/docker
docker compose exec -T db psql -U postgres -d postgres < /opt/hackerspace/scripts/NNN_*.sql
docker compose restart rest    # PostgREST caches the schema
```

Never re-run `scripts/schema.sql` against a live database; it is the canonical full file for fresh deploys. Use the numbered incrementals on existing databases.

### 14.3 Supabase upgrades

```bash
cd /opt/supabase/docker
git fetch origin && git pull origin master
docker compose pull
docker compose up -d
```

Read the [release notes](https://github.com/supabase/supabase/releases) before pulling major versions. The Supabase docker-compose has occasional breaking env-var renames.

### 14.4 Logs

```bash
# App
docker compose -f /opt/hackerspace/docker-compose.yml logs -f app

# Supabase
cd /opt/supabase/docker
docker compose logs -f kong auth rest realtime
docker compose logs -f db | grep -v 'connection received'    # noisy

# Nginx
sudo journalctl -u nginx -f
sudo tail -f /var/log/nginx/access.log
```

### 14.5 Resource monitoring

```bash
# Quick view
docker stats

# Disk
df -h
docker system df

# Postgres size
docker compose -f /opt/supabase/docker/docker-compose.yml exec db \
  psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('postgres'));"
```

For real monitoring, install [Netdata](https://www.netdata.cloud/) (`bash <(curl -Ss https://my-netdata.io/kickstart.sh)`) or wire DigitalOcean Monitoring to send alerts on CPU > 80%, disk > 80%, or memory > 85%.

---

## 15. Hardening checklist

Before you point real users at this:

- [ ] Root SSH disabled, password auth disabled (section 5).
- [ ] UFW allows only 22, 80, 443.
- [ ] All four hostnames have valid Let's Encrypt certs (`sudo certbot certificates`).
- [ ] `/opt/hackerspace/.env.local` and `/opt/supabase/docker/.env` are mode 600, owned by `deploy`.
- [ ] `SERVICE_ROLE_KEY` is set as a Docker secret or env var only, never logged.
- [ ] Studio (`studio.yourdomain.com`) is behind HTTP basic auth and ideally IP-allowlisted.
- [ ] `DASHBOARD_PASSWORD` is strong and stored in a password manager.
- [ ] `JWT_SECRET` is 32+ random bytes, never committed.
- [ ] Migration 015 (`prevent_member_self_role_change`) is applied (verify by trying the self-promotion query in section 12).
- [ ] Daily Postgres backups running, off-site copies enabled.
- [ ] `unattended-upgrades` installed for OS security patches:
      `sudo apt-get install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades`
- [ ] Fail2Ban for SSH:
      `sudo apt-get install -y fail2ban && sudo systemctl enable --now fail2ban`
- [ ] SMTP configured and sending: trigger a password reset email and confirm it arrives.
- [ ] Realtime works end-to-end (verified in section 12).
- [ ] Disk has at least 50 GB free; Postgres grows over time.

---

## 16. Troubleshooting

### App returns 500 on every page

Almost always wrong env vars. Confirm `/opt/hackerspace/.env.local` has the four required values and that `NEXT_PUBLIC_SUPABASE_URL` exactly matches the URL you used in `API_EXTERNAL_URL` in the Supabase `.env`.

`docker compose -f /opt/hackerspace/docker-compose.yml logs app | tail -50` will surface the actual error.

### "Invalid API key" from every Supabase call

The `ANON_KEY` you put in the app does not match the `JWT_SECRET` Supabase signed it with, or you regenerated `JWT_SECRET` without regenerating the keys. Regenerate both JWTs from the current `JWT_SECRET`, paste into both env files, restart both stacks.

### Signup succeeds but `/dashboard` redirects to `/signup` forever

The signup completed in `auth.users` but `space_members` insertion failed (most often migration 014 not applied). Check Studio → Authentication → Users (you should see the new user) and Table Editor → `space_members` (you should see a row). If the row is missing, the trigger or the `createSpace` server action returned an error, look in the app logs.

### Realtime is silent

Two things to check:
1. `comms_messages` and `comms_channels` are in the realtime publication:
   ```sql
   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```
2. Nginx is forwarding WebSocket upgrades. `proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection 'upgrade';` must be present in the `supabase-api` server block.

### `pnpm build` works locally but fails in Docker

Check that the `NEXT_PUBLIC_*` build args were passed (section 10.3). Next.js inlines those at build time; if missing, the client bundle ships with `undefined` for them and the app reports "Failed to fetch" on every Supabase call.

### Postgres uses 100% CPU

Run `pg_stat_activity` from Studio to find the offender:
```sql
SELECT pid, state, query_start, wait_event_type, wait_event, left(query, 200)
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
```
Kill runaway queries with `SELECT pg_terminate_backend(<pid>);`. Add an index. Common culprit: missing index on `comms_messages(channel_id, created_at)` for chat history; the schema already has this, so check that the index exists (`\di idx_comms_messages_*` in psql).

### Out of memory

Supabase realtime and Postgres are the heaviest. Bump the Droplet up one tier. Or, if you do not use Storage / Functions / Edge Runtime, comment those services out of `/opt/supabase/docker/docker-compose.yml`. Easy 1–1.5 GB saved.

### Renewal of SSL certs failed

```bash
sudo systemctl status certbot.timer
sudo journalctl -u certbot | tail -50
```

Most common cause: a hostname stopped resolving. Confirm `dig +short <host>` returns the Droplet IP for every hostname Certbot manages.

---

## Appendix: keeping the app and Supabase versions in sync

The application is versioned per its own `package.json`. Supabase is versioned per the `supabase/supabase` repo's tags. They evolve independently.

- The app pins `@supabase/ssr` and `@supabase/supabase-js` in `package.json`. If you upgrade Supabase server-side (in `/opt/supabase/docker`), check the [Supabase release notes](https://github.com/supabase/supabase/releases) for breaking changes in the JS client.
- Run `pnpm update @supabase/ssr @supabase/supabase-js` in a feature branch, run the test suite (`pnpm vitest run`), redeploy.

For the application-level schema, the source of truth is `scripts/schema.sql` plus the numbered incrementals. The Supabase stack does not manage application schemas; it only provides Postgres and the layers on top.

---

This document covers the full self-hosted path. If anything here drifts from `docs/DEPLOYMENT.md` (the managed-Supabase guide), this document is the source of truth for self-hosted deployments.
