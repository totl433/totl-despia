-- Game Centre redesign, Release C: public comments on Game Centre match cards,
-- with reporting (same flow as Mini League chat), blocking and removal.

-- 1. Comments: one thread per public card, readable by everyone signed in.
create table if not exists public.game_centre_comments (
  id uuid primary key default gen_random_uuid(),
  card_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  reply_to_comment_id uuid references public.game_centre_comments(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Set by an admin to take a comment down; it then disappears for everyone.
  removed_at timestamptz,
  removed_reason text,
  -- Public match cards only (ids look like mc:gw7:goal:...). Private cards never get a thread.
  constraint game_centre_comments_card_id_check check (card_id ~ '^mc:gw[0-9]+:'),
  constraint game_centre_comments_content_check check (char_length(btrim(content)) between 1 and 500)
);

create index if not exists idx_game_centre_comments_card_created
  on public.game_centre_comments (card_id, created_at);
create index if not exists idx_game_centre_comments_user
  on public.game_centre_comments (user_id);

-- 2. Blocks: a person never sees comments from someone they've blocked.
create table if not exists public.user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  constraint user_blocks_not_self check (blocker_user_id <> blocked_user_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can see who they block" on public.user_blocks;
create policy "Users can see who they block"
  on public.user_blocks
  for select
  using (auth.uid() = blocker_user_id);

drop policy if exists "Users can block" on public.user_blocks;
create policy "Users can block"
  on public.user_blocks
  for insert
  with check (auth.uid() = blocker_user_id);

drop policy if exists "Users can unblock" on public.user_blocks;
create policy "Users can unblock"
  on public.user_blocks
  for delete
  using (auth.uid() = blocker_user_id);

alter table public.game_centre_comments enable row level security;

drop policy if exists "Signed-in users read live comments from people they haven't blocked" on public.game_centre_comments;
create policy "Signed-in users read live comments from people they haven't blocked"
  on public.game_centre_comments
  for select
  using (
    auth.uid() is not null
    and removed_at is null
    and not exists (
      select 1
      from public.user_blocks b
      where b.blocker_user_id = auth.uid()
        and b.blocked_user_id = game_centre_comments.user_id
    )
  );

drop policy if exists "Users post their own comments" on public.game_centre_comments;
create policy "Users post their own comments"
  on public.game_centre_comments
  for insert
  with check (auth.uid() = user_id and removed_at is null);

drop policy if exists "Users delete their own comments" on public.game_centre_comments;
create policy "Users delete their own comments"
  on public.game_centre_comments
  for delete
  using (auth.uid() = user_id);

-- No update policy: only admins (service role) set removed_at.

-- 3. Reports: same shape and flow as league_message_reports (the BFF stores the report
-- and emails it to the team), for a comment instead of a league message.
create table if not exists public.game_centre_comment_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reporter_email text,
  comment_id uuid not null references public.game_centre_comments(id) on delete cascade,
  card_id text not null,
  reason text not null,
  reported_comment_content text not null,
  reported_comment_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  constraint game_centre_comment_reports_status_check check (status in ('submitted', 'removed', 'dismissed'))
);

create index if not exists idx_game_centre_comment_reports_created_at
  on public.game_centre_comment_reports (created_at desc);
create index if not exists idx_game_centre_comment_reports_comment
  on public.game_centre_comment_reports (comment_id);

alter table public.game_centre_comment_reports enable row level security;

drop policy if exists "Users can report comments" on public.game_centre_comment_reports;
create policy "Users can report comments"
  on public.game_centre_comment_reports
  for insert
  with check (auth.uid() = reporter_user_id);

drop policy if exists "Users can view their own comment reports" on public.game_centre_comment_reports;
create policy "Users can view their own comment reports"
  on public.game_centre_comment_reports
  for select
  using (auth.uid() = reporter_user_id);

-- Realtime so threads update live, on the card and on the comments screen
alter table public.game_centre_comments replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.game_centre_comments;
exception
  when duplicate_object then null;
end $$;
