-- Create test_api_meta table
CREATE TABLE IF NOT EXISTS test_api_meta (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_test_gw INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create test_api_fixtures table
CREATE TABLE IF NOT EXISTS test_api_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_gw INTEGER NOT NULL,
  fixture_index INTEGER NOT NULL,
  api_match_id INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_code TEXT,
  away_code TEXT,
  home_name TEXT,
  away_name TEXT,
  kickoff_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(test_gw, fixture_index)
);

-- Create test_api_picks table
CREATE TABLE IF NOT EXISTS test_api_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matchday INTEGER NOT NULL,
  fixture_index INTEGER NOT NULL,
  pick TEXT NOT NULL CHECK (pick IN ('H', 'D', 'A')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, matchday, fixture_index)
);

-- Create test_api_submissions table
CREATE TABLE IF NOT EXISTS test_api_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matchday INTEGER NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, matchday)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_test_api_fixtures_test_gw ON test_api_fixtures(test_gw);
CREATE INDEX IF NOT EXISTS idx_test_api_fixtures_fixture_index ON test_api_fixtures(fixture_index);
CREATE INDEX IF NOT EXISTS idx_test_api_picks_user_matchday ON test_api_picks(user_id, matchday);
CREATE INDEX IF NOT EXISTS idx_test_api_picks_matchday ON test_api_picks(matchday);
CREATE INDEX IF NOT EXISTS idx_test_api_submissions_user_matchday ON test_api_submissions(user_id, matchday);

-- Insert initial meta record
INSERT INTO test_api_meta (id, current_test_gw) 
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE test_api_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_api_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_api_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_api_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for test_api_meta (read-only for authenticated users)
-- Note: If policies already exist, you may get an error. That's okay - just skip creating them.
CREATE POLICY IF NOT EXISTS "Anyone can read test_api_meta" ON test_api_meta
  FOR SELECT USING (true);

-- RLS Policies for test_api_fixtures (read-only for authenticated users)
CREATE POLICY IF NOT EXISTS "Anyone can read test_api_fixtures" ON test_api_fixtures
  FOR SELECT USING (true);

-- RLS Policies for test_api_picks (users can read/write their own picks)
CREATE POLICY IF NOT EXISTS "Users can read all test_api_picks" ON test_api_picks
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can insert their own test_api_picks" ON test_api_picks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own test_api_picks" ON test_api_picks
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for test_api_submissions (users can read all, insert/update their own)
CREATE POLICY IF NOT EXISTS "Users can read all test_api_submissions" ON test_api_submissions
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can insert their own test_api_submissions" ON test_api_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own test_api_submissions" ON test_api_submissions
  FOR UPDATE USING (auth.uid() = user_id);

