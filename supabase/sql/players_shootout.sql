-- The Players: Shootout (head-to-head challenges).
--
-- One row per challenge. The BFF is the only writer and the only reader: the
-- `state` column holds the cards with their right answers, so players must never
-- read it directly. RLS is on with no policies, which blocks the anon and
-- authenticated roles; the BFF uses the service role.
--
-- Columns other than `state` are copies the BFF keeps in step so it can list a
-- player's challenges and find stale turns without opening every row.
--
-- Safe to run more than once. Nothing else in the database changes.

create table if not exists public.players_shootout_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid not null references auth.users(id) on delete cascade,
  -- pending (invite not answered), active, finished, declined, expired, cancelled
  status text not null default 'pending'
    check (status in ('pending', 'active', 'finished', 'declined', 'expired', 'cancelled')),
  -- Whose move it is: the opponent while pending (to accept), then whoever must play next.
  turn_user_id uuid references auth.users(id) on delete set null,
  -- When the current turn (or the invite) runs out: 24 hours after it started.
  turn_deadline timestamptz,
  winner_id uuid references auth.users(id) on delete set null,
  -- Rules, cards, answers and timings. See apps/bff/src/playersShootout.ts.
  state jsonb not null default '{}'::jsonb,
  -- Bumped on every write so two requests can't both advance the same turn.
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);

create index if not exists players_shootout_challenger_idx
  on public.players_shootout_challenges (challenger_id, updated_at desc);

create index if not exists players_shootout_opponent_idx
  on public.players_shootout_challenges (opponent_id, updated_at desc);

create index if not exists players_shootout_open_deadline_idx
  on public.players_shootout_challenges (turn_deadline)
  where status in ('pending', 'active');

alter table public.players_shootout_challenges enable row level security;

-- No policies on purpose: only the service role (the BFF) can read or write.
revoke all on public.players_shootout_challenges from anon, authenticated;

comment on table public.players_shootout_challenges is
  'The Players Shootout: head-to-head challenges. Written and read only by the BFF (service role); state holds the right answers, so there is no client access.';

-- Check it worked:
--   select status, count(*) from public.players_shootout_challenges group by status;
--
-- Undo (drops every challenge):
--   drop table if exists public.players_shootout_challenges;
