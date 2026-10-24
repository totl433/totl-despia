-- Game Centre redesign, Release B: Slack-style reactions on public Game Centre cards.
-- Any emoji, several per person per card; tap again to take yours back.
-- A new table so builds already in people's hands (which use match_center_card_reactions,
-- one reaction per person per card) keep working unchanged.
create table if not exists public.game_centre_reactions (
  id uuid primary key default gen_random_uuid(),
  card_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (card_id, user_id, emoji),
  -- Public match cards only (ids look like mc:gw7:goal:...), and one emoji per row.
  constraint game_centre_reactions_card_id_check check (card_id ~ '^mc:gw[0-9]+:'),
  constraint game_centre_reactions_emoji_check check (char_length(emoji) between 1 and 16)
);

create index if not exists idx_game_centre_reactions_card
  on public.game_centre_reactions (card_id);

alter table public.game_centre_reactions enable row level security;

drop policy if exists "Anyone signed in can read Game Centre reactions" on public.game_centre_reactions;
create policy "Anyone signed in can read Game Centre reactions"
  on public.game_centre_reactions
  for select
  using (auth.uid() is not null);

drop policy if exists "Users can add their own Game Centre reactions" on public.game_centre_reactions;
create policy "Users can add their own Game Centre reactions"
  on public.game_centre_reactions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own Game Centre reactions" on public.game_centre_reactions;
create policy "Users can remove their own Game Centre reactions"
  on public.game_centre_reactions
  for delete
  using (auth.uid() = user_id);

-- Carry existing reactions over so counts don't drop when people update the app.
insert into public.game_centre_reactions (card_id, user_id, emoji, created_at)
select card_id, user_id, emoji, created_at
from public.match_center_card_reactions
where card_id ~ '^mc:gw[0-9]+:'
on conflict (card_id, user_id, emoji) do nothing;

-- Realtime so counts update live across devices
alter table public.game_centre_reactions replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.game_centre_reactions;
exception
  when duplicate_object then null;
end $$;
