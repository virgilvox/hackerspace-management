-- =============================================================================
-- 028: Form slug is unique PER SPACE, not globally
-- =============================================================================
-- The public form URL is moving from /f/[slug] to /f/[space]/[slug], so the
-- form slug only needs to be unique within a space (and global uniqueness was
-- a cross-tenant slug-squatting footgun). Drop the global UNIQUE(slug) and add
-- UNIQUE(space_id, slug).
--
-- `forms_slug_key` is the auto-generated name for the inline column UNIQUE in
-- migration 026 / schema.sql. Idempotent: DROP IF EXISTS the old and the new
-- constraint, then ADD.
-- =============================================================================

ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_slug_key;
ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_space_slug_key;
ALTER TABLE public.forms
  ADD CONSTRAINT forms_space_slug_key UNIQUE (space_id, slug);
