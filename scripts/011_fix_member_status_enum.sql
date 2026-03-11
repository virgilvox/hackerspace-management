-- =====================================================
-- 011: FIX ALL ENUM MISMATCHES
-- Ground truth from live DB:
--   member_status = current, late, inactive, unverified
--   (NO 'active', NO 'pending')
--
-- mapping:
--   'active'  -> 'current'
--   'pending' -> 'unverified'  (awaiting approval)
--   'inactive'-> 'inactive'    (same)
-- =====================================================

-- 1. Fix handle_space_signup trigger to use correct enum values
CREATE OR REPLACE FUNCTION public.handle_space_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_space_id uuid;
  v_action text;
  v_space_name text;
  v_space_slug text;
  v_space_city text;
  v_invite_code text;
BEGIN
  v_action := coalesce(new.raw_user_meta_data ->> 'space_action', '');

  IF v_action = 'create' THEN
    v_space_name  := new.raw_user_meta_data ->> 'space_name';
    v_space_slug  := new.raw_user_meta_data ->> 'space_slug';
    v_space_city  := new.raw_user_meta_data ->> 'space_city';
    v_invite_code := new.raw_user_meta_data ->> 'invite_code';

    INSERT INTO public.spaces (name, slug, city, invite_code)
    VALUES (v_space_name, v_space_slug, v_space_city, v_invite_code)
    RETURNING id INTO v_space_id;

    -- 'current' is the correct active member_status value
    INSERT INTO public.space_members (space_id, user_id, display_name, email, role, tier, status, approved)
    VALUES (
      v_space_id,
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', 'Admin'),
      new.email,
      'admin',
      'plus',
      'current',
      true
    );

  ELSIF v_action = 'join' THEN
    v_invite_code := new.raw_user_meta_data ->> 'join_invite_code';

    SELECT id INTO v_space_id FROM public.spaces WHERE invite_code = v_invite_code;

    IF v_space_id IS NOT NULL THEN
      INSERT INTO public.space_members (space_id, user_id, display_name, email, role, tier, status, approved)
      SELECT
        v_space_id,
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', 'Member'),
        new.email,
        'member',
        'basic',
        -- 'unverified' = awaiting approval, 'current' = directly active
        CASE WHEN s.require_approval THEN 'unverified' ELSE 'current' END,
        CASE WHEN s.require_approval THEN false ELSE true END
      FROM public.spaces s WHERE s.id = v_space_id;
    END IF;
  END IF;

  RETURN new;
END;
$$;

-- 2. Fix the RLS helper to not filter on status at all (any member of the space, regardless of status)
-- This ensures even unverified members can at least log in and see their space
CREATE OR REPLACE FUNCTION public.get_user_space_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT space_id FROM public.space_members WHERE user_id = uid
$$;

-- 3. Backfill any existing 'active' or 'pending' values that are stuck
-- These were inserted by old buggy code
UPDATE public.space_members SET status = 'current'::member_status
  WHERE status::text = 'active';
