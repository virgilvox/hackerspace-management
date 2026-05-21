-- =============================================================================
-- 053: Door inbound access-log ingest (Door epic, phase 4)
-- =============================================================================
-- Phase 4 pulls real entry/denied events FROM a controller INTO door_access_log,
-- via two transports that share one ingest core:
--   * poll: a CRON_SECRET-guarded route reads each enabled connection's log
--     verb (HeatSync ?z) through the existing hardened executor and parses it;
--   * webhook: a per-connection public endpoint accepts normalized event JSON
--     pushed by the controller or a relay, authenticated by a per-connection
--     bearer secret kept in the AES-256-GCM vault.
--
-- This migration is ADDITIVE ONLY (no table re-create, no policy weakening):
--
--   door_access_log.dedupe_key
--     A per-event idempotency token so a re-poll of the same ring-buffer slot
--     or a webhook retry cannot double-insert. Partial-unique on
--     (connection_id, dedupe_key) WHERE dedupe_key IS NOT NULL: existing
--     action rows (grant/revoke/open/self_entry) leave it NULL and are
--     unaffected; only ingested rows set it. The insert path uses ON CONFLICT
--     DO NOTHING against this index.
--
--   door_connections.inbound_enabled (default false; opt-in, like
--     allow_member_self_entry) gates the webhook endpoint for a connection.
--   door_connections.inbound_secret_ref references the SAME secrets vault as
--     secret_ref but holds the INBOUND webhook secret (a distinct credential
--     from the outbound door password). It is loaded + compared server-side
--     only and never returned to the browser.
--
-- PGRST embed note (the migration-048 outage class): door_connections now has
-- two FKs to public.secrets (secret_ref + inbound_secret_ref). This does NOT
-- create the ambiguous-junction shape that broke the auth embed -- that only
-- happens when a table's PRIMARY KEY covers both FK columns; door_connections
-- has a surrogate `id` PK. Nothing embeds secrets through PostgREST anyway
-- (secrets are read service-side by id), and the auth path
-- (space_members <-> spaces) is untouched. Safe.
--
-- No new permission codes: door.manage configures inbound; the cron + webhook
-- writers are the validated service client (door_access_log already has no
-- client INSERT policy and stays immutable from the client).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
-- =============================================================================

ALTER TABLE public.door_access_log
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_door_access_log_dedupe
  ON public.door_access_log (connection_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.door_connections
  ADD COLUMN IF NOT EXISTS inbound_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.door_connections
  ADD COLUMN IF NOT EXISTS inbound_secret_ref uuid REFERENCES public.secrets(id) ON DELETE SET NULL;
