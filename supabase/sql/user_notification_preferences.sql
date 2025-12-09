-- User notification preferences (global settings)
create table if not exists public.user_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function public.touch_updated_at_unp()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_updated_at_unp on public.user_notification_preferences;
create trigger trg_touch_updated_at_unp
before update on public.user_notification_preferences
for each row execute function public.touch_updated_at_unp();

alter table public.user_notification_preferences enable row level security;

-- Users can manage their own preferences
do $$ 
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'user_notification_preferences'
    and policyname = 'Users can manage their own preferences'
  ) then
    create policy "Users can manage their own preferences" on public.user_notification_preferences
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

