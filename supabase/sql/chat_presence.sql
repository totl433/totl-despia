-- Track active chat viewers to suppress notifications
create table if not exists public.chat_presence (
  league_id uuid not null,
  user_id uuid not null,
  last_seen timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists chat_presence_league_last_seen_idx 
  on public.chat_presence(league_id, last_seen);

-- Auto-cleanup old presence records (older than 1 minute)
create or replace function public.cleanup_old_chat_presence()
returns void language plpgsql as $$
begin
  delete from public.chat_presence
  where last_seen < now() - interval '1 minute';
end;
$$;

alter table public.chat_presence enable row level security;

-- Users can manage their own presence
do $$ begin
  create policy if not exists "Users can upsert their own presence" 
  on public.chat_presence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when others then null; end $$;

