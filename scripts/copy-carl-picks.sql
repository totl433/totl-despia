-- Copy Carl's Main GW 12 picks to Test API picks (matchday 1)
-- This ONLY updates test_api_picks table for Carl's user_id and matchday 1
-- Does NOT change anything else

-- Step 1: Get Carl's user_id (run this first to verify)
SELECT id, name FROM users WHERE name ILIKE 'carl';

-- Step 2: Copy the picks (replace with Carl's actual user_id from Step 1 if needed)
-- Using Carl's known user_id: f8a1669e-2512-4edf-9c21-b9f87b3efbe2
INSERT INTO test_api_picks (user_id, matchday, fixture_index, pick)
SELECT 
  p.user_id,
  1 as matchday,
  p.fixture_index,
  p.pick
FROM picks p
WHERE p.user_id = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2'
  AND p.gw = 12
ON CONFLICT (user_id, matchday, fixture_index) 
DO UPDATE SET 
  pick = EXCLUDED.pick;

-- Step 3: Verify the update
SELECT 
  fixture_index,
  pick,
  CASE 
    WHEN pick = 'H' THEN 'Home Win'
    WHEN pick = 'A' THEN 'Away Win'
    WHEN pick = 'D' THEN 'Draw'
  END as pick_label
FROM test_api_picks
WHERE user_id = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2'
  AND matchday = 1
ORDER BY fixture_index;

