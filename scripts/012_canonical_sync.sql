-- Migration 012: Sync existing databases to canonical schema
-- Run this on any existing Hackerspace deployment to align with the canonical schema.sql
-- Safe to run multiple times (idempotent).
--
-- Changes:
--   • Rename space_members.full_name → display_name (to match app code everywhere)
--   • Drop redundant tasks.type text column (canonical column is task_type enum)
--   • Add missing columns to all tables that the app code expects
--   • Create missing unique constraints for upserts
--   • Update handle_space_signup trigger to match canonical version

-- ============================================================
-- RENAME COLUMNS
-- ============================================================
ALTER TABLE public.space_members RENAME COLUMN full_name TO display_name;
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS handle text;
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS dues_paid_until timestamptz;
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS has_card_access boolean NOT NULL DEFAULT false;
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS payment_status text;
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS payment_note text;
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS last_payment_at timestamptz;
ALTER TABLE public.space_members ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- TASKS TABLE FIXES
-- ============================================================
-- Drop the redundant text 'type' column if it exists (canonical column is task_type enum)
ALTER TABLE public.tasks DROP COLUMN IF EXISTS type CASCADE;

-- Ensure all canonical task columns exist
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS requested_by_name text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS claimed_by_name text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to_name text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_done_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS subtask_total integer NOT NULL DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS subtask_completed integer NOT NULL DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;

-- ============================================================
-- SPACES TABLE
-- ============================================================
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Phoenix';
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS invite_code text;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS require_approval boolean NOT NULL DEFAULT true;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS public_member_directory boolean NOT NULL DEFAULT false;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS webhook_secret text;

-- ============================================================
-- PAYMENTS TABLE
-- ============================================================
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS from_identifier text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS from_note text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS member_name text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS link_status public.payment_link_status NOT NULL DEFAULT 'unlinked';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transaction_date timestamptz DEFAULT now();

-- ============================================================
-- CONTACTS TABLE
-- ============================================================
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS group_label text;

-- ============================================================
-- KNOWLEDGE BASE
-- ============================================================
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS access_level text DEFAULT 'all_members';
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS updated_by_id uuid REFERENCES public.space_members(id) ON DELETE SET NULL;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS updated_by_name text;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS updated_by text;

-- ============================================================
-- SECRETS TABLE
-- ============================================================
ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS title text;
-- Backfill title from label where label exists and title is null
UPDATE public.secrets SET title = label WHERE title IS NULL AND label IS NOT NULL;

-- ============================================================
-- AREA LEADS TABLE
-- ============================================================
ALTER TABLE public.area_leads ADD COLUMN IF NOT EXISTS area_code text;
ALTER TABLE public.area_leads ADD COLUMN IF NOT EXISTS lead_handle text;

-- Add unique constraint on (space_id, area_code) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'area_leads_space_area_code_key'
  ) THEN
    ALTER TABLE public.area_leads ADD CONSTRAINT area_leads_space_area_code_key
      UNIQUE (space_id, area_code) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- ============================================================
-- INTEGRATIONS TABLE
-- ============================================================
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS config jsonb;

-- ============================================================
-- COMMS CHANNELS
-- ============================================================
ALTER TABLE public.comms_channels ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.comms_channels ADD COLUMN IF NOT EXISTS area_reference text;
ALTER TABLE public.comms_channels ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.comms_channels ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0;

-- ============================================================
-- COMMS MESSAGES
-- ============================================================
ALTER TABLE public.comms_messages ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.comms_messages ADD COLUMN IF NOT EXISTS handle text;

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS details text;

-- ============================================================
-- PROJECTS TABLE
-- ============================================================
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS assignees text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS assignee_names text[];
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS task_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tasks_completed integer NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;

-- ============================================================
-- UNIQUE INDEXES / CONSTRAINTS
-- ============================================================
-- space_members: unique index on (space_id, email) for upsert in importMembers
CREATE UNIQUE INDEX IF NOT EXISTS idx_space_members_space_email
  ON public.space_members (space_id, email)
  WHERE email IS NOT NULL;

-- ============================================================
-- UPDATE TRIGGERS
-- ============================================================
-- Fix handle_space_signup to match canonical version
CREATE OR REPLACE FUNCTION public.handle_space_signup()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_space_id     uuid;
  v_role         public.member_role;
  v_display_name text;
BEGIN
  v_space_id     := (NEW.raw_user_meta_data->>'space_id')::uuid;
  v_role         := COALESCE(
                      NULLIF((NEW.raw_user_meta_data->>'role'), '')::public.member_role,
                      'member'
                    );
  v_display_name := COALESCE(
                      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
                      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
                      NEW.email
                    );

  IF v_space_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.space_members (space_id, user_id, role, status, display_name, email, approved)
  VALUES (v_space_id, NEW.id, v_role, 'unverified', v_display_name, NEW.email, true)
  ON CONFLICT (space_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
