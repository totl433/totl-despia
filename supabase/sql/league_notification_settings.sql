-- Per-league notification preferences (mute toggles)
create table if not exists public.league_notification_settings (
  user_id uuid not null,
  league_id uuid not null,
  muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, league_id)
);

create index if not exists league_notification_settings_league_idx on public.league_notification_settings(league_id);

-- Keep updated_at fresh
create or replace function public.touch_updated_at_lns()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_updated_at_lns on public.league_notification_settings;
create trigger trg_touch_updated_at_lns
before update on public.league_notification_settings
for each row execute function public.touch_updated_at_lns();

alter table public.league_notification_settings enable row level security;

-- Basic policies allowing users to manage their own settings
do $$ begin
  create policy if not exists "Users can upsert their own league settings" on public.league_notification_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when others then null; end $$;


