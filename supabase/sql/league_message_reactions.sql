-- Emoji reactions for league messages
create table if not exists public.league_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.league_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);

-- Indexes for performance
create index if not exists idx_message_reactions_message on public.league_message_reactions(message_id);
create index if not exists idx_message_reactions_user on public.league_message_reactions(user_id);

-- Enable RLS
alter table public.league_message_reactions enable row level security;

-- Policies: Users can view all reactions in leagues they're members of
drop policy if exists "Users can view reactions in their leagues" on public.league_message_reactions;
create policy "Users can view reactions in their leagues"
  on public.league_message_reactions
  for select
  using (
    exists (
      select 1 from public.league_messages lm
      join public.league_members lmem on lm.league_id = lmem.league_id
      where lm.id = league_message_reactions.message_id
        and lmem.user_id = auth.uid()
    )
  );

-- Policies: Users can add/remove their own reactions
drop policy if exists "Users can manage their own reactions" on public.league_message_reactions;
create policy "Users can manage their own reactions"
  on public.league_message_reactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

