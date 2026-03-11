-- Fix infinite recursion in space_members RLS policy
-- The original policy referenced space_members while evaluating a policy on space_members

-- Drop the problematic policy
drop policy if exists "space_members_select_own_space" on public.space_members;

-- Create a simpler policy that avoids self-reference
-- Users can see their own record, plus all members in any space they belong to
-- We use a subquery on a different approach to avoid recursion

create policy "space_members_select_own" on public.space_members for select using (
  -- User can always see their own membership record
  user_id = auth.uid()
);

-- Create a separate policy for viewing other members in the same space
-- This uses a function to break the recursion cycle
create or replace function public.get_user_space_ids(uid uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select space_id from public.space_members where user_id = uid
$$;

create policy "space_members_select_same_space" on public.space_members for select using (
  space_id in (select public.get_user_space_ids(auth.uid()))
);

-- Also fix the insert policy to allow users to insert themselves into a space
-- when joining via invite code (they won't have a record yet)
drop policy if exists "space_members_insert_authenticated" on public.space_members;

create policy "space_members_insert_authenticated" on public.space_members for insert 
  with check (
    auth.uid() is not null 
    and user_id = auth.uid()
  );
