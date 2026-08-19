-- SAFE staging for 2026/27 GW1 — does NOT touch app_fixtures / current_gw / 2025/26 history.
-- Live App Store + playtotl keep reading app_fixtures as today.
-- Run in Supabase SQL editor when ready. Idempotent.

CREATE TABLE IF NOT EXISTS app_fixture_draft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_label TEXT NOT NULL,
  gw INTEGER NOT NULL,
  fixture_index INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_code TEXT,
  away_code TEXT,
  home_name TEXT,
  away_name TEXT,
  home_crest TEXT,
  away_crest TEXT,
  kickoff_time TIMESTAMPTZ,
  api_match_id INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_label, gw, fixture_index)
);

DELETE FROM app_fixture_draft WHERE season_label = '2026/27' AND gw = 1;

INSERT INTO app_fixture_draft (
  season_label, gw, fixture_index, home_team, away_team, home_code, away_code,
  home_name, away_name, home_crest, away_crest, kickoff_time, api_match_id, status
) VALUES
  ('2026/27', 1, 0, 'Arsenal', 'Coventry City', 'ARS', 'COV', 'Arsenal FC', 'Coventry City FC', 'https://crests.football-data.org/57.png', 'https://crests.football-data.org/1076.png', '2026-08-21T19:00:00Z'::timestamptz, 560542, 'SCHEDULED'),
  ('2026/27', 1, 1, 'Hull City', 'Man United', 'HUL', 'MUN', 'Hull City AFC', 'Manchester United FC', 'https://crests.football-data.org/322.png', 'https://crests.football-data.org/66.png', '2026-08-22T11:30:00Z'::timestamptz, 560543, 'SCHEDULED'),
  ('2026/27', 1, 2, 'Ipswich Town', 'Sunderland', 'IPS', 'SUN', 'Ipswich Town FC', 'Sunderland AFC', 'https://crests.football-data.org/349.png', 'https://crests.football-data.org/71.png', '2026-08-22T14:00:00Z'::timestamptz, 560544, 'SCHEDULED'),
  ('2026/27', 1, 3, 'Nottingham', 'Leeds United', 'NOT', 'LEE', 'Nottingham Forest FC', 'Leeds United FC', 'https://crests.football-data.org/351.png', 'https://crests.football-data.org/341.png', '2026-08-22T14:00:00Z'::timestamptz, 560545, 'SCHEDULED'),
  ('2026/27', 1, 4, 'Everton', 'Crystal Palace', 'EVE', 'CRY', 'Everton FC', 'Crystal Palace FC', 'https://crests.football-data.org/62.png', 'https://crests.football-data.org/354.png', '2026-08-22T14:00:00Z'::timestamptz, 560546, 'SCHEDULED'),
  ('2026/27', 1, 5, 'Brentford', 'Tottenham', 'BRE', 'TOT', 'Brentford FC', 'Tottenham Hotspur FC', 'https://crests.football-data.org/402.png', 'https://crests.football-data.org/73.png', '2026-08-22T16:30:00Z'::timestamptz, 560547, 'SCHEDULED'),
  ('2026/27', 1, 6, 'Man City', 'Bournemouth', 'MCI', 'BOU', 'Manchester City FC', 'AFC Bournemouth', 'https://crests.football-data.org/65.png', 'https://crests.football-data.org/bournemouth.png', '2026-08-23T13:00:00Z'::timestamptz, 560548, 'SCHEDULED'),
  ('2026/27', 1, 7, 'Brighton Hove', 'Aston Villa', 'BHA', 'AVL', 'Brighton & Hove Albion FC', 'Aston Villa FC', 'https://crests.football-data.org/397.png', 'https://crests.football-data.org/58.png', '2026-08-23T13:00:00Z'::timestamptz, 560549, 'SCHEDULED'),
  ('2026/27', 1, 8, 'Newcastle', 'Liverpool', 'NEW', 'LIV', 'Newcastle United FC', 'Liverpool FC', 'https://crests.football-data.org/67.png', 'https://crests.football-data.org/64.png', '2026-08-23T15:30:00Z'::timestamptz, 560550, 'SCHEDULED'),
  ('2026/27', 1, 9, 'Fulham', 'Chelsea', 'FUL', 'CHE', 'Fulham FC', 'Chelsea FC', 'https://crests.football-data.org/63.png', 'https://crests.football-data.org/61.png', '2026-08-24T19:00:00Z'::timestamptz, 560551, 'SCHEDULED');

COMMENT ON TABLE app_fixture_draft IS 'Unpublished next-season fixtures. Live apps must not read this until multi-season publish path is ready.';
