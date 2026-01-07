-- Add first_name and last_name to public.users (no backfill)
alter table public.users
  add column if not exists first_name text,
  add column if not exists last_name text;

