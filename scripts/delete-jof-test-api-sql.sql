-- ============================================
-- DELETE JOF'S TEST API PICKS AND SUBMISSION
-- ============================================
-- This SQL will ONLY affect Test API data (test_api_picks and test_api_submissions)
-- It will NEVER touch main game data (picks or gw_submissions tables)
--
-- Jof's User ID: 4542c037-5b38-40d0-b189-847b8f17c222
-- Matchday: 1 (Test API only - main game uses 'gw' column)
-- ============================================

-- STEP 1: Check what will be deleted (run these first to verify)
-- ============================================
-- Check picks that will be deleted:
SELECT * FROM test_api_picks 
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222' 
  AND matchday = 1
ORDER BY fixture_index;

-- Check submission that will be deleted:
SELECT * FROM test_api_submissions 
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222' 
  AND matchday = 1;

-- ============================================
-- STEP 2: Delete the data (only run after verifying above)
-- ============================================

-- Delete Jof's test API picks for matchday 1
DELETE FROM test_api_picks 
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222' 
  AND matchday = 1;

-- Delete Jof's test API submission for matchday 1
DELETE FROM test_api_submissions 
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222' 
  AND matchday = 1;

-- ============================================
-- STEP 3: Verify deletion (run after DELETE)
-- ============================================
-- Verify picks are deleted (should return 0 rows):
SELECT COUNT(*) as remaining_picks FROM test_api_picks 
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222' 
  AND matchday = 1;

-- Verify submission is deleted (should return 0 rows):
SELECT COUNT(*) as remaining_submissions FROM test_api_submissions 
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222' 
  AND matchday = 1;

-- ============================================
-- SAFETY CONFIRMATION:
-- - ONLY touches test_api_picks table (NOT picks table)
-- - ONLY touches test_api_submissions table (NOT gw_submissions table)
-- - ONLY affects user_id = 4542c037-5b38-40d0-b189-847b8f17c222 (Jof)
-- - ONLY affects matchday = 1 (Test API uses matchday, main game uses gw)
-- ============================================

