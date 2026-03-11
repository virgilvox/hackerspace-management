-- Fix spaces INSERT policy to allow any authenticated user to create a space
-- This is needed for the signup flow when a user creates their first space

-- Drop existing insert policy if it exists
drop policy if exists "spaces_insert_authenticated" on public.spaces;

-- Create a simple policy allowing any authenticated user to insert
create policy "spaces_insert_authenticated" on public.spaces 
  for insert 
  with check (auth.uid() is not null);

-- Also fix space_members INSERT policy to allow users to add themselves
drop policy if exists "space_members_insert_authenticated" on public.space_members;

create policy "space_members_insert_authenticated" on public.space_members
  for insert
  with check (
    auth.uid() is not null 
    and user_id = auth.uid()
  );
