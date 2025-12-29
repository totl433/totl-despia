-- ============================================================================
-- Migration: Add David Bird to app-only users list
-- ============================================================================
-- This updates the mirroring triggers to include David Bird (d2cbeca9-7dae-4be1-88fb-706911d67256)
-- as one of the app-only users whose picks and submissions are automatically mirrored to web
-- ============================================================================

-- Update mirror_picks_to_web() function to include David Bird
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
    '42b48136-040e-42a3-9b0a-dc9550dd1cae', -- Will Middleton
    'd2cbeca9-7dae-4be1-88fb-706911d67256'  -- David Bird
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

-- Update mirror_submissions_to_web() function to include David Bird
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
    '42b48136-040e-42a3-9b0a-dc9550dd1cae', -- Will Middleton
    'd2cbeca9-7dae-4be1-88fb-706911d67256'  -- David Bird
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





