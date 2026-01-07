-- Add RLS policy to allow Volley to insert messages into league_messages
-- Volley is the system bot that sends automatic announcements

-- Allow Volley (user_id: 00000000-0000-0000-0000-000000000001) to insert messages
-- This is idempotent - will only create if it doesn't already exist
do $$ 
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'league_messages' 
    and policyname = 'Volley can insert messages'
  ) then
    create policy "Volley can insert messages" on public.league_messages
    for insert
    with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);
  end if;
end $$;

