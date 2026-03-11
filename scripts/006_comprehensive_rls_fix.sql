-- =====================================================
-- COMPREHENSIVE RLS FIX
-- Fixes infinite recursion + enum cast issues
-- =====================================================

-- Helper: returns the space_ids the user belongs to (security definer avoids recursion)
create or replace function public.get_user_space_ids(uid uuid)
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select space_id from public.space_members where user_id = uid
$$;

-- Helper: checks if user has one of the given roles in a space
-- NOTE: role column is a member_role enum, so we cast to text for comparison
create or replace function public.user_has_role_in_space(uid uuid, sid uuid, allowed_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where user_id = uid
      and space_id = sid
      and role::text = any(allowed_roles)
  )
$$;

-- Grant execute permissions
grant execute on function public.get_user_space_ids(uuid) to authenticated, service_role;
grant execute on function public.user_has_role_in_space(uuid, uuid, text[]) to authenticated, service_role;

-- =====================================================
-- SPACES
-- =====================================================
drop policy if exists "spaces_select_members"     on public.spaces;
drop policy if exists "spaces_insert_authenticated" on public.spaces;
drop policy if exists "spaces_update_admins"       on public.spaces;
drop policy if exists "spaces_delete_admins"       on public.spaces;

create policy "spaces_select_members" on public.spaces
  for select using (id in (select public.get_user_space_ids(auth.uid())));

create policy "spaces_insert_authenticated" on public.spaces
  for insert with check (auth.uid() is not null);

create policy "spaces_update_admins" on public.spaces
  for update using (public.user_has_role_in_space(auth.uid(), id, array['admin']));

create policy "spaces_delete_admins" on public.spaces
  for delete using (public.user_has_role_in_space(auth.uid(), id, array['admin']));

-- =====================================================
-- SPACE MEMBERS
-- =====================================================
drop policy if exists "space_members_select_own"         on public.space_members;
drop policy if exists "space_members_select_same_space"  on public.space_members;
drop policy if exists "space_members_select_own_space"   on public.space_members;
drop policy if exists "space_members_insert_authenticated" on public.space_members;
drop policy if exists "space_members_update_admins"      on public.space_members;
drop policy if exists "space_members_delete_admins"      on public.space_members;

create policy "space_members_select_own" on public.space_members
  for select using (user_id = auth.uid());

create policy "space_members_select_same_space" on public.space_members
  for select using (space_id in (select public.get_user_space_ids(auth.uid())));

-- Any authenticated user can insert a row where user_id = themselves
create policy "space_members_insert_authenticated" on public.space_members
  for insert with check (auth.uid() is not null and user_id = auth.uid());

-- Users can update their own profile; admins can update anyone in their space
create policy "space_members_update_admins" on public.space_members
  for update using (
    user_id = auth.uid()
    or public.user_has_role_in_space(auth.uid(), space_id, array['admin'])
  );

create policy "space_members_delete_admins" on public.space_members
  for delete using (
    public.user_has_role_in_space(auth.uid(), space_id, array['admin'])
  );

-- =====================================================
-- TASKS
-- =====================================================
drop policy if exists "tasks_select_members" on public.tasks;
drop policy if exists "tasks_insert_members" on public.tasks;
drop policy if exists "tasks_update_members" on public.tasks;
drop policy if exists "tasks_delete_members" on public.tasks;

create policy "tasks_select_members" on public.tasks
  for select using (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "tasks_insert_members" on public.tasks
  for insert with check (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "tasks_update_members" on public.tasks
  for update using (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "tasks_delete_members" on public.tasks
  for delete using (space_id in (select public.get_user_space_ids(auth.uid())));

-- =====================================================
-- PROJECTS
-- =====================================================
drop policy if exists "projects_select_members" on public.projects;
drop policy if exists "projects_insert_members" on public.projects;
drop policy if exists "projects_update_members" on public.projects;
drop policy if exists "projects_delete_members" on public.projects;

create policy "projects_select_members" on public.projects
  for select using (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "projects_insert_members" on public.projects
  for insert with check (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "projects_update_members" on public.projects
  for update using (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "projects_delete_members" on public.projects
  for delete using (space_id in (select public.get_user_space_ids(auth.uid())));

-- =====================================================
-- KNOWLEDGE BASE
-- =====================================================
drop policy if exists "kb_select_members" on public.knowledge_base;
drop policy if exists "kb_insert_members" on public.knowledge_base;
drop policy if exists "kb_update_members" on public.knowledge_base;
drop policy if exists "kb_delete_board"   on public.knowledge_base;

create policy "kb_select_members" on public.knowledge_base
  for select using (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "kb_insert_members" on public.knowledge_base
  for insert with check (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "kb_update_members" on public.knowledge_base
  for update using (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "kb_delete_board" on public.knowledge_base
  for delete using (public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board']));

-- =====================================================
-- SECRETS
-- =====================================================
drop policy if exists "secrets_select_admins" on public.secrets;
drop policy if exists "secrets_modify_admins" on public.secrets;

create policy "secrets_select_admins" on public.secrets
  for select using (
    public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board', 'treasurer'])
  );

create policy "secrets_modify_admins" on public.secrets
  for all using (public.user_has_role_in_space(auth.uid(), space_id, array['admin']));

-- =====================================================
-- AREA LEADS
-- =====================================================
drop policy if exists "area_leads_select_members" on public.area_leads;
drop policy if exists "area_leads_modify_board"   on public.area_leads;

create policy "area_leads_select_members" on public.area_leads
  for select using (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "area_leads_modify_board" on public.area_leads
  for all using (public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board']));

-- =====================================================
-- CONTACTS
-- =====================================================
drop policy if exists "contacts_select_members" on public.contacts;
drop policy if exists "contacts_modify_members" on public.contacts;

create policy "contacts_select_members" on public.contacts
  for select using (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "contacts_modify_members" on public.contacts
  for all using (space_id in (select public.get_user_space_ids(auth.uid())));

-- =====================================================
-- PAYMENTS
-- =====================================================
drop policy if exists "payments_select_treasurer" on public.payments;
drop policy if exists "payments_modify_treasurer" on public.payments;

create policy "payments_select_treasurer" on public.payments
  for select using (
    public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board', 'treasurer'])
  );

create policy "payments_modify_treasurer" on public.payments
  for all using (
    public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'treasurer'])
  );

-- =====================================================
-- COMMS CHANNELS
-- =====================================================
drop policy if exists "channels_select_members" on public.comms_channels;
drop policy if exists "channels_insert_board"   on public.comms_channels;
drop policy if exists "channels_update_board"   on public.comms_channels;
drop policy if exists "channels_delete_board"   on public.comms_channels;

create policy "channels_select_members" on public.comms_channels
  for select using (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "channels_insert_board" on public.comms_channels
  for insert with check (public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board']));

create policy "channels_update_board" on public.comms_channels
  for update using (public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board']));

create policy "channels_delete_board" on public.comms_channels
  for delete using (public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board']));

-- =====================================================
-- COMMS MESSAGES
-- =====================================================
drop policy if exists "messages_select_members" on public.comms_messages;
drop policy if exists "messages_insert_members" on public.comms_messages;

create policy "messages_select_members" on public.comms_messages
  for select using (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "messages_insert_members" on public.comms_messages
  for insert with check (
    space_id in (select public.get_user_space_ids(auth.uid()))
    and user_id = auth.uid()
  );

-- =====================================================
-- INTEGRATIONS
-- =====================================================
drop policy if exists "integrations_select_admins" on public.integrations;
drop policy if exists "integrations_modify_admins" on public.integrations;

create policy "integrations_select_admins" on public.integrations
  for select using (public.user_has_role_in_space(auth.uid(), space_id, array['admin']));

create policy "integrations_modify_admins" on public.integrations
  for all using (public.user_has_role_in_space(auth.uid(), space_id, array['admin']));

-- =====================================================
-- ACTIVITY LOG
-- =====================================================
drop policy if exists "activity_select_members" on public.activity_log;
drop policy if exists "activity_insert_members" on public.activity_log;

create policy "activity_select_members" on public.activity_log
  for select using (space_id in (select public.get_user_space_ids(auth.uid())));

create policy "activity_insert_members" on public.activity_log
  for insert with check (space_id in (select public.get_user_space_ids(auth.uid())));


-- =====================================================
-- SPACES
-- =====================================================
drop policy if exists "spaces_select_members" on public.spaces;
drop policy if exists "spaces_insert_authenticated" on public.spaces;
drop policy if exists "spaces_update_admins" on public.spaces;

create policy "spaces_select_members" on public.spaces for select using (
  id in (select public.get_user_space_ids(auth.uid()))
);

create policy "spaces_insert_authenticated" on public.spaces for insert 
  with check (auth.uid() is not null);

create policy "spaces_update_admins" on public.spaces for update using (
  public.user_has_role_in_space(auth.uid(), id, array['admin'])
);

-- =====================================================
-- SPACE MEMBERS
-- =====================================================
drop policy if exists "space_members_select_own" on public.space_members;
drop policy if exists "space_members_select_same_space" on public.space_members;
drop policy if exists "space_members_select_own_space" on public.space_members;
drop policy if exists "space_members_insert_authenticated" on public.space_members;
drop policy if exists "space_members_update_admins" on public.space_members;
drop policy if exists "space_members_delete_admins" on public.space_members;

-- SELECT: Users can see their own record
create policy "space_members_select_own" on public.space_members for select using (
  user_id = auth.uid()
);

-- SELECT: Users can see all members in spaces they belong to
create policy "space_members_select_same_space" on public.space_members for select using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

-- INSERT: Authenticated users can add themselves to a space
create policy "space_members_insert_authenticated" on public.space_members for insert 
  with check (auth.uid() is not null and user_id = auth.uid());

-- UPDATE: Admins can update any member, users can update themselves
create policy "space_members_update_admins" on public.space_members for update using (
  user_id = auth.uid() 
  or public.user_has_role_in_space(auth.uid(), space_id, array['admin'])
);

-- DELETE: Only admins can remove members
create policy "space_members_delete_admins" on public.space_members for delete using (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin'])
);

-- =====================================================
-- TASKS
-- =====================================================
drop policy if exists "tasks_select_members" on public.tasks;
drop policy if exists "tasks_insert_members" on public.tasks;
drop policy if exists "tasks_update_members" on public.tasks;
drop policy if exists "tasks_delete_members" on public.tasks;

create policy "tasks_select_members" on public.tasks for select using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "tasks_insert_members" on public.tasks for insert with check (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "tasks_update_members" on public.tasks for update using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "tasks_delete_members" on public.tasks for delete using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

-- =====================================================
-- PROJECTS
-- =====================================================
drop policy if exists "projects_select_members" on public.projects;
drop policy if exists "projects_insert_members" on public.projects;
drop policy if exists "projects_update_members" on public.projects;
drop policy if exists "projects_delete_members" on public.projects;

create policy "projects_select_members" on public.projects for select using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "projects_insert_members" on public.projects for insert with check (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "projects_update_members" on public.projects for update using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "projects_delete_members" on public.projects for delete using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

-- =====================================================
-- KNOWLEDGE BASE
-- =====================================================
drop policy if exists "kb_select_members" on public.knowledge_base;
drop policy if exists "kb_insert_members" on public.knowledge_base;
drop policy if exists "kb_update_members" on public.knowledge_base;
drop policy if exists "kb_delete_board" on public.knowledge_base;

create policy "kb_select_members" on public.knowledge_base for select using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "kb_insert_members" on public.knowledge_base for insert with check (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "kb_update_members" on public.knowledge_base for update using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "kb_delete_board" on public.knowledge_base for delete using (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board'])
);

-- =====================================================
-- SECRETS
-- =====================================================
drop policy if exists "secrets_select_admins" on public.secrets;
drop policy if exists "secrets_modify_admins" on public.secrets;

create policy "secrets_select_admins" on public.secrets for select using (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board', 'treasurer'])
);

create policy "secrets_modify_admins" on public.secrets for all using (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin'])
);

-- =====================================================
-- AREA LEADS
-- =====================================================
drop policy if exists "area_leads_select_members" on public.area_leads;
drop policy if exists "area_leads_modify_board" on public.area_leads;

create policy "area_leads_select_members" on public.area_leads for select using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "area_leads_modify_board" on public.area_leads for all using (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board'])
);

-- =====================================================
-- CONTACTS
-- =====================================================
drop policy if exists "contacts_select_members" on public.contacts;
drop policy if exists "contacts_modify_members" on public.contacts;

create policy "contacts_select_members" on public.contacts for select using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "contacts_modify_members" on public.contacts for all using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

-- =====================================================
-- PAYMENTS
-- =====================================================
drop policy if exists "payments_select_treasurer" on public.payments;
drop policy if exists "payments_modify_treasurer" on public.payments;

create policy "payments_select_treasurer" on public.payments for select using (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board', 'treasurer'])
);

create policy "payments_modify_treasurer" on public.payments for all using (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'treasurer'])
);

-- =====================================================
-- COMMS CHANNELS
-- =====================================================
drop policy if exists "channels_select_members" on public.comms_channels;
drop policy if exists "channels_insert_board" on public.comms_channels;
drop policy if exists "channels_update_board" on public.comms_channels;
drop policy if exists "channels_delete_board" on public.comms_channels;

create policy "channels_select_members" on public.comms_channels for select using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "channels_insert_board" on public.comms_channels for insert with check (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board'])
);

create policy "channels_update_board" on public.comms_channels for update using (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board'])
);

create policy "channels_delete_board" on public.comms_channels for delete using (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin', 'board'])
);

-- =====================================================
-- COMMS MESSAGES
-- =====================================================
drop policy if exists "messages_select_members" on public.comms_messages;
drop policy if exists "messages_insert_members" on public.comms_messages;

create policy "messages_select_members" on public.comms_messages for select using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "messages_insert_members" on public.comms_messages for insert with check (
  space_id in (select public.get_user_space_ids(auth.uid()))
  and user_id = auth.uid()
);

-- =====================================================
-- INTEGRATIONS
-- =====================================================
drop policy if exists "integrations_select_admins" on public.integrations;
drop policy if exists "integrations_modify_admins" on public.integrations;

create policy "integrations_select_admins" on public.integrations for select using (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin'])
);

create policy "integrations_modify_admins" on public.integrations for all using (
  public.user_has_role_in_space(auth.uid(), space_id, array['admin'])
);

-- =====================================================
-- ACTIVITY LOG
-- =====================================================
drop policy if exists "activity_select_members" on public.activity_log;
drop policy if exists "activity_insert_members" on public.activity_log;

create policy "activity_select_members" on public.activity_log for select using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

create policy "activity_insert_members" on public.activity_log for insert with check (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

-- =====================================================
-- GRANT EXECUTE on helper functions to authenticated users
-- =====================================================
grant execute on function public.get_user_space_ids(uuid) to authenticated;
grant execute on function public.user_has_role_in_space(uuid, uuid, text[]) to authenticated;
