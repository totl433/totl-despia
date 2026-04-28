create table if not exists public.branded_leaderboard_broadcast_reactions (
  id uuid primary key default gen_random_uuid(),
  leaderboard_id uuid not null references public.branded_leaderboards(id) on delete cascade,
  message_id uuid not null references public.branded_leaderboard_broadcast_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);

create index if not exists idx_bl_broadcast_reactions_leaderboard_message
  on public.branded_leaderboard_broadcast_reactions(leaderboard_id, message_id);
create index if not exists idx_bl_broadcast_reactions_user
  on public.branded_leaderboard_broadcast_reactions(user_id);

alter table public.branded_leaderboard_broadcast_reactions enable row level security;

drop policy if exists "Users can read branded broadcast reactions" on public.branded_leaderboard_broadcast_reactions;
create policy "Users can read branded broadcast reactions"
  on public.branded_leaderboard_broadcast_reactions
  for select
  using (
    exists (
      select 1
      from public.branded_leaderboard_memberships m
      where m.leaderboard_id = branded_leaderboard_broadcast_reactions.leaderboard_id
        and m.user_id = auth.uid()
        and m.left_at is null
    )
    or exists (
      select 1
      from public.branded_leaderboard_hosts h
      where h.leaderboard_id = branded_leaderboard_broadcast_reactions.leaderboard_id
        and h.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.is_admin = true
    )
  );

drop policy if exists "Users can insert own branded broadcast reactions" on public.branded_leaderboard_broadcast_reactions;
create policy "Users can insert own branded broadcast reactions"
  on public.branded_leaderboard_broadcast_reactions
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.branded_leaderboard_broadcast_messages m
      where m.id = branded_leaderboard_broadcast_reactions.message_id
        and m.leaderboard_id = branded_leaderboard_broadcast_reactions.leaderboard_id
    )
    and (
      exists (
        select 1
        from public.branded_leaderboard_memberships m
        where m.leaderboard_id = branded_leaderboard_broadcast_reactions.leaderboard_id
          and m.user_id = auth.uid()
          and m.left_at is null
      )
      or exists (
        select 1
        from public.branded_leaderboard_hosts h
        where h.leaderboard_id = branded_leaderboard_broadcast_reactions.leaderboard_id
          and h.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.is_admin = true
      )
    )
  );

drop policy if exists "Users can delete own branded broadcast reactions" on public.branded_leaderboard_broadcast_reactions;
create policy "Users can delete own branded broadcast reactions"
  on public.branded_leaderboard_broadcast_reactions
  for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.is_admin = true
    )
  );
