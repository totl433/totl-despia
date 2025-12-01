-- ============================================
-- Stage 1: Create App Database Replica Tables
-- ============================================
-- These tables mirror the Web database structure
-- but are separate tables for the App/Despia system
-- DO NOT modify any Web database tables

-- ============================================
-- 1. app_meta table (mirror of meta)
-- ============================================
CREATE TABLE IF NOT EXISTS app_meta (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_gw INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT app_meta_single_row CHECK (id = 1)
);

-- ============================================
-- 2. app_fixtures table (mirror of fixtures)
-- ============================================
CREATE TABLE IF NOT EXISTS app_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gw INTEGER NOT NULL,
  fixture_index INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_code TEXT,
  away_code TEXT,
  home_name TEXT,
  away_name TEXT,
  kickoff_time TIMESTAMPTZ,
  api_match_id INTEGER, -- For API-scored fixtures (like test_api_fixtures)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gw, fixture_index)
);

-- ============================================
-- 3. app_picks table (mirror of picks)
-- ============================================
CREATE TABLE IF NOT EXISTS app_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gw INTEGER NOT NULL,
  fixture_index INTEGER NOT NULL,
  pick TEXT NOT NULL CHECK (pick IN ('H', 'D', 'A')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gw, fixture_index)
);

-- ============================================
-- 4. app_gw_submissions table (mirror of gw_submissions)
-- ============================================
CREATE TABLE IF NOT EXISTS app_gw_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gw INTEGER NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gw)
);

-- ============================================
-- 5. app_gw_results table (mirror of gw_results, scored via API)
-- ============================================
CREATE TABLE IF NOT EXISTS app_gw_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gw INTEGER NOT NULL,
  fixture_index INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('H', 'D', 'A')),
  decided_at TIMESTAMPTZ DEFAULT NOW(),
  home_score INTEGER,
  away_score INTEGER,
  api_match_id INTEGER, -- Link to API match if available
  UNIQUE(gw, fixture_index)
);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_app_fixtures_gw ON app_fixtures(gw);
CREATE INDEX IF NOT EXISTS idx_app_fixtures_fixture_index ON app_fixtures(fixture_index);
CREATE INDEX IF NOT EXISTS idx_app_fixtures_api_match_id ON app_fixtures(api_match_id) WHERE api_match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_fixtures_codes ON app_fixtures(home_code, away_code) WHERE home_code IS NOT NULL AND away_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_picks_user_gw ON app_picks(user_id, gw);
CREATE INDEX IF NOT EXISTS idx_app_picks_gw ON app_picks(gw);
CREATE INDEX IF NOT EXISTS idx_app_picks_fixture ON app_picks(gw, fixture_index);

CREATE INDEX IF NOT EXISTS idx_app_gw_submissions_user_gw ON app_gw_submissions(user_id, gw);
CREATE INDEX IF NOT EXISTS idx_app_gw_submissions_gw ON app_gw_submissions(gw);

CREATE INDEX IF NOT EXISTS idx_app_gw_results_gw ON app_gw_results(gw);
CREATE INDEX IF NOT EXISTS idx_app_gw_results_fixture ON app_gw_results(gw, fixture_index);
CREATE INDEX IF NOT EXISTS idx_app_gw_results_api_match_id ON app_gw_results(api_match_id) WHERE api_match_id IS NOT NULL;

-- ============================================
-- Insert Initial Meta Record
-- ============================================
INSERT INTO app_meta (id, current_gw) 
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE app_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_gw_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_gw_results ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Drop Existing Policies (if any)
-- ============================================
DROP POLICY IF EXISTS "Anyone can read app_meta" ON app_meta;
DROP POLICY IF EXISTS "Anyone can read app_fixtures" ON app_fixtures;
DROP POLICY IF EXISTS "Admins can insert app_fixtures" ON app_fixtures;
DROP POLICY IF EXISTS "Admins can update app_fixtures" ON app_fixtures;
DROP POLICY IF EXISTS "Admins can delete app_fixtures" ON app_fixtures;
DROP POLICY IF EXISTS "Users can read all app_picks" ON app_picks;
DROP POLICY IF EXISTS "Users can insert their own app_picks" ON app_picks;
DROP POLICY IF EXISTS "Users can update their own app_picks" ON app_picks;
DROP POLICY IF EXISTS "Users can read all app_gw_submissions" ON app_gw_submissions;
DROP POLICY IF EXISTS "Users can insert their own app_gw_submissions" ON app_gw_submissions;
DROP POLICY IF EXISTS "Users can update their own app_gw_submissions" ON app_gw_submissions;
DROP POLICY IF EXISTS "Anyone can read app_gw_results" ON app_gw_results;

-- ============================================
-- RLS Policies
-- ============================================

-- app_meta: Read-only for authenticated users
CREATE POLICY "Anyone can read app_meta" ON app_meta
  FOR SELECT USING (true);

-- app_fixtures: Read-only for authenticated users, admins can insert/update/delete
CREATE POLICY "Anyone can read app_fixtures" ON app_fixtures
  FOR SELECT USING (true);

-- Allow admins to insert/update/delete fixtures
CREATE POLICY "Admins can insert app_fixtures" ON app_fixtures
  FOR INSERT 
  WITH CHECK (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  );

CREATE POLICY "Admins can update app_fixtures" ON app_fixtures
  FOR UPDATE 
  USING (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  )
  WITH CHECK (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  );

CREATE POLICY "Admins can delete app_fixtures" ON app_fixtures
  FOR DELETE 
  USING (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  );

-- app_picks: Users can read all, insert/update their own
CREATE POLICY "Users can read all app_picks" ON app_picks
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own app_picks" ON app_picks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own app_picks" ON app_picks
  FOR UPDATE USING (auth.uid() = user_id);

-- app_gw_submissions: Users can read all, insert/update their own
CREATE POLICY "Users can read all app_gw_submissions" ON app_gw_submissions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own app_gw_submissions" ON app_gw_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own app_gw_submissions" ON app_gw_submissions
  FOR UPDATE USING (auth.uid() = user_id);

-- app_gw_results: Read-only for authenticated users (updated by API/system)
CREATE POLICY "Anyone can read app_gw_results" ON app_gw_results
  FOR SELECT USING (true);

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE app_meta IS 'App metadata: current gameweek';
COMMENT ON TABLE app_fixtures IS 'App fixtures: mirrors Web fixtures structure, can include API-scored fixtures';
COMMENT ON TABLE app_picks IS 'App picks: user predictions for App fixtures';
COMMENT ON TABLE app_gw_submissions IS 'App submissions: tracks when users submit their picks for a GW';
COMMENT ON TABLE app_gw_results IS 'App results: scored via API (like test_api system), mirrors gw_results structure';

