-- Add approved column to space_members
-- Used to distinguish members who have been approved by an admin vs pending
alter table if exists public.space_members
  add column if not exists approved boolean default false;

-- Existing active members are considered approved
update public.space_members
  set approved = true
  where status = 'active';
