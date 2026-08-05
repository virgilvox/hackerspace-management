#!/usr/bin/env bash
#
# apply-migrations.sh — idempotently apply pending numbered SQL migrations.
#
# For every scripts/0NN_*.sql (in sorted order) this checks public._migrations_applied
# for that filename and, if it is absent, applies the file and records the filename.
# Each file is applied inside a single transaction together with its tracking INSERT,
# so a failure rolls the whole thing back and the file is NOT recorded as applied.
# This makes the script safe to run repeatedly: already-applied files are skipped and
# a re-run with no pending files is a no-op.
#
# How psql is invoked is parameterized via the environment:
#   - DATABASE_URL set          -> psql "$DATABASE_URL"
#   - SUPABASE_DB_CONTAINER set -> docker compose exec -T <container> psql -U postgres -d postgres
#     (optionally scoped to a compose file via SUPABASE_DIR/docker-compose.yml)
#
# Exactly one of those must be set. DATABASE_URL wins if both are present.

set -euo pipefail

# Resolve the directory this script lives in; the migrations sit alongside it.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Decide how to reach psql.
# ---------------------------------------------------------------------------
if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL_MODE="url"
elif [[ -n "${SUPABASE_DB_CONTAINER:-}" ]]; then
  PSQL_MODE="docker"
else
  echo "error: set DATABASE_URL or SUPABASE_DB_CONTAINER to tell this script how to reach Postgres" >&2
  exit 1
fi

# Optional compose-file scope for the docker path (e.g. /opt/supabase/docker).
_compose_file_args=()
if [[ "$PSQL_MODE" == "docker" && -n "${SUPABASE_DIR:-}" ]]; then
  _compose_file_args=(-f "$SUPABASE_DIR/docker-compose.yml")
fi

# run_psql: pipe SQL on stdin into Postgres. Extra args are passed to psql.
run_psql() {
  if [[ "$PSQL_MODE" == "url" ]]; then
    psql "$DATABASE_URL" "$@"
  else
    docker compose "${_compose_file_args[@]}" exec -T "$SUPABASE_DB_CONTAINER" \
      psql -U postgres -d postgres "$@"
  fi
}

# ---------------------------------------------------------------------------
# Make sure the tracking table exists. It is also created by scripts/schema.sql
# on a fresh database; this guard keeps the script self-sufficient and idempotent.
# ---------------------------------------------------------------------------
run_psql -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS public._migrations_applied (
  filename   text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

# already_applied FILENAME -> success (0) if the filename is recorded.
already_applied() {
  local fn="$1"
  local out
  out="$(run_psql -tAqc "SELECT 1 FROM public._migrations_applied WHERE filename = '${fn}' LIMIT 1")"
  [[ "$out" == *1* ]]
}

# apply_one FILE FILENAME -> apply the SQL and record it, all in one transaction.
# --single-transaction wraps stdin in BEGIN/COMMIT; ON_ERROR_STOP aborts (and thus
# rolls back) on the first error, so the tracking INSERT never lands for a file that
# did not fully apply.
apply_one() {
  local file="$1" fn="$2"
  {
    cat "$file"
    printf "\nINSERT INTO public._migrations_applied (filename) VALUES ('%s') ON CONFLICT (filename) DO NOTHING;\n" "$fn"
  } | run_psql --single-transaction -v ON_ERROR_STOP=1 -q
}

# ---------------------------------------------------------------------------
# Walk the numbered migrations in sorted order.
# ---------------------------------------------------------------------------
shopt -s nullglob
mapfile -t migrations < <(printf '%s\n' "$SCRIPT_DIR"/0*.sql | sort)
shopt -u nullglob

applied_count=0
for file in "${migrations[@]}"; do
  fn="$(basename "$file")"
  if already_applied "$fn"; then
    continue
  fi
  apply_one "$file" "$fn"
  echo "applied $fn"
  applied_count=$((applied_count + 1))
done

if [[ "$applied_count" -eq 0 ]]; then
  echo "up to date"
fi
