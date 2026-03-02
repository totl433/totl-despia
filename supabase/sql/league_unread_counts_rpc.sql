-- RPC: Unread chat counts per league for the current user
-- Returns a row per league: league_id, unread_count
-- Rules:
-- - Only leagues the user is a member of
-- - Unread = messages created_at > last_read_at (or never read => all)
-- - Exclude own messages
-- - Exclude Volley/system bot messages

create or replace function public.get_my_league_unread_counts()
returns table (league_id uuid, unread_count int)
language sql
security definer
set search_path = public
as $$
  with my_leagues as (
    select lm.league_id
    from public.league_members lm
    where lm.user_id = auth.uid()
  ),
  reads as (
    select r.league_id, r.last_read_at
    from public.league_message_reads r
    where r.user_id = auth.uid()
  )
  select
    l.league_id,
    coalesce(count(m.id), 0)::int as unread_count
  from my_leagues l
  left join reads r
    on r.league_id = l.league_id
  left join public.league_messages m
    on m.league_id = l.league_id
   and (r.last_read_at is null or m.created_at > r.last_read_at)
   and m.user_id <> auth.uid()
   and m.user_id <> '00000000-0000-0000-0000-000000000001'::uuid
  group by l.league_id
  order by l.league_id;
$$;

-- Permissions: callable by authenticated users
revoke all on function public.get_my_league_unread_counts() from public;
grant execute on function public.get_my_league_unread_counts() to authenticated;

-- Performance indexes (idempotent)
create index if not exists idx_league_message_reads_user_league
  on public.league_message_reads(user_id, league_id);

create index if not exists idx_league_messages_league_created
  on public.league_messages(league_id, created_at);

