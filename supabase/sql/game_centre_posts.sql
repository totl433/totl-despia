-- Game Centre posts: one row per public match event (line-ups, kickoff, goals, half-time,
-- second half, full-time). Written only by pollLiveScores (service role); read by the app.
-- The id is the card's permanent identity and the key reactions and comments use, so a
-- retry or a second poller run can only update a row, never add another.
-- Additive: no existing table changes. Design: "Game Centre posts — design" doc.
create table if not exists public.game_centre_posts (
  -- e.g. mc:gw7:goal:9:H1, mc:gw7:ht:9, mc:gw7:gw-open:7 (same prefix as reaction card ids)
  id text primary key,
  gw integer not null,
  api_match_id integer,
  fixture_index integer,
  kind text not null,
  status text not null default 'active',
  -- Event facts: scorer, scorer id, team id, side, minute, own goal, score after the event.
  details jsonb not null default '{}'::jsonb,
  occurred_minute integer,
  -- First time the poller saw the event. Set on insert, never updated: it orders the feed.
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision integer not null default 1,
  -- live_scores.updated_at behind this revision; older data never overwrites newer.
  source_updated_at timestamptz,
  constraint game_centre_posts_id_check check (id ~ '^mc:gw[0-9]+:'),
  constraint game_centre_posts_kind_check check (
    kind in ('opener', 'lineup', 'xi', 'kickoff', 'goal', 'half-time', 'second-half', 'full-time')
  ),
  constraint game_centre_posts_status_check check (status in ('active', 'ruled_out', 'void'))
);

create index if not exists idx_game_centre_posts_gw_published
  on public.game_centre_posts (gw, published_at);
create index if not exists idx_game_centre_posts_match
  on public.game_centre_posts (api_match_id);

alter table public.game_centre_posts enable row level security;

drop policy if exists "Signed-in users read Game Centre posts" on public.game_centre_posts;
create policy "Signed-in users read Game Centre posts"
  on public.game_centre_posts
  for select
  using (auth.uid() is not null);

-- No insert, update or delete policies: only the service role (the poller) writes.

-- Realtime so open feeds get new and corrected posts live.
alter table public.game_centre_posts replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.game_centre_posts;
exception
  when duplicate_object then null;
end $$;
