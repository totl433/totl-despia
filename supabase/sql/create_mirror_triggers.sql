-- Real-time mirroring triggers: Automatically copy Web data to App tables
-- This ensures that when Web users submit picks, they're immediately available in App tables

-- ============================================================================
-- TRIGGER 1: Mirror picks from Web (picks) to App (app_picks)
-- ============================================================================
CREATE OR REPLACE FUNCTION mirror_picks_to_app()
RETURNS TRIGGER AS $$
DECLARE
  existing_pick TEXT;
BEGIN
  -- Check if the pick already exists in app_picks with the same value
  -- This prevents circular updates when App→Web trigger writes to picks
  SELECT pick INTO existing_pick
  FROM app_picks
  WHERE user_id = NEW.user_id 
    AND gw = NEW.gw 
    AND fixture_index = NEW.fixture_index;
  
  -- Only insert/update if the value is different or doesn't exist
  IF existing_pick IS NULL OR existing_pick != NEW.pick THEN
    -- Insert or update the corresponding row in app_picks
    INSERT INTO app_picks (user_id, gw, fixture_index, pick)
    VALUES (NEW.user_id, NEW.gw, NEW.fixture_index, NEW.pick)
    ON CONFLICT (user_id, gw, fixture_index)
    DO UPDATE SET
      pick = EXCLUDED.pick;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_mirror_picks_to_app ON picks;
CREATE TRIGGER trigger_mirror_picks_to_app
  AFTER INSERT OR UPDATE ON picks
  FOR EACH ROW
  EXECUTE FUNCTION mirror_picks_to_app();

-- ============================================================================
-- TRIGGER 2: Mirror submissions from Web (gw_submissions) to App (app_gw_submissions)
-- ============================================================================
CREATE OR REPLACE FUNCTION mirror_submissions_to_app()
RETURNS TRIGGER AS $$
DECLARE
  existing_submitted_at TIMESTAMPTZ;
BEGIN
  -- Check if the submission already exists in app_gw_submissions with the same value
  -- This prevents circular updates when App→Web trigger writes to gw_submissions
  SELECT submitted_at INTO existing_submitted_at
  FROM app_gw_submissions
  WHERE user_id = NEW.user_id 
    AND gw = NEW.gw;
  
  -- Only insert/update if the value is different or doesn't exist
  IF existing_submitted_at IS NULL OR existing_submitted_at != NEW.submitted_at THEN
    -- Insert or update the corresponding row in app_gw_submissions
    INSERT INTO app_gw_submissions (user_id, gw, submitted_at)
    VALUES (NEW.user_id, NEW.gw, NEW.submitted_at)
    ON CONFLICT (user_id, gw)
    DO UPDATE SET
      submitted_at = EXCLUDED.submitted_at;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_mirror_submissions_to_app ON gw_submissions;
CREATE TRIGGER trigger_mirror_submissions_to_app
  AFTER INSERT OR UPDATE ON gw_submissions
  FOR EACH ROW
  EXECUTE FUNCTION mirror_submissions_to_app();

-- ============================================================================
-- TRIGGER 3: Mirror fixtures from Web (fixtures) to App (app_fixtures)
-- Note: This mirrors fixtures when they're created/updated in Web tables
-- ============================================================================
CREATE OR REPLACE FUNCTION mirror_fixtures_to_app()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update the corresponding row in app_fixtures
  INSERT INTO app_fixtures (
    gw,
    fixture_index,
    home_team,
    away_team,
    home_code,
    away_code,
    home_name,
    away_name,
    kickoff_time,
    api_match_id
  )
  VALUES (
    NEW.gw,
    NEW.fixture_index,
    NEW.home_team,
    NEW.away_team,
    NEW.home_code,
    NEW.away_code,
    NEW.home_name,
    NEW.away_name,
    NEW.kickoff_time,
    NULL  -- fixtures table doesn't have api_match_id column, set to NULL
  )
  ON CONFLICT (gw, fixture_index)
  DO UPDATE SET
    home_team = EXCLUDED.home_team,
    away_team = EXCLUDED.away_team,
    home_code = EXCLUDED.home_code,
    away_code = EXCLUDED.away_code,
    home_name = EXCLUDED.home_name,
    away_name = EXCLUDED.away_name,
    kickoff_time = EXCLUDED.kickoff_time;
    -- Don't update api_match_id when mirroring from fixtures (it doesn't exist in source table)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_mirror_fixtures_to_app ON fixtures;
CREATE TRIGGER trigger_mirror_fixtures_to_app
  AFTER INSERT OR UPDATE ON fixtures
  FOR EACH ROW
  EXECUTE FUNCTION mirror_fixtures_to_app();

-- ============================================================================
-- REVERSE MIRRORING: Mirror App → Web (for 4 test users only)
-- ============================================================================
-- The 4 test users (Jof, Carl, SP, ThomasJamesBird) submit on App
-- but need to appear on Web too, so we mirror their App submissions to Web
-- ============================================================================

-- Test user IDs (4 test users who submit on App)
-- Jof: 4542c037-5b38-40d0-b189-847b8f17c222
-- Carl: f8a1669e-2512-4edf-9c21-b9f87b3efbe2
-- SP: 9c0bcf50-370d-412d-8826-95371a72b4fe
-- ThomasJamesBird: 36f31625-6d6c-4aa4-815a-1493a812841b

-- ============================================================================
-- TRIGGER 4: Mirror picks from App (app_picks) to Web (picks) - Test users only
-- ============================================================================
CREATE OR REPLACE FUNCTION mirror_picks_to_web()
RETURNS TRIGGER AS $$
DECLARE
  is_test_user BOOLEAN;
  existing_pick TEXT;
BEGIN
  -- Check if this is one of the 4 test users
  is_test_user := NEW.user_id IN (
    '4542c037-5b38-40d0-b189-847b8f17c222', -- Jof
    'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', -- Carl
    '9c0bcf50-370d-412d-8826-95371a72b4fe', -- SP
    '36f31625-6d6c-4aa4-815a-1493a812841b'  -- ThomasJamesBird
  );
  
  -- Only mirror if this is a test user
  IF is_test_user THEN
    -- Check if the pick already exists with the same value (prevent unnecessary updates)
    SELECT pick INTO existing_pick
    FROM picks
    WHERE user_id = NEW.user_id 
      AND gw = NEW.gw 
      AND fixture_index = NEW.fixture_index;
    
    -- Only insert/update if the value is different or doesn't exist
    IF existing_pick IS NULL OR existing_pick != NEW.pick THEN
      -- Insert or update the corresponding row in picks
      INSERT INTO picks (user_id, gw, fixture_index, pick)
      VALUES (NEW.user_id, NEW.gw, NEW.fixture_index, NEW.pick)
      ON CONFLICT (user_id, gw, fixture_index)
      DO UPDATE SET
        pick = EXCLUDED.pick;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_mirror_picks_to_web ON app_picks;
CREATE TRIGGER trigger_mirror_picks_to_web
  AFTER INSERT OR UPDATE ON app_picks
  FOR EACH ROW
  EXECUTE FUNCTION mirror_picks_to_web();

-- ============================================================================
-- TRIGGER 5: Mirror submissions from App (app_gw_submissions) to Web (gw_submissions) - Test users only
-- ============================================================================
CREATE OR REPLACE FUNCTION mirror_submissions_to_web()
RETURNS TRIGGER AS $$
DECLARE
  is_test_user BOOLEAN;
  existing_submitted_at TIMESTAMPTZ;
BEGIN
  -- Check if this is one of the 4 test users
  is_test_user := NEW.user_id IN (
    '4542c037-5b38-40d0-b189-847b8f17c222', -- Jof
    'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', -- Carl
    '9c0bcf50-370d-412d-8826-95371a72b4fe', -- SP
    '36f31625-6d6c-4aa4-815a-1493a812841b'  -- ThomasJamesBird
  );
  
  -- Only mirror if this is a test user
  IF is_test_user THEN
    -- Check if the submission already exists with the same value (prevent unnecessary updates)
    SELECT submitted_at INTO existing_submitted_at
    FROM gw_submissions
    WHERE user_id = NEW.user_id 
      AND gw = NEW.gw;
    
    -- Only insert/update if the value is different or doesn't exist
    IF existing_submitted_at IS NULL OR existing_submitted_at != NEW.submitted_at THEN
      -- Insert or update the corresponding row in gw_submissions
      INSERT INTO gw_submissions (user_id, gw, submitted_at)
      VALUES (NEW.user_id, NEW.gw, NEW.submitted_at)
      ON CONFLICT (user_id, gw)
      DO UPDATE SET
        submitted_at = EXCLUDED.submitted_at;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_mirror_submissions_to_web ON app_gw_submissions;
CREATE TRIGGER trigger_mirror_submissions_to_web
  AFTER INSERT OR UPDATE ON app_gw_submissions
  FOR EACH ROW
  EXECUTE FUNCTION mirror_submissions_to_web();

-- ============================================================================
-- NOTE: Results are NOT mirrored from Web to App
-- ============================================================================
-- Web results (gw_results) should NOT be mirrored to app_gw_results
-- Once Web users' picks are mirrored to app_picks, they are treated as App users
-- The API scores ALL picks in app_picks (both App users and mirrored Web users)
-- and writes results directly to app_gw_results
-- ============================================================================

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. These triggers run automatically whenever data is inserted/updated in Web/App tables
-- 2. They use ON CONFLICT to handle updates gracefully
-- 3. The triggers run synchronously as part of the transaction, so they're guaranteed to execute
-- 4. If a trigger fails, the entire transaction (including the original insert) will roll back
-- 5. These triggers will work for both new submissions and updates to existing data
-- 6. All picks in app_picks (App users + mirrored Web users) are scored by the API
-- 7. The API writes results directly to app_gw_results (not mirrored from Web)
-- 8. Circular updates are prevented by checking if data already exists with same values
-- 9. App → Web mirroring only applies to 4 test users (Jof, Carl, SP, ThomasJamesBird)
-- 10. Web → App mirroring applies to all Web users
-- ============================================================================

