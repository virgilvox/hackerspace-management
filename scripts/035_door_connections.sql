-- =============================================================================
-- 035: Door connections + access log (Door epic, phase 2)
-- =============================================================================
-- door_connections is a per-space configured integration to a physical door
-- controller. SECURITY-CRITICAL:
--
--   * The shared door password is NOT stored here. secret_ref references a
--     row in the existing AES-256-GCM `secrets` vault; the executor loads and
--     decrypts it server-side only and never returns/logs it.
--   * pinned_host is the SSRF pin: the executor will only ever call that exact
--     host (no redirects, size/time caps). The app is cloud-hosted, so the
--     target may be a public controller/proxy OR a VPN-reachable LAN device;
--     any pinned host is allowed (public or private) EXCEPT cloud-metadata /
--     link-local, which are always blocked.
--   * adapter is 'native_heatsync' (verified query-string firmware) or
--     'generic_http' (admin-supplied per-verb templates).
--   * allow_member_self_entry opts a connection into the member "buzz me in"
--     action (phase 3). Off by default; elevated risk, per-connection only.
--
-- door_access_log is an append-only audit of every door action (who, what,
-- result), with secrets redacted before write. No client write policy: only
-- the validated service-client executor inserts rows.
--
-- No new permission codes: door.manage / door.operate were added in 034.
-- RLS (additive, default-deny; the guarded surface):
--   * door_connections: all CRUD = door.manage.
--   * door_access_log SELECT = door.manage OR door.operate; NO
--     INSERT/UPDATE/DELETE policy (service-client executor only; immutable).
-- No anonymous path.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS then
-- CREATE.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.door_connections (
  id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id                uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name                    text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  adapter                 text        NOT NULL DEFAULT 'generic_http'
                                      CHECK (adapter IN ('native_heatsync','generic_http')),
  base_url                text        NOT NULL CHECK (base_url ~ '^https?://'),
  pinned_host             text        NOT NULL CHECK (char_length(pinned_host) BETWEEN 1 AND 255),
  auth_mode               text        NOT NULL DEFAULT 'none'
                                      CHECK (auth_mode IN ('none','query','header','bearer')),
  auth_param              text,
  secret_ref              uuid        REFERENCES public.secrets(id) ON DELETE SET NULL,
  verbs                   jsonb       NOT NULL DEFAULT '{}',
  allow_member_self_entry boolean     NOT NULL DEFAULT false,
  is_enabled              boolean     NOT NULL DEFAULT true,
  created_by              uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_door_connections_space ON public.door_connections (space_id);

CREATE TABLE IF NOT EXISTS public.door_access_log (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id         uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  connection_id    uuid        REFERENCES public.door_connections(id) ON DELETE SET NULL,
  actor_member_id  uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  target_member_id uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  action           text        NOT NULL,
  success          boolean     NOT NULL DEFAULT false,
  detail           text,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_door_access_log_space ON public.door_access_log (space_id, occurred_at DESC);

ALTER TABLE public.door_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.door_access_log  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS door_connections_select ON public.door_connections;
DROP POLICY IF EXISTS door_connections_insert ON public.door_connections;
DROP POLICY IF EXISTS door_connections_update ON public.door_connections;
DROP POLICY IF EXISTS door_connections_delete ON public.door_connections;
CREATE POLICY door_connections_select ON public.door_connections FOR SELECT
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY door_connections_insert ON public.door_connections FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY door_connections_update ON public.door_connections FOR UPDATE
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));
CREATE POLICY door_connections_delete ON public.door_connections FOR DELETE
  USING (public.user_has_permission(auth.uid(), space_id, 'door.manage'));

DROP POLICY IF EXISTS door_access_log_select ON public.door_access_log;
CREATE POLICY door_access_log_select ON public.door_access_log FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), space_id, 'door.manage')
    OR public.user_has_permission(auth.uid(), space_id, 'door.operate')
  );
-- No INSERT/UPDATE/DELETE policy: the validated service-client executor is
-- the only writer, and the audit trail is immutable.

DROP TRIGGER IF EXISTS trg_door_connections_touch ON public.door_connections;
CREATE TRIGGER trg_door_connections_touch
  BEFORE UPDATE ON public.door_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
