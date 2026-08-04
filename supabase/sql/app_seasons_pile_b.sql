-- =============================================================================
-- Pile B: multi-season stack (does NOT alter legacy unfoldered app_* game data)
-- Old App Store / current web keep reading app_fixtures, app_picks, app_meta, etc.
-- New app + new web will read app_seasons* only once switched over.
-- =============================================================================
-- Run once in Supabase SQL Editor (production or staging). Idempotent-ish.

-- Catalogue of seasons
CREATE TABLE IF NOT EXISTS app_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,              -- e.g. '2025/26'
  year_start INTEGER NOT NULL,             -- e.g. 2025
  year_end INTEGER NOT NULL,               -- e.g. 2026
  football_data_season INTEGER NOT NULL,  -- FD API ?season= (2025, 2026, ...)
  first_gw INTEGER NOT NULL DEFAULT 1,
  last_gw INTEGER NOT NULL DEFAULT 38,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE app_seasons IS
  'Pile B season catalogue. status: draft=fixtures maybe loading; active=hard-switch target; closed=archive.';

-- Pointer used by NEW clients only (never write app_meta.current_gw from this path)
CREATE TABLE IF NOT EXISTS app_season_runtime (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_season_id UUID REFERENCES app_seasons(id),
  current_gw INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_season_runtime (id, current_gw)
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE app_season_runtime IS
  'Global current season/GW for folder-aware clients. Legacy apps ignore this.';

-- Fixtures per season
CREATE TABLE IF NOT EXISTS app_season_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES app_seasons(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (season_id, gw, fixture_index)
);

CREATE INDEX IF NOT EXISTS idx_app_season_fixtures_season_gw
  ON app_season_fixtures (season_id, gw);
CREATE INDEX IF NOT EXISTS idx_app_season_fixtures_api
  ON app_season_fixtures (api_match_id) WHERE api_match_id IS NOT NULL;

-- Results per season
CREATE TABLE IF NOT EXISTS app_season_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES app_seasons(id) ON DELETE CASCADE,
  gw INTEGER NOT NULL,
  fixture_index INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('H', 'D', 'A')),
  decided_at TIMESTAMPTZ DEFAULT NOW(),
  home_score INTEGER,
  away_score INTEGER,
  api_match_id INTEGER,
  UNIQUE (season_id, gw, fixture_index)
);

CREATE INDEX IF NOT EXISTS idx_app_season_results_season_gw
  ON app_season_results (season_id, gw);

-- Picks per season
CREATE TABLE IF NOT EXISTS app_season_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES app_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gw INTEGER NOT NULL,
  fixture_index INTEGER NOT NULL,
  pick TEXT NOT NULL CHECK (pick IN ('H', 'D', 'A')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (season_id, user_id, gw, fixture_index)
);

CREATE INDEX IF NOT EXISTS idx_app_season_picks_season_gw
  ON app_season_picks (season_id, gw);
CREATE INDEX IF NOT EXISTS idx_app_season_picks_user
  ON app_season_picks (season_id, user_id, gw);

-- Submissions per season
CREATE TABLE IF NOT EXISTS app_season_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES app_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gw INTEGER NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (season_id, user_id, gw)
);

CREATE INDEX IF NOT EXISTS idx_app_season_submissions_season_gw
  ON app_season_submissions (season_id, gw);

-- Tester override (optional): which folder a user follows on new clients
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS current_viewing_season_id UUID REFERENCES app_seasons(id);

ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS use_season_stack BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN user_notification_preferences.use_season_stack IS
  'When true on a folder-aware client, resolve season/GW from Pile B + current_viewing_season_id.';

-- RLS: readable by authenticated; writes via service role (Netlify functions / scripts)
ALTER TABLE app_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_season_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_season_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_season_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_season_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_season_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated reads app_seasons" ON app_seasons;
CREATE POLICY "Anyone authenticated reads app_seasons" ON app_seasons
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone authenticated reads app_season_runtime" ON app_season_runtime;
CREATE POLICY "Anyone authenticated reads app_season_runtime" ON app_season_runtime
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone authenticated reads app_season_fixtures" ON app_season_fixtures;
CREATE POLICY "Anyone authenticated reads app_season_fixtures" ON app_season_fixtures
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone authenticated reads app_season_results" ON app_season_results;
CREATE POLICY "Anyone authenticated reads app_season_results" ON app_season_results
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users read all app_season_picks" ON app_season_picks;
CREATE POLICY "Users read all app_season_picks" ON app_season_picks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users manage own app_season_picks" ON app_season_picks;
CREATE POLICY "Users manage own app_season_picks" ON app_season_picks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read all app_season_submissions" ON app_season_submissions;
CREATE POLICY "Users read all app_season_submissions" ON app_season_submissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users manage own app_season_submissions" ON app_season_submissions;
CREATE POLICY "Users manage own app_season_submissions" ON app_season_submissions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
