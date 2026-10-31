-- Match Center admin broadcasts. Readers are anyone signed in; only admins write.
create table if not exists public.game_centre_admin_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  comments boolean not null default true,
  shareable boolean not null default false,
  reacts boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_game_centre_admin_posts_published
  on public.game_centre_admin_posts (published_at);

alter table public.game_centre_admin_posts enable row level security;

drop policy if exists "Anyone signed in can read admin broadcasts" on public.game_centre_admin_posts;
create policy "Anyone signed in can read admin broadcasts"
  on public.game_centre_admin_posts
  for select
  using (auth.uid() is not null);
