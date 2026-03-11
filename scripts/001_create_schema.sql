-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================
do $$ begin
  create type member_role as enum ('admin', 'board', 'treasurer', 'member', 'associate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_tier as enum ('plus', 'basic', 'associate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_status as enum ('active', 'pending', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('current', 'late', '3mo_late', 'unverified');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_type as enum ('chore', 'task');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('open', 'claimed', 'in_progress', 'overdue', 'due_today', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recurrence_type as enum ('daily', 'weekly', 'biweekly', 'monthly', 'none');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('backlog', 'in_progress', 'review', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type kb_visibility as enum ('all_members', 'board', 'admin_only');
exception when duplicate_object then null; end $$;

do $$ begin
  create type area_lead_status as enum ('active', 'vacant', 'handoff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contact_type as enum ('vendor', 'supplier', 'partner', 'landlord', 'city');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_platform as enum ('paypal', 'zeffy', 'venmo', 'cash');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_link_status as enum ('linked', 'unlinked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type channel_type as enum ('general', 'area', 'ops', 'project');
exception when duplicate_object then null; end $$;

-- =====================================================
-- SPACES (Multi-tenant containers)
-- =====================================================
create table if not exists public.spaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  city text,
  require_approval boolean default true,
  public_member_directory boolean default false,
  invite_code text unique not null,
  webhook_secret text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.spaces enable row level security;

-- =====================================================
-- SPACE MEMBERS (Users in spaces with roles)
-- =====================================================
create table if not exists public.space_members (
  id uuid primary key default uuid_generate_v4(),
  space_id uuid references public.spaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member',
  tier text default 'basic',
  display_name text not null,
  email text,
  handle text,
  phone text,
  status text default 'active',
  payment_status text,
  payment_note text,
  joined_at timestamp with time zone default now(),
  last_paid_at timestamp with time zone,
  has_card_access boolean default false,
  unique(space_id, user_id)
);

alter table public.space_members enable row level security;

-- Now add spaces RLS policies (after space_members exists)
create policy "spaces_select_members" on public.spaces for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = spaces.id
    and space_members.user_id = auth.uid()
  )
);

create policy "spaces_insert_authenticated" on public.spaces for insert 
  with check (auth.uid() is not null);

create policy "spaces_update_admins" on public.spaces for update using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = spaces.id
    and space_members.user_id = auth.uid()
    and space_members.role = 'admin'
  )
);

-- space_members RLS policies
create policy "space_members_select_own_space" on public.space_members for select using (
  user_id = auth.uid()
  or space_id in (
    select space_id from public.space_members where user_id = auth.uid()
  )
);

create policy "space_members_insert_authenticated" on public.space_members for insert 
  with check (auth.uid() = user_id);

create policy "space_members_update_admins" on public.space_members for update using (
  user_id = auth.uid()
  or exists (
    select 1 from public.space_members sm
    where sm.space_id = space_members.space_id
    and sm.user_id = auth.uid()
    and sm.role = 'admin'
  )
);

create policy "space_members_delete_admins" on public.space_members for delete using (
  exists (
    select 1 from public.space_members sm
    where sm.space_id = space_members.space_id
    and sm.user_id = auth.uid()
    and sm.role = 'admin'
  )
);

-- =====================================================
-- TASKS & CHORES
-- =====================================================
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  space_id uuid references public.spaces(id) on delete cascade not null,
  title text not null,
  description text,
  type task_type default 'task',
  status task_status default 'open',
  area text,
  recurrence recurrence_type default 'none',
  due_date timestamp with time zone,
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_to_name text,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_by_name text,
  requested_by uuid references auth.users(id) on delete set null,
  requested_by_name text,
  subtask_total integer default 0,
  subtask_completed integer default 0,
  last_done_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.tasks enable row level security;

create policy "tasks_select_members" on public.tasks for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = tasks.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "tasks_insert_members" on public.tasks for insert with check (
  exists (
    select 1 from public.space_members
    where space_members.space_id = tasks.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "tasks_update_members" on public.tasks for update using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = tasks.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "tasks_delete_members" on public.tasks for delete using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = tasks.space_id
    and space_members.user_id = auth.uid()
  )
);

-- =====================================================
-- PROJECTS
-- =====================================================
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  space_id uuid references public.spaces(id) on delete cascade not null,
  title text not null,
  description text,
  status project_status default 'backlog',
  area text,
  tags text[],
  assignee_names text[],
  task_count integer default 0,
  tasks_completed integer default 0,
  due_date timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.projects enable row level security;

create policy "projects_select_members" on public.projects for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = projects.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "projects_insert_members" on public.projects for insert with check (
  exists (
    select 1 from public.space_members
    where space_members.space_id = projects.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "projects_update_members" on public.projects for update using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = projects.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "projects_delete_members" on public.projects for delete using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = projects.space_id
    and space_members.user_id = auth.uid()
  )
);

-- =====================================================
-- KNOWLEDGE BASE
-- =====================================================
create table if not exists public.knowledge_base (
  id uuid primary key default uuid_generate_v4(),
  space_id uuid references public.spaces(id) on delete cascade not null,
  title text not null,
  content text,
  icon text,
  visibility kb_visibility default 'all_members',
  area text,
  tags text[],
  is_pinned boolean default false,
  updated_by_id uuid references auth.users(id) on delete set null,
  updated_by_name text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.knowledge_base enable row level security;

create policy "kb_select_members" on public.knowledge_base for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = knowledge_base.space_id
    and space_members.user_id = auth.uid()
    and (
      knowledge_base.visibility = 'all_members'
      or (knowledge_base.visibility = 'board' and space_members.role in ('admin', 'board', 'treasurer'))
      or (knowledge_base.visibility = 'admin_only' and space_members.role = 'admin')
    )
  )
);

create policy "kb_insert_members" on public.knowledge_base for insert with check (
  exists (
    select 1 from public.space_members
    where space_members.space_id = knowledge_base.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "kb_update_members" on public.knowledge_base for update using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = knowledge_base.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "kb_delete_board" on public.knowledge_base for delete using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = knowledge_base.space_id
    and space_members.user_id = auth.uid()
    and space_members.role in ('admin', 'board')
  )
);

-- =====================================================
-- SECRETS VAULT
-- =====================================================
create table if not exists public.secrets (
  id uuid primary key default uuid_generate_v4(),
  space_id uuid references public.spaces(id) on delete cascade not null,
  title text not null,
  icon text,
  description text,
  value text not null,
  area text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.secrets enable row level security;

create policy "secrets_select_admins" on public.secrets for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = secrets.space_id
    and space_members.user_id = auth.uid()
    and space_members.role in ('admin', 'board', 'treasurer')
  )
);

create policy "secrets_modify_admins" on public.secrets for all using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = secrets.space_id
    and space_members.user_id = auth.uid()
    and space_members.role = 'admin'
  )
);

-- =====================================================
-- AREA LEADS
-- =====================================================
create table if not exists public.area_leads (
  id uuid primary key default uuid_generate_v4(),
  space_id uuid references public.spaces(id) on delete cascade not null,
  area_name text not null,
  area_code text not null,
  lead_id uuid references auth.users(id) on delete set null,
  lead_handle text,
  status area_lead_status default 'active',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.area_leads enable row level security;

create policy "area_leads_select_members" on public.area_leads for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = area_leads.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "area_leads_modify_board" on public.area_leads for all using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = area_leads.space_id
    and space_members.user_id = auth.uid()
    and space_members.role in ('admin', 'board')
  )
);

-- =====================================================
-- CONTACTS
-- =====================================================
create table if not exists public.contacts (
  id uuid primary key default uuid_generate_v4(),
  space_id uuid references public.spaces(id) on delete cascade not null,
  name text not null,
  code text not null,
  contact_type contact_type not null,
  email text,
  phone text,
  details text,
  tags text[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.contacts enable row level security;

create policy "contacts_select_members" on public.contacts for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = contacts.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "contacts_modify_members" on public.contacts for all using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = contacts.space_id
    and space_members.user_id = auth.uid()
  )
);

-- =====================================================
-- PAYMENTS
-- =====================================================
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  space_id uuid references public.spaces(id) on delete cascade not null,
  platform payment_platform not null,
  amount numeric(10,2) not null,
  from_identifier text,
  from_note text,
  member_id uuid references public.space_members(id) on delete set null,
  member_name text,
  link_status payment_link_status default 'unlinked',
  transaction_date timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

alter table public.payments enable row level security;

create policy "payments_select_treasurer" on public.payments for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = payments.space_id
    and space_members.user_id = auth.uid()
    and space_members.role in ('admin', 'board', 'treasurer')
  )
);

create policy "payments_modify_treasurer" on public.payments for all using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = payments.space_id
    and space_members.user_id = auth.uid()
    and space_members.role in ('admin', 'treasurer')
  )
);

-- =====================================================
-- COMMS CHANNELS
-- =====================================================
create table if not exists public.comms_channels (
  id uuid primary key default uuid_generate_v4(),
  space_id uuid references public.spaces(id) on delete cascade not null,
  name text not null,
  icon text,
  channel_type channel_type default 'general',
  area_reference text,
  project_id uuid references public.projects(id) on delete cascade,
  member_count integer default 0,
  created_at timestamp with time zone default now()
);

alter table public.comms_channels enable row level security;

create policy "channels_select_members" on public.comms_channels for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = comms_channels.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "channels_insert_board" on public.comms_channels for insert with check (
  exists (
    select 1 from public.space_members
    where space_members.space_id = comms_channels.space_id
    and space_members.user_id = auth.uid()
    and space_members.role in ('admin', 'board')
  )
);

create policy "channels_update_board" on public.comms_channels for update using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = comms_channels.space_id
    and space_members.user_id = auth.uid()
    and space_members.role in ('admin', 'board')
  )
);

create policy "channels_delete_board" on public.comms_channels for delete using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = comms_channels.space_id
    and space_members.user_id = auth.uid()
    and space_members.role in ('admin', 'board')
  )
);

-- =====================================================
-- COMMS MESSAGES (stored for history; real-time via CLASP)
-- =====================================================
create table if not exists public.comms_messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid references public.comms_channels(id) on delete cascade not null,
  space_id uuid references public.spaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  handle text,
  content text not null,
  created_at timestamp with time zone default now()
);

alter table public.comms_messages enable row level security;

create policy "messages_select_members" on public.comms_messages for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = comms_messages.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "messages_insert_members" on public.comms_messages for insert with check (
  exists (
    select 1 from public.space_members
    where space_members.space_id = comms_messages.space_id
    and space_members.user_id = auth.uid()
  ) and user_id = auth.uid()
);

-- =====================================================
-- INTEGRATIONS
-- =====================================================
create table if not exists public.integrations (
  id uuid primary key default uuid_generate_v4(),
  space_id uuid references public.spaces(id) on delete cascade not null,
  name text not null,
  platform text not null unique,
  description text,
  is_connected boolean default false,
  config jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.integrations enable row level security;

create policy "integrations_select_admins" on public.integrations for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = integrations.space_id
    and space_members.user_id = auth.uid()
    and space_members.role = 'admin'
  )
);

create policy "integrations_modify_admins" on public.integrations for all using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = integrations.space_id
    and space_members.user_id = auth.uid()
    and space_members.role = 'admin'
  )
);

-- =====================================================
-- ACTIVITY LOG
-- =====================================================
create table if not exists public.activity_log (
  id uuid primary key default uuid_generate_v4(),
  space_id uuid references public.spaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  display_name text,
  action text not null,
  entity_type text,
  entity_id uuid,
  details text,
  created_at timestamp with time zone default now()
);

alter table public.activity_log enable row level security;

create policy "activity_select_members" on public.activity_log for select using (
  exists (
    select 1 from public.space_members
    where space_members.space_id = activity_log.space_id
    and space_members.user_id = auth.uid()
  )
);

create policy "activity_insert_members" on public.activity_log for insert with check (
  exists (
    select 1 from public.space_members
    where space_members.space_id = activity_log.space_id
    and space_members.user_id = auth.uid()
  )
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================
create index if not exists idx_space_members_space_id on public.space_members(space_id);
create index if not exists idx_space_members_user_id on public.space_members(user_id);
create index if not exists idx_tasks_space_id on public.tasks(space_id);
create index if not exists idx_projects_space_id on public.projects(space_id);
create index if not exists idx_kb_space_id on public.knowledge_base(space_id);
create index if not exists idx_messages_channel_id on public.comms_messages(channel_id);
create index if not exists idx_messages_space_id on public.comms_messages(space_id);
create index if not exists idx_payments_space_id on public.payments(space_id);
create index if not exists idx_activity_space_id on public.activity_log(space_id);
create index if not exists idx_contacts_space_id on public.contacts(space_id);
create index if not exists idx_area_leads_space_id on public.area_leads(space_id);
