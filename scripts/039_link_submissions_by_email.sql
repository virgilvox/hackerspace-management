-- =============================================================================
-- 039: Backfill -- associate existing form submissions with members by email
-- =============================================================================
-- One-time DATA backfill (no structural change; form_submissions.member_id
-- already exists). Links every unlinked submission to the member in the same
-- space whose email matches submitter_email (case-insensitive). When more
-- than one member shares an email in a space, the earliest-joined one is
-- chosen so the result is deterministic and matches the application logic
-- (lib/forms-logic.ts pickMemberForEmail).
--
-- Idempotent: only rows with member_id IS NULL are touched, so re-running is
-- a no-op. Not mirrored in scripts/schema.sql (a fresh database has no
-- submissions to backfill); the ongoing linking happens in the app
-- (submitForm + linkSubmissionsByEmail on member create/email-change).
-- =============================================================================

UPDATE public.form_submissions fs
SET member_id = (
  SELECT m.id
  FROM public.space_members m
  WHERE m.space_id = fs.space_id
    AND m.email IS NOT NULL
    AND lower(m.email) = lower(fs.submitter_email)
  ORDER BY m.joined_at ASC NULLS FIRST, m.id ASC
  LIMIT 1
)
WHERE fs.member_id IS NULL
  AND fs.submitter_email IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.space_members m
    WHERE m.space_id = fs.space_id
      AND m.email IS NOT NULL
      AND lower(m.email) = lower(fs.submitter_email)
  );
