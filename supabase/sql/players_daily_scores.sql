-- One scored Players attempt per person per day.
-- The first finish is kept. Every signed-in player can read every score.
-- This is the overall daily-game leaderboard, separate from mini-leagues.

create table if not exists public.players_daily_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key text not null check (day_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  correct integer not null check (correct >= 0 and correct <= total),
  total integer not null check (total > 0 and total <= 20),
  created_at timestamptz not null default now(),
  primary key (user_id, day_key)
);

comment on table public.players_daily_scores is
  'One scored Players attempt per user per day. The first finish is kept. Every signed-in player can read every score. This is the overall daily-game leaderboard.';

alter table public.players_daily_scores enable row level security;

revoke all on public.players_daily_scores from anon;
revoke update, delete, truncate, references, trigger on public.players_daily_scores from authenticated;
grant select, insert on public.players_daily_scores to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'players_daily_scores'
      and policyname = 'Signed-in players can read every Players score'
  ) then
    create policy "Signed-in players can read every Players score"
      on public.players_daily_scores
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'players_daily_scores'
      and policyname = 'Players can save their own first score'
  ) then
    create policy "Players can save their own first score"
      on public.players_daily_scores
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end $$;
