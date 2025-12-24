-- Real-time mirroring triggers: Automatically copy Web data to App tables
-- This ensures that when Web users submit picks, they're immediately available in App tables

-- ============================================================================
-- TRIGGER 1: Mirror picks from Web (picks) to App (app_picks)
-- ============================================================================
CREATE OR REPLACE FUNCTION mirror_picks_to_app()
RETURNS TRIGGER AS $$
DECLARE
  existing_pick TEXT;
  app_fixture_index INTEGER;
  web_fixture RECORD;
  web_home_code_norm TEXT;
  web_away_code_norm TEXT;
BEGIN
  -- Get the web fixture details to find matching app fixture by team codes
  SELECT home_code, away_code, home_name, away_name INTO web_fixture
  FROM fixtures
  WHERE gw = NEW.gw AND fixture_index = NEW.fixture_index;
  
  -- Normalize team codes (handle aliases like NFO -> NOT for Nottingham Forest)
  -- Web uses NFO, App uses NOT
  web_home_code_norm := CASE 
    WHEN web_fixture.home_code = 'NFO' THEN 'NOT'
    ELSE web_fixture.home_code
  END;
  web_away_code_norm := CASE 
    WHEN web_fixture.away_code = 'NFO' THEN 'NOT'
    ELSE web_fixture.away_code
  END;
  
  -- Find the matching app fixture by team codes (handles different orders)
  -- Both Web Admin and API Admin populate codes, so code matching should always work
  -- Fall back to names if codes are somehow missing
  SELECT fixture_index INTO app_fixture_index
  FROM app_fixtures
  WHERE gw = NEW.gw
    AND (
      -- Match by codes (both admins populate these: Web Admin from text, API Admin from API)
      -- Normalize codes to handle aliases (NFO -> NOT)
      (home_code IS NOT NULL AND away_code IS NOT NULL 
       AND web_home_code_norm IS NOT NULL AND web_away_code_norm IS NOT NULL
       AND (
         (home_code = web_home_code_norm AND away_code = web_away_code_norm)
         OR (home_code = web_away_code_norm AND away_code = web_home_code_norm)
       ))
      -- Fall back to names if codes are missing (API Admin has names, Web Admin doesn't)
      OR (web_fixture.home_code IS NULL OR web_fixture.away_code IS NULL
          AND home_name IS NOT NULL AND away_name IS NOT NULL
          AND web_fixture.home_name IS NOT NULL AND web_fixture.away_name IS NOT NULL
          AND (
            (LOWER(home_name) = LOWER(web_fixture.home_name) 
             AND LOWER(away_name) = LOWER(web_fixture.away_name))
            OR (LOWER(home_name) = LOWER(web_fixture.away_name) 
                AND LOWER(away_name) = LOWER(web_fixture.home_name))
          ))
    )
  LIMIT 1;
  
  -- If no matching fixture found, fall back to same fixture_index (backward compatibility)
  IF app_fixture_index IS NULL THEN
    app_fixture_index := NEW.fixture_index;
  END IF;
  
  -- Check if the pick already exists in app_picks with the same value
  -- This prevents circular updates when App→Web trigger writes to picks
  SELECT pick INTO existing_pick
  FROM app_picks
  WHERE user_id = NEW.user_id 
    AND gw = NEW.gw 
    AND fixture_index = app_fixture_index;
  
  -- Only insert/update if the value is different or doesn't exist
  IF existing_pick IS NULL OR existing_pick != NEW.pick THEN
    -- Insert or update the corresponding row in app_picks using matched fixture_index
    INSERT INTO app_picks (user_id, gw, fixture_index, pick)
    VALUES (NEW.user_id, NEW.gw, app_fixture_index, NEW.pick)
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
-- Matches fixtures by team codes/names to handle different orders
-- ============================================================================
CREATE OR REPLACE FUNCTION mirror_fixtures_to_app()
RETURNS TRIGGER AS $$
DECLARE
  existing_app_fixture_index INTEGER;
  web_home_code_norm TEXT;
  web_away_code_norm TEXT;
BEGIN
  -- Normalize team codes (handle aliases like NFO -> NOT for Nottingham Forest)
  -- Web uses NFO, App uses NOT
  web_home_code_norm := CASE 
    WHEN NEW.home_code = 'NFO' THEN 'NOT'
    ELSE NEW.home_code
  END;
  web_away_code_norm := CASE 
    WHEN NEW.away_code = 'NFO' THEN 'NOT'
    ELSE NEW.away_code
  END;
  
  -- Find existing app fixture with matching teams (handles different orders)
  -- Both Web Admin and API Admin populate codes, so code matching should always work
  SELECT fixture_index INTO existing_app_fixture_index
  FROM app_fixtures
  WHERE gw = NEW.gw
    AND (
      -- Match by codes (both admins populate these)
      -- Normalize codes to handle aliases (NFO -> NOT)
      (home_code IS NOT NULL AND away_code IS NOT NULL 
       AND web_home_code_norm IS NOT NULL AND web_away_code_norm IS NOT NULL
       AND (
         (home_code = web_home_code_norm AND away_code = web_away_code_norm)
         OR (home_code = web_away_code_norm AND away_code = web_home_code_norm)
       ))
      -- Fall back to names if codes are missing
      OR (NEW.home_code IS NULL OR NEW.away_code IS NULL
          AND home_name IS NOT NULL AND away_name IS NOT NULL
          AND NEW.home_name IS NOT NULL AND NEW.away_name IS NOT NULL
          AND (
            (LOWER(home_name) = LOWER(NEW.home_name) 
             AND LOWER(away_name) = LOWER(NEW.away_name))
            OR (LOWER(home_name) = LOWER(NEW.away_name) 
                AND LOWER(away_name) = LOWER(NEW.home_name))
          ))
    )
  LIMIT 1;
  
  -- If matching fixture exists, update it; otherwise insert with same fixture_index
  IF existing_app_fixture_index IS NOT NULL THEN
    -- Update existing fixture at its current index
    UPDATE app_fixtures
    SET
      home_team = NEW.home_team,
      away_team = NEW.away_team,
      home_code = NEW.home_code,
      away_code = NEW.away_code,
      home_name = NEW.home_name,
      away_name = NEW.away_name,
      kickoff_time = NEW.kickoff_time
    WHERE gw = NEW.gw AND fixture_index = existing_app_fixture_index;
  ELSE
    -- Insert new fixture with same fixture_index (backward compatibility)
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
  END IF;
  
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
-- REVERSE MIRRORING: Mirror App → Web (for app-only users)
-- ============================================================================
-- The app-only users (Jof, Carl, SP, ThomasJamesBird, Sim, Will Middleton) submit on App
-- but need to appear on Web too, so we mirror their App submissions to Web
-- ============================================================================

-- App-only user IDs (6 users who submit on App)
-- Jof: 4542c037-5b38-40d0-b189-847b8f17c222
-- Carl: f8a1669e-2512-4edf-9c21-b9f87b3efbe2
-- SP: 9c0bcf50-370d-412d-8826-95371a72b4fe
-- ThomasJamesBird: 36f31625-6d6c-4aa4-815a-1493a812841b
-- Sim: c94f9804-ba11-4cd2-8892-49657aa6412c
-- Will Middleton: 42b48136-040e-42a3-9b0a-dc9550dd1cae

-- ============================================================================
-- TRIGGER 4: Mirror picks from App (app_picks) to Web (picks) - App-only users
-- ============================================================================
CREATE OR REPLACE FUNCTION mirror_picks_to_web()
RETURNS TRIGGER AS $$
DECLARE
  is_test_user BOOLEAN;
  existing_pick TEXT;
  web_fixture_index INTEGER;
  app_fixture RECORD;
  app_home_code_norm TEXT;
  app_away_code_norm TEXT;
BEGIN
  -- Check if this is one of the app-only users
  is_test_user := NEW.user_id IN (
    '4542c037-5b38-40d0-b189-847b8f17c222', -- Jof
    'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', -- Carl
    '9c0bcf50-370d-412d-8826-95371a72b4fe', -- SP
    '36f31625-6d6c-4aa4-815a-1493a812841b', -- ThomasJamesBird
    'c94f9804-ba11-4cd2-8892-49657aa6412c', -- Sim
    '42b48136-040e-42a3-9b0a-dc9550dd1cae'  -- Will Middleton
  );
  
  -- Only mirror if this is a test user
  IF is_test_user THEN
    -- Get the app fixture details to find matching web fixture by team codes
    SELECT home_code, away_code, home_name, away_name INTO app_fixture
    FROM app_fixtures
    WHERE gw = NEW.gw AND fixture_index = NEW.fixture_index;
    
    -- Normalize team codes (handle aliases like NOT -> NFO for Nottingham Forest)
    -- App uses NOT, Web uses NFO
    app_home_code_norm := CASE 
      WHEN app_fixture.home_code = 'NOT' THEN 'NFO'
      ELSE app_fixture.home_code
    END;
    app_away_code_norm := CASE 
      WHEN app_fixture.away_code = 'NOT' THEN 'NFO'
      ELSE app_fixture.away_code
    END;
    
    -- Find the matching web fixture by team codes (handles different orders)
    -- Both Web Admin and API Admin populate codes, so code matching should always work
    SELECT fixture_index INTO web_fixture_index
    FROM fixtures
    WHERE gw = NEW.gw
      AND (
        -- Match by codes (both admins populate these)
        -- Normalize codes to handle aliases (NOT -> NFO)
        (home_code IS NOT NULL AND away_code IS NOT NULL 
         AND app_home_code_norm IS NOT NULL AND app_away_code_norm IS NOT NULL
         AND (
           (home_code = app_home_code_norm AND away_code = app_away_code_norm)
           OR (home_code = app_away_code_norm AND away_code = app_home_code_norm)
         ))
        -- Fall back to names if codes are missing (Web Admin doesn't populate names, but API Admin does)
        OR (app_fixture.home_code IS NULL OR app_fixture.away_code IS NULL
            AND home_name IS NOT NULL AND away_name IS NOT NULL
            AND app_fixture.home_name IS NOT NULL AND app_fixture.away_name IS NOT NULL
            AND (
              (LOWER(home_name) = LOWER(app_fixture.home_name) 
               AND LOWER(away_name) = LOWER(app_fixture.away_name))
              OR (LOWER(home_name) = LOWER(app_fixture.away_name) 
                  AND LOWER(away_name) = LOWER(app_fixture.home_name))
            ))
      )
    LIMIT 1;
    
    -- If no matching fixture found, fall back to same fixture_index (backward compatibility)
    IF web_fixture_index IS NULL THEN
      web_fixture_index := NEW.fixture_index;
    END IF;
    
    -- Check if the pick already exists with the same value (prevent unnecessary updates)
    SELECT pick INTO existing_pick
    FROM picks
    WHERE user_id = NEW.user_id 
      AND gw = NEW.gw 
      AND fixture_index = web_fixture_index;
    
    -- Only insert/update if the value is different or doesn't exist
    IF existing_pick IS NULL OR existing_pick != NEW.pick THEN
      -- Insert or update the corresponding row in picks using matched fixture_index
      INSERT INTO picks (user_id, gw, fixture_index, pick)
      VALUES (NEW.user_id, NEW.gw, web_fixture_index, NEW.pick)
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
-- TRIGGER 5: Mirror submissions from App (app_gw_submissions) to Web (gw_submissions) - App-only users
-- ============================================================================
CREATE OR REPLACE FUNCTION mirror_submissions_to_web()
RETURNS TRIGGER AS $$
DECLARE
  is_test_user BOOLEAN;
  existing_submitted_at TIMESTAMPTZ;
BEGIN
  -- Check if this is one of the app-only users
  is_test_user := NEW.user_id IN (
    '4542c037-5b38-40d0-b189-847b8f17c222', -- Jof
    'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', -- Carl
    '9c0bcf50-370d-412d-8826-95371a72b4fe', -- SP
    '36f31625-6d6c-4aa4-815a-1493a812841b', -- ThomasJamesBird
    'c94f9804-ba11-4cd2-8892-49657aa6412c', -- Sim
    '42b48136-040e-42a3-9b0a-dc9550dd1cae'  -- Will Middleton
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
-- 9. App → Web mirroring only applies to app-only users (Jof, Carl, SP, ThomasJamesBird, Sim, Will Middleton)
-- 10. Web → App mirroring applies to all Web users
-- 11. Fixture matching: Triggers match fixtures by team codes/names, not just fixture_index
--     This allows fixtures to be in different orders between web and app tables
--     Falls back to fixture_index matching if team codes/names are missing (backward compatibility)
-- ============================================================================

