create table if not exists public.league_message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reporter_email text,
  league_id uuid not null references public.leagues(id) on delete cascade,
  message_id uuid not null references public.league_messages(id) on delete cascade,
  reason text not null,
  reported_message_content text not null,
  reported_message_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  constraint league_message_reports_status_check check (status in ('submitted'))
);

create index if not exists idx_league_message_reports_created_at
  on public.league_message_reports(created_at desc);

create index if not exists idx_league_message_reports_message
  on public.league_message_reports(message_id);

create index if not exists idx_league_message_reports_reporter
  on public.league_message_reports(reporter_user_id);

alter table public.league_message_reports enable row level security;

drop policy if exists "Users can insert reports for their leagues" on public.league_message_reports;
create policy "Users can insert reports for their leagues"
  on public.league_message_reports
  for insert
  with check (
    auth.uid() = reporter_user_id
    and exists (
      select 1
      from public.league_members lm
      where lm.league_id = league_message_reports.league_id
        and lm.user_id = auth.uid()
    )
  );

drop policy if exists "Users can view their own reports" on public.league_message_reports;
create policy "Users can view their own reports"
  on public.league_message_reports
  for select
  using (auth.uid() = reporter_user_id);
