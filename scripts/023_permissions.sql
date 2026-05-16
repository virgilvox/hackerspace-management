-- =============================================================================
-- 023: Customizable permissions, per-item Ops ACLs, area-lead effective roles
-- =============================================================================
-- ADDITIVE and backward compatible. With zero rows in the new tables the app
-- behaves exactly as before: the new SELECT branches on secrets and
-- knowledge_base only OR-in extra access, they never remove the existing
-- role-based access. A space opts in by setting permissions / ACLs.
--
-- Pieces:
--   space_role_permissions  role/custom-role -> permission code grants
--   ops_acl                 per-item allow list (secret | kb | process)
--   user_effective_roles()  built-in role + custom roles + area-lead sentinels
--   user_has_permission()   admin implicit-all, else a grant via effective role
--   secrets/knowledge_base SELECT policies gain an ops_acl OR-branch
--
-- Area-lead roles reuse the existing public.area_leads table: a row is an
-- "area lead role", lead_id IS NULL renders as Vacant, and the assigned
-- member effectively holds the sentinel role 'area_lead:<area_leads.id>'.
-- =============================================================================

-- --- space_role_permissions -------------------------------------------------

CREATE TABLE IF NOT EXISTS public.space_role_permissions (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  -- a built-in member_role value or a space_custom_roles.slug
  subject     text        NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 50),
  permission  text        NOT NULL CHECK (char_length(permission) BETWEEN 1 AND 60),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, subject, permission)
);
CREATE INDEX IF NOT EXISTS idx_role_perms_space ON public.space_role_permissions (space_id, subject);

-- --- ops_acl ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ops_acl (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  entity_type text        NOT NULL CHECK (entity_type IN ('secret','kb','process','area_lead')),
  entity_id   uuid        NOT NULL,
  -- a built-in role, a custom-role slug, or 'area_lead:<area_leads.id>'
  role        text        NOT NULL CHECK (char_length(role) BETWEEN 1 AND 64),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, entity_type, entity_id, role)
);
CREATE INDEX IF NOT EXISTS idx_ops_acl_entity ON public.ops_acl (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ops_acl_space  ON public.ops_acl (space_id);

-- --- effective roles + permission helpers (SECURITY DEFINER, pinned path) ----

-- Every role identifier the user effectively holds in a space: their built-in
-- member_role, every assigned custom-role slug, and 'area_lead:<id>' for each
-- area_leads row they lead. STABLE: safe inside RLS.
CREATE OR REPLACE FUNCTION public.user_effective_roles(uid uuid, sid uuid)
  RETURNS SETOF text
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT sm.role::text
  FROM public.space_members sm
  WHERE sm.user_id = uid AND sm.space_id = sid
  UNION
  SELECT cr.slug
  FROM public.space_members sm
  JOIN public.space_member_custom_roles mcr ON mcr.member_id = sm.id
  JOIN public.space_custom_roles cr ON cr.id = mcr.custom_role_id
  WHERE sm.user_id = uid AND sm.space_id = sid
  UNION
  SELECT 'area_lead:' || al.id::text
  FROM public.space_members sm
  JOIN public.area_leads al ON al.lead_id = sm.id
  WHERE sm.user_id = uid AND sm.space_id = sid AND al.space_id = sid;
$$;

-- admin implicitly holds every permission and can never be locked out.
CREATE OR REPLACE FUNCTION public.user_has_permission(uid uuid, sid uuid, perm text)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT public.user_has_role_in_space(uid, sid, ARRAY['admin'])
      OR EXISTS (
        SELECT 1 FROM public.space_role_permissions p
        WHERE p.space_id = sid
          AND p.permission = perm
          AND p.subject IN (SELECT public.user_effective_roles(uid, sid))
      );
$$;

-- --- RLS on the new tables --------------------------------------------------

ALTER TABLE public.space_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_acl                ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_perms_select ON public.space_role_permissions;
DROP POLICY IF EXISTS role_perms_insert ON public.space_role_permissions;
DROP POLICY IF EXISTS role_perms_update ON public.space_role_permissions;
DROP POLICY IF EXISTS role_perms_delete ON public.space_role_permissions;
CREATE POLICY role_perms_select ON public.space_role_permissions FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY role_perms_insert ON public.space_role_permissions FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY role_perms_update ON public.space_role_permissions FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY role_perms_delete ON public.space_role_permissions FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

DROP POLICY IF EXISTS ops_acl_select ON public.ops_acl;
DROP POLICY IF EXISTS ops_acl_insert ON public.ops_acl;
DROP POLICY IF EXISTS ops_acl_update ON public.ops_acl;
DROP POLICY IF EXISTS ops_acl_delete ON public.ops_acl;
CREATE POLICY ops_acl_select ON public.ops_acl FOR SELECT
  USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())));
CREATE POLICY ops_acl_insert ON public.ops_acl FOR INSERT
  WITH CHECK (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY ops_acl_update ON public.ops_acl FOR UPDATE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));
CREATE POLICY ops_acl_delete ON public.ops_acl FOR DELETE
  USING (public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board']));

-- --- additive ACL branch on secrets + knowledge_base SELECT -----------------
-- The first OR-operand is the EXACT existing policy. The second only widens.

DROP POLICY IF EXISTS secrets_select ON public.secrets;
CREATE POLICY secrets_select ON public.secrets FOR SELECT
  USING (
    public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board'])
    OR EXISTS (
      SELECT 1 FROM public.ops_acl a
      WHERE a.space_id = secrets.space_id
        AND a.entity_type = 'secret'
        AND a.entity_id = secrets.id
        AND a.role IN (SELECT public.user_effective_roles(auth.uid(), secrets.space_id))
    )
  );

DROP POLICY IF EXISTS kb_select ON public.knowledge_base;
CREATE POLICY kb_select ON public.knowledge_base FOR SELECT
  USING (
    (
      space_id IN (SELECT public.get_user_space_ids(auth.uid()))
      AND (
        visibility = 'all_members'
        OR (visibility = 'board'      AND public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin','board','treasurer']))
        OR (visibility = 'admin_only' AND public.user_has_role_in_space(auth.uid(), space_id, ARRAY['admin']))
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.ops_acl a
      WHERE a.space_id = knowledge_base.space_id
        AND a.entity_type IN ('kb','process')
        AND a.entity_id = knowledge_base.id
        AND a.role IN (SELECT public.user_effective_roles(auth.uid(), knowledge_base.space_id))
    )
  );

-- --- seed default role permissions ------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_default_role_permissions()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.space_role_permissions (space_id, subject, permission)
  SELECT NEW.id, d.subject, d.permission
  FROM (VALUES
    ('board','ops.kb.read'),('board','ops.kb.write'),('board','ops.process.read'),
    ('board','ops.process.write'),('board','ops.secrets.read'),('board','ops.secrets.write'),
    ('board','ops.arealeads.manage'),('board','members.manage'),('board','payments.manage'),
    ('board','governance.manage'),('board','forum.moderate'),('board','customize.manage'),
    ('board','settings.manage'),
    ('treasurer','payments.manage'),('treasurer','ops.kb.read'),('treasurer','ops.process.read'),
    ('member','ops.kb.read'),('member','ops.process.read'),
    ('associate','ops.kb.read')
  ) AS d(subject, permission)
  ON CONFLICT (space_id, subject, permission) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_role_permissions ON public.spaces;
CREATE TRIGGER trg_seed_default_role_permissions
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_role_permissions();

-- Backfill existing spaces.
INSERT INTO public.space_role_permissions (space_id, subject, permission)
SELECT s.id, d.subject, d.permission
FROM public.spaces s
CROSS JOIN (VALUES
  ('board','ops.kb.read'),('board','ops.kb.write'),('board','ops.process.read'),
  ('board','ops.process.write'),('board','ops.secrets.read'),('board','ops.secrets.write'),
  ('board','ops.arealeads.manage'),('board','members.manage'),('board','payments.manage'),
  ('board','governance.manage'),('board','forum.moderate'),('board','customize.manage'),
  ('board','settings.manage'),
  ('treasurer','payments.manage'),('treasurer','ops.kb.read'),('treasurer','ops.process.read'),
  ('member','ops.kb.read'),('member','ops.process.read'),
  ('associate','ops.kb.read')
) AS d(subject, permission)
ON CONFLICT (space_id, subject, permission) DO NOTHING;
