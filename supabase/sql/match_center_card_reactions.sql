-- Global Match Center card reactions (all users, shared counts).
-- One reaction per user per card; undo or change by replacing.
create table if not exists public.match_center_card_reactions (
  id uuid primary key default gen_random_uuid(),
  card_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (card_id, user_id)
);

create index if not exists idx_mc_card_reactions_card
  on public.match_center_card_reactions (card_id);
create index if not exists idx_mc_card_reactions_user
  on public.match_center_card_reactions (user_id);

alter table public.match_center_card_reactions enable row level security;

drop policy if exists "Anyone signed in can read MC card reactions" on public.match_center_card_reactions;
create policy "Anyone signed in can read MC card reactions"
  on public.match_center_card_reactions
  for select
  using (auth.uid() is not null);

drop policy if exists "Users can insert own MC card reactions" on public.match_center_card_reactions;
create policy "Users can insert own MC card reactions"
  on public.match_center_card_reactions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own MC card reactions" on public.match_center_card_reactions;
create policy "Users can update own MC card reactions"
  on public.match_center_card_reactions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own MC card reactions" on public.match_center_card_reactions;
create policy "Users can delete own MC card reactions"
  on public.match_center_card_reactions
  for delete
  using (auth.uid() = user_id);

-- Realtime so counts update live across devices
alter table public.match_center_card_reactions replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.match_center_card_reactions;
exception
  when duplicate_object then null;
end $$;
