-- Store Expo push tokens per user/device
create table if not exists public.expo_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  expo_push_token text not null,
  platform text, -- 'ios' | 'android'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure one row per (user_id, expo_push_token)
create unique index if not exists expo_push_tokens_user_token_unique
  on public.expo_push_tokens (user_id, expo_push_token);

create index if not exists expo_push_tokens_user_id_idx
  on public.expo_push_tokens (user_id);

-- Reuse touch_updated_at() if present, otherwise create it
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_updated_at_expo_push_tokens on public.expo_push_tokens;
create trigger trg_touch_updated_at_expo_push_tokens
before update on public.expo_push_tokens
for each row execute function public.touch_updated_at();

-- RLS
alter table public.expo_push_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'expo_push_tokens'
      and policyname = 'Users can insert own expo push tokens'
  ) then
    create policy "Users can insert own expo push tokens"
      on public.expo_push_tokens for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'expo_push_tokens'
      and policyname = 'Users can update own expo push tokens'
  ) then
    create policy "Users can update own expo push tokens"
      on public.expo_push_tokens for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'expo_push_tokens'
      and policyname = 'Users can read own expo push tokens'
  ) then
    create policy "Users can read own expo push tokens"
      on public.expo_push_tokens for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'expo_push_tokens'
      and policyname = 'Users can delete own expo push tokens'
  ) then
    create policy "Users can delete own expo push tokens"
      on public.expo_push_tokens for delete
      using (auth.uid() = user_id);
  end if;
end $$;

