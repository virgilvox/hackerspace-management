#!/usr/bin/env bash
#
# deploy.sh — production deploy hook, run on the Droplet by .github/workflows/deploy.yml.
#
# The GitHub Actions job SSHes into the Droplet on every push to main and invokes the
# deployed copy of this script (conventionally /opt/hackerspace-ops/deploy.sh). It pulls
# the new code, installs deps, applies any pending DB migrations, refreshes PostgREST's
# schema cache, rebuilds, restarts the app, and finally health-probes it.
#
# Every step is defensive and driven by environment variables with sane defaults, so a
# fresh instance can adopt it by setting at most a couple of vars. It fails fast: any
# step that errors aborts the whole deploy (set -e) and the workflow reports failure.
#
# Environment variables (all optional; defaults match docs/DEPLOY_DO_SELFHOSTED.md):
#   APP_DIR               app checkout on the Droplet          (default /opt/hackerspace)
#   DEPLOY_BRANCH         branch to deploy                     (default main)
#   SUPABASE_DIR          self-hosted Supabase compose dir     (default /opt/supabase/docker)
#   SUPABASE_DB_CONTAINER Postgres compose service for migrations (default db)
#   DATABASE_URL          alternative to the two vars above; if set, migrations use it
#                         directly and Supabase-container steps are skipped
#   APP_SERVICE           docker compose service name for the app        (default app)
#   SYSTEMD_APP_UNIT      systemd unit name for a non-Docker app deploy  (default hackerspace-app)
#   SYSTEMD_REST_UNIT     systemd unit for PostgREST when not on Docker  (default postgrest)
#   HEALTH_URL            local health endpoint to probe   (default http://localhost:3000/api/health)

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/hackerspace}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase/docker}"
SUPABASE_DB_CONTAINER="${SUPABASE_DB_CONTAINER:-db}"
APP_SERVICE="${APP_SERVICE:-app}"
SYSTEMD_APP_UNIT="${SYSTEMD_APP_UNIT:-hackerspace-app}"
SYSTEMD_REST_UNIT="${SYSTEMD_REST_UNIT:-postgrest}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

# ---------------------------------------------------------------------------
# 1. Enter the app checkout.
# ---------------------------------------------------------------------------
log "cd to app dir: $APP_DIR"
cd "$APP_DIR"

# ---------------------------------------------------------------------------
# 2. Fetch and hard-reset to the deployed branch. reset --hard (not pull) so a
#    dirty working tree or a force-push never leaves the checkout in a half state.
# ---------------------------------------------------------------------------
log "git fetch + reset to origin/$DEPLOY_BRANCH"
git fetch --prune origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"

# ---------------------------------------------------------------------------
# 3. Install dependencies exactly as locked. --frozen-lockfile fails if the
#    lockfile is out of sync rather than silently resolving new versions.
# ---------------------------------------------------------------------------
log "pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# 4. Apply pending DB migrations. apply-migrations.sh is idempotent; it reads
#    DATABASE_URL if set, otherwise talks to the Supabase Postgres container.
# ---------------------------------------------------------------------------
log "applying database migrations"
if [[ -n "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$DATABASE_URL" bash "$APP_DIR/scripts/apply-migrations.sh"
else
  SUPABASE_DIR="$SUPABASE_DIR" SUPABASE_DB_CONTAINER="$SUPABASE_DB_CONTAINER" \
    bash "$APP_DIR/scripts/apply-migrations.sh"
fi

# ---------------------------------------------------------------------------
# 5. Restart PostgREST so it refreshes its cached schema after any DDL.
#    Documented both ways: the self-hosted Docker Supabase stack exposes the
#    PostgREST service as "rest"; a systemd-managed PostgREST is restarted by unit.
# ---------------------------------------------------------------------------
log "restarting PostgREST to refresh its schema cache"
if [[ -f "$SUPABASE_DIR/docker-compose.yml" ]]; then
  docker compose -f "$SUPABASE_DIR/docker-compose.yml" restart rest
elif command -v systemctl >/dev/null 2>&1; then
  # Non-Docker alternative: a systemd-managed PostgREST unit.
  systemctl restart "$SYSTEMD_REST_UNIT"
else
  log "warning: no $SUPABASE_DIR/docker-compose.yml and no systemctl; skipping PostgREST restart"
  log "         restart PostgREST manually so it picks up schema changes"
fi

# ---------------------------------------------------------------------------
# 6. Build the app.
# ---------------------------------------------------------------------------
log "pnpm build"
pnpm build

# ---------------------------------------------------------------------------
# 7. Restart the app. Prefer a Docker Compose rebuild when this is a
#    Dockerfile-based deploy; otherwise fall back to the systemd unit.
# ---------------------------------------------------------------------------
log "restarting the app"
if [[ -f "$APP_DIR/Dockerfile" ]] && command -v docker >/dev/null 2>&1; then
  docker compose up -d --build "$APP_SERVICE"
elif command -v systemctl >/dev/null 2>&1; then
  systemctl restart "$SYSTEMD_APP_UNIT"
else
  log "error: cannot restart the app (no Dockerfile-based deploy and no systemctl)" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 8. Health probe. Give the freshly restarted app a few seconds to come up,
#    then require a 200 from the local health endpoint.
# ---------------------------------------------------------------------------
log "probing health at $HEALTH_URL"
health_code=""
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  health_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || true)"
  if [[ "$health_code" == "200" ]]; then
    break
  fi
  log "  attempt $attempt: got '${health_code:-no response}', retrying in 3s"
  sleep 3
done

if [[ "$health_code" != "200" ]]; then
  log "error: health check failed (last status: '${health_code:-no response}')" >&2
  exit 1
fi

log "health check passed (200)"
log "deploy complete"
