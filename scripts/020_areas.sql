-- =============================================================================
-- 020: Per-space areas table with seeded defaults
-- =============================================================================
-- Currently `tasks.area`, `projects.area`, `knowledge_base.area`, etc are free
-- text. The UI hard-codes a list of nine area names in each client component.
-- This migration:
--
--   1. Creates `space_areas`: rows of (space_id, code, name, icon, sort_order,
--      is_archived). Each space has its own list.
--   2. Adds a trigger that seeds ten sensible defaults whenever a `spaces`
--      row is inserted.
--   3. Backfills every existing space with the defaults (idempotent —
--      skipped where the space already has at least one area row).
--
-- Existing `tasks.area` / `projects.area` text columns are unchanged; values
-- still match by name. Renaming an area does NOT cascade; admins re-tag
-- existing rows if they care. This is acceptable for a small CRUD app.
--
-- Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.space_areas (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  code        text        NOT NULL,
  name        text        NOT NULL,
  icon        text,
  sort_order  integer     NOT NULL DEFAULT 100,
  is_archived boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, code),
  UNIQUE (space_id, name)
);

CREATE INDEX IF NOT EXISTS idx_space_areas_space_sort
  ON public.space_areas (space_id, sort_order, name);

ALTER TABLE public.space_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS space_areas_select ON public.space_areas;
DROP POLICY IF EXISTS space_areas_insert ON public.space_areas;
DROP POLICY IF EXISTS space_areas_update ON public.space_areas;
DROP POLICY IF EXISTS space_areas_delete ON public.space_areas;

CREATE POLICY space_areas_select ON public.space_areas FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY space_areas_insert ON public.space_areas FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY space_areas_update ON public.space_areas FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY space_areas_delete ON public.space_areas FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']));

DROP TRIGGER IF EXISTS trg_space_areas_touch ON public.space_areas;
CREATE TRIGGER trg_space_areas_touch
  BEFORE UPDATE ON public.space_areas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- Seed defaults when a new space is created.
CREATE OR REPLACE FUNCTION public.seed_default_areas()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.space_areas (space_id, code, name, sort_order) VALUES
    (NEW.id, '3d-printing', '3D Printing',  10),
    (NEW.id, 'electronics', 'Electronics',  20),
    (NEW.id, 'woodshop',    'Woodshop',     30),
    (NEW.id, 'laser',       'Laser',        40),
    (NEW.id, 'metal-shop',  'Metal Shop',   50),
    (NEW.id, 'facilities',  'Facilities',   60),
    (NEW.id, 'software',    'Software',     70),
    (NEW.id, 'kitchen',     'Kitchen',      80),
    (NEW.id, 'admin',       'Admin',        90),
    (NEW.id, 'general',     'General',     100)
  ON CONFLICT (space_id, code) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_areas ON public.spaces;
CREATE TRIGGER trg_seed_default_areas
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_areas();


-- Backfill every existing space that has no areas yet.
INSERT INTO public.space_areas (space_id, code, name, sort_order)
SELECT s.id, d.code, d.name, d.sort_order
FROM public.spaces s
CROSS JOIN (VALUES
  ('3d-printing', '3D Printing',  10),
  ('electronics', 'Electronics',  20),
  ('woodshop',    'Woodshop',     30),
  ('laser',       'Laser',        40),
  ('metal-shop',  'Metal Shop',   50),
  ('facilities',  'Facilities',   60),
  ('software',    'Software',     70),
  ('kitchen',     'Kitchen',      80),
  ('admin',       'Admin',        90),
  ('general',     'General',     100)
) AS d(code, name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.space_areas a WHERE a.space_id = s.id
)
ON CONFLICT (space_id, code) DO NOTHING;
