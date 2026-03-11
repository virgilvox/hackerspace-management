-- =============================================================================
-- Migration 013: Add space_members.last_paid_at
-- =============================================================================
-- Adds last_paid_at column to space_members.
-- This column is written by importMembers() and linkPaymentToMember() in
-- lib/actions.ts. The column last_payment_at already existed as a legacy
-- field; last_paid_at is the canonical name used by the application code.
-- =============================================================================

ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS last_paid_at timestamptz;
