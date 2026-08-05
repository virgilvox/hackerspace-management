-- 056_drop_stale_signup_trigger.sql
-- =============================================================================
-- SECURITY: drop the stale, unsafe auth-signup trigger.
--
-- public.handle_space_signup() (AFTER INSERT ON auth.users, SECURITY DEFINER)
-- read the new member's role and target space from raw_user_meta_data, which is
-- fully client-controlled (the browser calls supabase.auth.signUp with the anon
-- key and GoTrue stores options.data verbatim). A crafted signup with
--   data: { role: 'admin', space_id: '<known-space-uuid>' }
-- would self-insert an admin space_members row (status 'unverified', approved
-- true) with no invite, bypassing createSpace/joinSpace and their guards. Once an
-- admin approves the pending member (which flips status to 'current' without
-- resetting role) the attacker becomes a full admin.
--
-- The legitimate signup flow never puts space_id/role in auth metadata:
-- membership is created only by the createSpace / joinSpace server actions in
-- lib/auth-actions.ts. The trigger was therefore stale as well as exploitable.
-- Drop it outright rather than trying to sanitize client metadata.
--
-- Idempotent. Folded into scripts/schema.sql for fresh installs.
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_space_signup();
