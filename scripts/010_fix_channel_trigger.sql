-- Fix the create_default_channels trigger to not use description column
-- The comms_channels table does NOT have a description column

create or replace function public.create_default_channels()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert default channels without description (column doesn't exist)
  insert into public.comms_channels (space_id, name, channel_type) values
    (new.id, 'general', 'general'),
    (new.id, 'announcements', 'general'),
    (new.id, 'random', 'general'),
    (new.id, 'facilities', 'ops')
  on conflict do nothing;
  return new;
end;
$$;

-- Recreate the trigger
drop trigger if exists on_space_created on public.spaces;
create trigger on_space_created
  after insert on public.spaces
  for each row
  execute function public.create_default_channels();
