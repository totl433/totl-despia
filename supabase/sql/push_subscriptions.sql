-- Create table to store OneSignal player IDs per user
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  player_id text not null,
  platform text, -- e.g., 'ios' | 'android'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure one row per (user_id, player_id)
create unique index if not exists push_subscriptions_user_player_unique
  on public.push_subscriptions (user_id, player_id);

-- Optional helpful index
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- Trigger to keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_updated_at on public.push_subscriptions;
create trigger trg_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

-- RLS (optional if using service role in backend only)
alter table public.push_subscriptions enable row level security;

-- Allow users to manage their own subscriptions when using anon key on server with user token
do $$ begin
  create policy if not exists "Users can insert own subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  create policy if not exists "Users can update own subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  create policy if not exists "Users can read own subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  create policy if not exists "Users can delete own subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
exception when others then null; end $$;


