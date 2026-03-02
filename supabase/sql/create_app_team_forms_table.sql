-- ============================================
-- Create app_team_forms table
-- ============================================
-- Stores team form data (last 5 games: W/L/D) per gameweek
-- Form data is fetched once when gameweek is published, then served from DB

CREATE TABLE IF NOT EXISTS app_team_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gw INTEGER NOT NULL,
  team_code TEXT NOT NULL, -- e.g., 'CHE', 'ARS', 'MCI'
  form TEXT NOT NULL, -- e.g., 'WWLDW' (last 5 games: Win/Win/Loss/Draw/Win)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gw, team_code)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_app_team_forms_gw ON app_team_forms(gw);
CREATE INDEX IF NOT EXISTS idx_app_team_forms_team_code ON app_team_forms(team_code);
CREATE INDEX IF NOT EXISTS idx_app_team_forms_gw_team ON app_team_forms(gw, team_code);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_updated_at_app_team_forms()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_app_team_forms ON app_team_forms;
CREATE TRIGGER trg_touch_updated_at_app_team_forms
BEFORE UPDATE ON app_team_forms
FOR EACH ROW EXECUTE FUNCTION touch_updated_at_app_team_forms();

-- Enable Row Level Security (RLS)
ALTER TABLE app_team_forms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Anyone can read app_team_forms" ON app_team_forms;
DROP POLICY IF EXISTS "Admins can insert app_team_forms" ON app_team_forms;
DROP POLICY IF EXISTS "Admins can update app_team_forms" ON app_team_forms;
DROP POLICY IF EXISTS "Admins can delete app_team_forms" ON app_team_forms;

-- RLS Policies
-- app_team_forms: Read-only for authenticated users, admins can insert/update/delete
CREATE POLICY "Anyone can read app_team_forms" ON app_team_forms
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert app_team_forms" ON app_team_forms
  FOR INSERT 
  WITH CHECK (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  );

CREATE POLICY "Admins can update app_team_forms" ON app_team_forms
  FOR UPDATE 
  USING (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  )
  WITH CHECK (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  );

CREATE POLICY "Admins can delete app_team_forms" ON app_team_forms
  FOR DELETE 
  USING (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  );

-- Comments for Documentation
COMMENT ON TABLE app_team_forms IS 'Team form data (last 5 games: W/L/D) per gameweek, fetched once when GW is published';


