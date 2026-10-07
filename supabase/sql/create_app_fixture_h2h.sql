-- ============================================
-- Fixture H2H cache for prediction flip cards
-- ============================================
-- Populated after GW publish (rate-limited Football Data head2head calls).
-- Keyed by api_match_id for the published fixture.

CREATE TABLE IF NOT EXISTS app_fixture_h2h (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gw INTEGER NOT NULL,
  api_match_id BIGINT NOT NULL,
  home_code TEXT,
  away_code TEXT,
  home_wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  away_wins INTEGER NOT NULL DEFAULT 0,
  number_of_matches INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (gw, api_match_id)
);

CREATE INDEX IF NOT EXISTS idx_app_fixture_h2h_gw ON app_fixture_h2h(gw);
CREATE INDEX IF NOT EXISTS idx_app_fixture_h2h_match ON app_fixture_h2h(api_match_id);

CREATE OR REPLACE FUNCTION touch_updated_at_app_fixture_h2h()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_app_fixture_h2h ON app_fixture_h2h;
CREATE TRIGGER trg_touch_updated_at_app_fixture_h2h
BEFORE UPDATE ON app_fixture_h2h
FOR EACH ROW EXECUTE FUNCTION touch_updated_at_app_fixture_h2h();

ALTER TABLE app_fixture_h2h ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app_fixture_h2h" ON app_fixture_h2h;
DROP POLICY IF EXISTS "Admins can insert app_fixture_h2h" ON app_fixture_h2h;
DROP POLICY IF EXISTS "Admins can update app_fixture_h2h" ON app_fixture_h2h;
DROP POLICY IF EXISTS "Admins can delete app_fixture_h2h" ON app_fixture_h2h;

CREATE POLICY "Anyone can read app_fixture_h2h" ON app_fixture_h2h
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert app_fixture_h2h" ON app_fixture_h2h
  FOR INSERT
  WITH CHECK (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  );

CREATE POLICY "Admins can update app_fixture_h2h" ON app_fixture_h2h
  FOR UPDATE
  USING (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  )
  WITH CHECK (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  );

CREATE POLICY "Admins can delete app_fixture_h2h" ON app_fixture_h2h
  FOR DELETE
  USING (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  );

COMMENT ON TABLE app_fixture_h2h IS
  'PL head-to-head (since 2020) cached per published fixture for prediction flip cards';
