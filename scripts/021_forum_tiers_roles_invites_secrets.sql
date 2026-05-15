-- =============================================================================
-- 021: Forum + polymorphic comments, custom tiers, custom role labels and
--      custom roles, multi-code invites, secrets encryption-at-rest.
-- =============================================================================
-- Adds five feature subsystems in one idempotent migration. Each section is
-- self-contained and re-runnable; the migration runner (deploy.sh) tracks
-- this file in public._migrations_applied so it only fires once per environment.
--
-- Sections:
--   1. Comment entity-type enum + polymorphic comments + forum_threads
--   2. Custom membership tiers with prices, billing cadence
--   3. Role label customization + custom (non-privileged) org roles
--   4. Multi-code invites with expiry and use caps
--   5. Secrets: ciphertext + IV columns for AES-256-GCM at rest
--   6. comms_channels INSERT policy: any member of the space can create one
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Forum threads + polymorphic comments
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.comment_entity_type AS ENUM ('forum_thread','proposal','incident','policy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.forum_threads (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id        uuid        NOT NULL REFERENCES public.spaces(id)        ON DELETE CASCADE,
  author_id       uuid        REFERENCES public.space_members(id)          ON DELETE SET NULL,
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body            text,
  category        text        NOT NULL DEFAULT 'general',
  pinned          boolean     NOT NULL DEFAULT false,
  locked          boolean     NOT NULL DEFAULT false,
  comment_count   integer     NOT NULL DEFAULT 0,
  last_comment_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_space
  ON public.forum_threads (space_id, last_comment_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_forum_threads_space_pinned
  ON public.forum_threads (space_id, pinned DESC, last_comment_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.comments (
  id          uuid                       PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid                       NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  entity_type public.comment_entity_type NOT NULL,
  entity_id   uuid                       NOT NULL,
  author_id   uuid                       REFERENCES public.space_members(id) ON DELETE SET NULL,
  parent_id   uuid                       REFERENCES public.comments(id) ON DELETE CASCADE,
  body        text                       NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  edited_at   timestamptz,
  created_at  timestamptz                NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON public.comments (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_space  ON public.comments (space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments (author_id);

-- Maintain forum_threads counters on comment insert/delete.
CREATE OR REPLACE FUNCTION public.touch_thread_on_comment()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.entity_type = 'forum_thread') THEN
    UPDATE public.forum_threads
      SET comment_count   = comment_count + 1,
          last_comment_at = NEW.created_at,
          updated_at      = now()
    WHERE id = NEW.entity_id;
  ELSIF (TG_OP = 'DELETE' AND OLD.entity_type = 'forum_thread') THEN
    UPDATE public.forum_threads
      SET comment_count = GREATEST(comment_count - 1, 0),
          updated_at    = now()
    WHERE id = OLD.entity_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_thread_on_comment ON public.comments;
CREATE TRIGGER trg_touch_thread_on_comment
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_thread_on_comment();

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_threads_select ON public.forum_threads;
DROP POLICY IF EXISTS forum_threads_insert ON public.forum_threads;
DROP POLICY IF EXISTS forum_threads_update ON public.forum_threads;
DROP POLICY IF EXISTS forum_threads_delete ON public.forum_threads;
CREATE POLICY forum_threads_select ON public.forum_threads FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY forum_threads_insert ON public.forum_threads FOR INSERT
  WITH CHECK (
    space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    AND (
      author_id IS NULL
      OR author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid() AND space_id = forum_threads.space_id)
    )
  );
CREATE POLICY forum_threads_update ON public.forum_threads FOR UPDATE
  USING (
    (author_id IS NOT NULL AND author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid()))
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
  );
CREATE POLICY forum_threads_delete ON public.forum_threads FOR DELETE
  USING (
    (author_id IS NOT NULL AND author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid()))
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin'])
  );

DROP POLICY IF EXISTS comments_select ON public.comments;
DROP POLICY IF EXISTS comments_insert ON public.comments;
DROP POLICY IF EXISTS comments_update ON public.comments;
DROP POLICY IF EXISTS comments_delete ON public.comments;
CREATE POLICY comments_select ON public.comments FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY comments_insert ON public.comments FOR INSERT
  WITH CHECK (
    space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    AND (
      author_id IS NULL
      OR author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid() AND space_id = comments.space_id)
    )
  );
CREATE POLICY comments_update ON public.comments FOR UPDATE
  USING (
    author_id IS NOT NULL AND author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid())
  );
CREATE POLICY comments_delete ON public.comments FOR DELETE
  USING (
    (author_id IS NOT NULL AND author_id IN (SELECT id FROM public.space_members WHERE user_id = auth.uid()))
    OR public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
  );


-- -----------------------------------------------------------------------------
-- 2. Custom membership tiers (per-space, with price and billing cadence)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.space_tiers (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id            uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  slug                text        NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 50),
  name                text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description         text,
  monthly_price_cents integer     NOT NULL DEFAULT 0 CHECK (monthly_price_cents >= 0),
  billing_cadence     text        NOT NULL DEFAULT 'monthly' CHECK (billing_cadence IN ('monthly','quarterly','annual','one_time','custom')),
  is_system           boolean     NOT NULL DEFAULT false,
  is_archived         boolean     NOT NULL DEFAULT false,
  sort_order          integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_space_tiers_space ON public.space_tiers (space_id, sort_order, name);

ALTER TABLE public.space_members
  ADD COLUMN IF NOT EXISTS tier_id uuid REFERENCES public.space_tiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_space_members_tier_id ON public.space_members (tier_id);

-- Seed default tiers on space creation (matches the legacy enum values).
CREATE OR REPLACE FUNCTION public.seed_default_tiers()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.space_tiers (space_id, slug, name, description, monthly_price_cents, billing_cadence, is_system, sort_order)
  VALUES
    (NEW.id, 'plus',      'Plus',      'Full access including 24/7 keycard',                 0, 'monthly', true, 0),
    (NEW.id, 'basic',     'Basic',     'Standard member access during open hours',           0, 'monthly', true, 1),
    (NEW.id, 'associate', 'Associate', 'Limited access for adjacent community members',      0, 'monthly', true, 2)
  ON CONFLICT (space_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_tiers ON public.spaces;
CREATE TRIGGER trg_seed_default_tiers
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_tiers();

-- Backfill default tiers for spaces that already exist.
INSERT INTO public.space_tiers (space_id, slug, name, description, monthly_price_cents, billing_cadence, is_system, sort_order)
SELECT s.id, t.slug, t.name, t.description, 0, 'monthly', true, t.sort_order
FROM public.spaces s
CROSS JOIN (VALUES
  ('plus',      'Plus',      'Full access including 24/7 keycard',            0),
  ('basic',     'Basic',     'Standard member access during open hours',      1),
  ('associate', 'Associate', 'Limited access for adjacent community members', 2)
) AS t(slug, name, description, sort_order)
ON CONFLICT (space_id, slug) DO NOTHING;

-- Backfill existing members' tier_id from the legacy enum value.
UPDATE public.space_members sm
SET tier_id = t.id
FROM public.space_tiers t
WHERE t.space_id = sm.space_id
  AND t.slug = sm.tier::text
  AND sm.tier_id IS NULL;

ALTER TABLE public.space_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tiers_select ON public.space_tiers;
DROP POLICY IF EXISTS tiers_insert ON public.space_tiers;
DROP POLICY IF EXISTS tiers_update ON public.space_tiers;
DROP POLICY IF EXISTS tiers_delete ON public.space_tiers;
CREATE POLICY tiers_select ON public.space_tiers FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY tiers_insert ON public.space_tiers FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY tiers_update ON public.space_tiers FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
-- Deleting a system tier is blocked; deleting a custom tier requires admin.
CREATE POLICY tiers_delete ON public.space_tiers FOR DELETE
  USING (
    public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin'])
    AND NOT is_system
  );


-- -----------------------------------------------------------------------------
-- 3. Role label customization + custom org roles
--    The built-in member_role enum still drives RLS. space_role_labels lets a
--    space re-label/recolor the built-ins (e.g. rename "treasurer" to "money
--    keeper"). space_custom_roles lets a space add additional non-privileged
--    labels for org structure (committees, area leads by name, etc).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.space_role_labels (
  id           uuid               PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     uuid               NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  role         public.member_role NOT NULL,
  display_name text,
  description  text,
  color        text,
  sort_order   integer            NOT NULL DEFAULT 0,
  created_at   timestamptz        NOT NULL DEFAULT now(),
  updated_at   timestamptz        NOT NULL DEFAULT now(),
  UNIQUE (space_id, role)
);

CREATE TABLE IF NOT EXISTS public.space_custom_roles (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  slug        text        NOT NULL CHECK (slug ~* '^[a-z0-9][a-z0-9_-]{0,49}$'),
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description text,
  color       text,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, slug)
);

CREATE TABLE IF NOT EXISTS public.space_member_custom_roles (
  member_id      uuid        NOT NULL REFERENCES public.space_members(id)     ON DELETE CASCADE,
  custom_role_id uuid        NOT NULL REFERENCES public.space_custom_roles(id) ON DELETE CASCADE,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, custom_role_id)
);

CREATE INDEX IF NOT EXISTS idx_space_role_labels_space   ON public.space_role_labels   (space_id);
CREATE INDEX IF NOT EXISTS idx_space_custom_roles_space  ON public.space_custom_roles  (space_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_member_custom_roles_role  ON public.space_member_custom_roles (custom_role_id);

ALTER TABLE public.space_role_labels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_custom_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_member_custom_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_labels_select ON public.space_role_labels;
DROP POLICY IF EXISTS role_labels_insert ON public.space_role_labels;
DROP POLICY IF EXISTS role_labels_update ON public.space_role_labels;
DROP POLICY IF EXISTS role_labels_delete ON public.space_role_labels;
CREATE POLICY role_labels_select ON public.space_role_labels FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY role_labels_insert ON public.space_role_labels FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY role_labels_update ON public.space_role_labels FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY role_labels_delete ON public.space_role_labels FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

DROP POLICY IF EXISTS custom_roles_select ON public.space_custom_roles;
DROP POLICY IF EXISTS custom_roles_insert ON public.space_custom_roles;
DROP POLICY IF EXISTS custom_roles_update ON public.space_custom_roles;
DROP POLICY IF EXISTS custom_roles_delete ON public.space_custom_roles;
CREATE POLICY custom_roles_select ON public.space_custom_roles FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY custom_roles_insert ON public.space_custom_roles FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY custom_roles_update ON public.space_custom_roles FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY custom_roles_delete ON public.space_custom_roles FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

DROP POLICY IF EXISTS member_custom_roles_select ON public.space_member_custom_roles;
DROP POLICY IF EXISTS member_custom_roles_insert ON public.space_member_custom_roles;
DROP POLICY IF EXISTS member_custom_roles_delete ON public.space_member_custom_roles;
CREATE POLICY member_custom_roles_select ON public.space_member_custom_roles FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM public.space_members
      WHERE space_id IN (SELECT public.get_user_space_ids(auth.uid()))
    )
  );
CREATE POLICY member_custom_roles_insert ON public.space_member_custom_roles FOR INSERT
  WITH CHECK (
    member_id IN (
      SELECT sm.id FROM public.space_members sm
      WHERE public.user_has_role_in_space(auth.uid(), sm.space_id, ARRAY['admin','board'])
    )
  );
CREATE POLICY member_custom_roles_delete ON public.space_member_custom_roles FOR DELETE
  USING (
    member_id IN (
      SELECT sm.id FROM public.space_members sm
      WHERE public.user_has_role_in_space(auth.uid(), sm.space_id, ARRAY['admin','board'])
    )
  );


-- -----------------------------------------------------------------------------
-- 4. Multi-code invites
--    The legacy `spaces.invite_code` is kept as a permanent fallback. This
--    table lets each space hold any number of additional invite codes with
--    independent expiry, use caps, and enable/disable.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.space_invites (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  code        text        NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 4 AND 32),
  label       text,
  expires_at  timestamptz,
  max_uses    integer CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count  integer     NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  is_enabled  boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES public.space_members(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_space_invites_space ON public.space_invites (space_id, is_enabled, expires_at);
CREATE INDEX IF NOT EXISTS idx_space_invites_code  ON public.space_invites (code) WHERE is_enabled;

-- Backfill: every existing space's legacy invite_code becomes a permanent,
-- enabled, label="Default" invite in space_invites.
INSERT INTO public.space_invites (space_id, code, label, is_enabled, max_uses, expires_at)
SELECT s.id, upper(s.invite_code), 'Default', true, NULL, NULL
FROM public.spaces s
WHERE s.invite_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.space_invites si WHERE si.code = upper(s.invite_code)
  );

ALTER TABLE public.space_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invites_select ON public.space_invites;
DROP POLICY IF EXISTS invites_insert ON public.space_invites;
DROP POLICY IF EXISTS invites_update ON public.space_invites;
DROP POLICY IF EXISTS invites_delete ON public.space_invites;
CREATE POLICY invites_select ON public.space_invites FOR SELECT
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']));
CREATE POLICY invites_insert ON public.space_invites FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY invites_update ON public.space_invites FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY invites_delete ON public.space_invites FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));


-- -----------------------------------------------------------------------------
-- 5. Secrets: encryption-at-rest columns
--    The application encrypts new values with AES-256-GCM (key from the
--    SECRETS_ENCRYPTION_KEY env var) and stores ciphertext in this column.
--    The legacy `value` column is left intact for backward compatibility on
--    existing rows; the app prefers `encrypted_value` when present and the
--    list endpoint omits both columns from SELECT until an explicit reveal.
-- -----------------------------------------------------------------------------

ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS encrypted_value    bytea;
ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS encryption_version smallint NOT NULL DEFAULT 0;
-- encryption_version = 0 means: no encrypted_value; fall back to `value`.
-- encryption_version = 1 means: AES-256-GCM, IV || ciphertext || authTag packed in encrypted_value.

-- Tighten secrets RLS update/delete to admin/board only (already in baseline,
-- redeclare here for completeness).
DROP POLICY IF EXISTS secrets_select ON public.secrets;
DROP POLICY IF EXISTS secrets_insert ON public.secrets;
DROP POLICY IF EXISTS secrets_update ON public.secrets;
DROP POLICY IF EXISTS secrets_delete ON public.secrets;
CREATE POLICY secrets_select ON public.secrets FOR SELECT
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY secrets_insert ON public.secrets FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY secrets_update ON public.secrets FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY secrets_delete ON public.secrets FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));


-- -----------------------------------------------------------------------------
-- 6. comms_channels: any member of the space can create a channel.
--    Update/delete still belong to admin/board, except for the creator who can
--    rename or delete their own non-default channel.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS channels_insert ON public.comms_channels;
CREATE POLICY channels_insert ON public.comms_channels FOR INSERT
  WITH CHECK (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
DROP POLICY IF EXISTS channels_update ON public.comms_channels;
CREATE POLICY channels_update ON public.comms_channels FOR UPDATE
  USING (
    public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
    OR created_by = auth.uid()
  );
DROP POLICY IF EXISTS channels_delete ON public.comms_channels;
CREATE POLICY channels_delete ON public.comms_channels FOR DELETE
  USING (
    NOT is_default
    AND (
      public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
      OR created_by = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 7. knowledge_base: opt-in markdown rendering flag (default on for new rows).
-- -----------------------------------------------------------------------------

ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS render_markdown boolean NOT NULL DEFAULT true;


-- -----------------------------------------------------------------------------
-- 8. Touch updated_at on the new tables.
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_forum_threads_touch       ON public.forum_threads;
DROP TRIGGER IF EXISTS trg_space_tiers_touch          ON public.space_tiers;
DROP TRIGGER IF EXISTS trg_space_role_labels_touch    ON public.space_role_labels;
DROP TRIGGER IF EXISTS trg_space_custom_roles_touch   ON public.space_custom_roles;
DROP TRIGGER IF EXISTS trg_space_invites_touch        ON public.space_invites;

CREATE TRIGGER trg_forum_threads_touch
  BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_space_tiers_touch
  BEFORE UPDATE ON public.space_tiers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_space_role_labels_touch
  BEFORE UPDATE ON public.space_role_labels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_space_custom_roles_touch
  BEFORE UPDATE ON public.space_custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_space_invites_touch
  BEFORE UPDATE ON public.space_invites
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
