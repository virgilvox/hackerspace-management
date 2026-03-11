-- =====================================================
-- This script creates a function and trigger to handle
-- space creation/joining during signup using security definer
-- bypassing RLS since user hasn't confirmed email yet
-- =====================================================

-- Function to handle creating a space and member during signup
create or replace function public.handle_space_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_action text;
  v_space_name text;
  v_space_slug text;
  v_space_city text;
  v_invite_code text;
begin
  -- Get metadata from user signup
  v_action := coalesce(new.raw_user_meta_data ->> 'space_action', '');
  
  if v_action = 'create' then
    v_space_name := new.raw_user_meta_data ->> 'space_name';
    v_space_slug := new.raw_user_meta_data ->> 'space_slug';
    v_space_city := new.raw_user_meta_data ->> 'space_city';
    v_invite_code := new.raw_user_meta_data ->> 'invite_code';
    
    -- Create the space
    insert into public.spaces (name, slug, city, invite_code)
    values (v_space_name, v_space_slug, v_space_city, v_invite_code)
    returning id into v_space_id;
    
    -- Add user as admin
    insert into public.space_members (space_id, user_id, display_name, email, role, tier, status)
    values (
      v_space_id, 
      new.id, 
      coalesce(new.raw_user_meta_data ->> 'full_name', 'Admin'),
      new.email,
      'admin',
      'plus',
      'active'
    );
    
    -- Create default channels
    insert into public.comms_channels (space_id, name, channel_type) values
      (v_space_id, 'general', 'general'),
      (v_space_id, 'announcements', 'general'),
      (v_space_id, 'random', 'general');
      
  elsif v_action = 'join' then
    v_invite_code := new.raw_user_meta_data ->> 'join_invite_code';
    
    -- Find space by invite code
    select id into v_space_id from public.spaces where invite_code = v_invite_code;
    
    if v_space_id is not null then
      -- Add user as member (pending if require_approval is true)
      insert into public.space_members (space_id, user_id, display_name, email, role, tier, status)
      select 
        v_space_id,
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', 'Member'),
        new.email,
        'member',
        'basic',
        case when s.require_approval then 'pending' else 'active' end
      from public.spaces s where s.id = v_space_id;
    end if;
  end if;
  
  return new;
end;
$$;

-- Create trigger
drop trigger if exists on_auth_user_space_signup on auth.users;

create trigger on_auth_user_space_signup
  after insert on auth.users
  for each row
  execute function public.handle_space_signup();
