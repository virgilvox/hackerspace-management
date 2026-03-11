-- Drop and recreate tables that need schema fixes
-- This script fixes the schema to match the application code

-- Fix spaces table: rename public_directory to public_member_directory
alter table if exists public.spaces
  rename column public_directory to public_member_directory;

-- Fix space_members table: use text fields instead of enums, add email/payment columns
alter table if exists public.space_members
  add column if not exists email text,
  add column if not exists payment_status text,
  add column if not exists payment_note text,
  add column if not exists last_paid_at timestamp with time zone;

-- Make user_id nullable for imported members who haven't signed up yet
alter table if exists public.space_members
  alter column user_id drop not null;

-- Fix tasks table: add task_type text column for easier filtering
alter table if exists public.tasks
  add column if not exists task_type text default 'chore',
  add column if not exists progress integer default 0,
  add column if not exists recurrence text,
  add column if not exists area text,
  add column if not exists assigned_to text;

-- Fix projects table: add missing columns
alter table if exists public.projects
  add column if not exists progress integer default 0,
  add column if not exists task_count integer default 0,
  add column if not exists tags text[] default '{}',
  add column if not exists category text,
  add column if not exists assignees text,
  add column if not exists due_date date,
  add column if not exists description text;

-- Fix knowledge_base table
alter table if exists public.knowledge_base
  add column if not exists pinned boolean default false,
  add column if not exists area text,
  add column if not exists access_level text default 'all_members',
  add column if not exists description text,
  add column if not exists updated_by text;

-- Fix area_leads table
alter table if exists public.area_leads
  add column if not exists lead_handle text,
  add column if not exists status text default 'active';

-- Fix contacts table
alter table if exists public.contacts
  add column if not exists note text,
  add column if not exists group_label text;

-- Fix comms_channels: add member_count
alter table if exists public.comms_channels
  add column if not exists member_count integer default 0,
  add column if not exists unread_count integer default 0;

-- Seed default channels when space is created via trigger
create or replace function public.create_default_channels()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.comms_channels (space_id, name, channel_type, description) values
    (new.id, 'general', 'general', 'General discussion for all members'),
    (new.id, 'announcements', 'general', 'Official announcements from board and admin'),
    (new.id, 'random', 'general', 'Off-topic chatter'),
    (new.id, 'facilities', 'ops', 'Facilities and maintenance discussion')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_space_created on public.spaces;
create trigger on_space_created
  after insert on public.spaces
  for each row
  execute function public.create_default_channels();
