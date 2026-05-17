-- =============================================================================
-- 029: Invite codes can grant a role
-- =============================================================================
-- An invite can now mint a member at a chosen role (e.g. a single-use link
-- that makes the joiner an admin). The role reuses the existing member_role
-- enum, so the value set is constrained by the type. Default 'member'
-- preserves the behaviour of every existing invite and the legacy
-- spaces.invite_code path.
--
-- Security note: who may CREATE a role-granting invite is enforced in the
-- application (lib/actions/invites.ts + lib/invite-logic.ts): invite creation
-- is admin/board-gated, and only an admin may create an invite that grants
-- 'admin'. This column just records the granted role; joinSpace applies it.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE public.space_invites
  ADD COLUMN IF NOT EXISTS role public.member_role NOT NULL DEFAULT 'member';
