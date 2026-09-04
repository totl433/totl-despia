-- Retro Totl Daily — historic Premier League results
-- Source: football-data.co.uk (E0 CSVs). No scorers/minutes in this feed.

create table if not exists public.retro_daily_fixtures (
  id text primary key,
  season_label text not null,          -- e.g. '96/97'
  season_key text not null,            -- e.g. '9697' (football-data path)
  match_date date not null,
  home_code text not null,
  away_code text not null,
  home_name text not null,
  away_name text not null,
  home_score smallint not null check (home_score >= 0),
  away_score smallint not null check (away_score >= 0),
  result text not null check (result in ('H', 'D', 'A')),
  ht_home smallint,
  ht_away smallint,
  source text not null default 'football-data.co.uk',
  created_at timestamptz not null default now()
);

create index if not exists retro_daily_fixtures_season_key_idx
  on public.retro_daily_fixtures (season_key);

create index if not exists retro_daily_fixtures_match_date_idx
  on public.retro_daily_fixtures (match_date);

create index if not exists retro_daily_fixtures_home_code_idx
  on public.retro_daily_fixtures (home_code);

create index if not exists retro_daily_fixtures_away_code_idx
  on public.retro_daily_fixtures (away_code);

comment on table public.retro_daily_fixtures is
  'Historic PL full-time results for Retro Totl Daily puzzle generation.';
