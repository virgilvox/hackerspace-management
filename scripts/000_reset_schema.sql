-- Clean up any existing policies and tables for fresh start
drop policy if exists "spaces_select_members" on public.spaces;
drop policy if exists "spaces_insert_authenticated" on public.spaces;
drop policy if exists "spaces_update_admins" on public.spaces;

drop policy if exists "space_members_select_own_space" on public.space_members;
drop policy if exists "space_members_insert_authenticated" on public.space_members;
drop policy if exists "space_members_update_admins" on public.space_members;
drop policy if exists "space_members_delete_admins" on public.space_members;

drop table if exists public.activity_log cascade;
drop table if exists public.comms_messages cascade;
drop table if exists public.comms_channels cascade;
drop table if exists public.integrations cascade;
drop table if exists public.payments cascade;
drop table if exists public.contacts cascade;
drop table if exists public.area_leads cascade;
drop table if exists public.secrets cascade;
drop table if exists public.knowledge_base cascade;
drop table if exists public.projects cascade;
drop table if exists public.tasks cascade;
drop table if exists public.space_members cascade;
drop table if exists public.spaces cascade;

drop type if exists channel_type cascade;
drop type if exists payment_link_status cascade;
drop type if exists payment_platform cascade;
drop type if exists contact_type cascade;
drop type if exists area_lead_status cascade;
drop type if exists kb_visibility cascade;
drop type if exists project_status cascade;
drop type if exists recurrence_type cascade;
drop type if exists task_status cascade;
drop type if exists task_type cascade;
drop type if exists member_status cascade;
drop type if exists member_tier cascade;
drop type if exists member_role cascade;
