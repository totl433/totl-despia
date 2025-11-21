-- ============================================
-- DELETE SP'S TEST API PICKS AND SUBMISSION
-- ============================================
-- This SQL will ONLY affect Test API data (test_api_picks and test_api_submissions)
-- It will NEVER touch main game data (picks or gw_submissions tables)
--
-- SP's User ID: 9c0bcf50-370d-412d-8826-95371a72b4fe
-- Matchday: 1 (Test API only - main game uses 'gw' column)
-- ============================================

-- STEP 1: Check what will be deleted (run these first to verify)
-- ============================================
-- Check picks that will be deleted:
SELECT * FROM test_api_picks 
WHERE user_id = '9c0bcf50-370d-412d-8826-95371a72b4fe' 
  AND matchday = 1
ORDER BY fixture_index;

-- Check submission that will be deleted:
SELECT * FROM test_api_submissions 
WHERE user_id = '9c0bcf50-370d-412d-8826-95371a72b4fe' 
  AND matchday = 1;

-- ============================================
-- STEP 2: Delete the data (only run after verifying above)
-- ============================================

-- Delete SP's test API picks for matchday 1
DELETE FROM test_api_picks 
WHERE user_id = '9c0bcf50-370d-412d-8826-95371a72b4fe' 
  AND matchday = 1;

-- Delete SP's test API submission for matchday 1
DELETE FROM test_api_submissions 
WHERE user_id = '9c0bcf50-370d-412d-8826-95371a72b4fe' 
  AND matchday = 1;

-- ============================================
-- STEP 3: Verify deletion (run after DELETE)
-- ============================================
-- Verify picks are deleted (should return 0 rows):
SELECT COUNT(*) as remaining_picks FROM test_api_picks 
WHERE user_id = '9c0bcf50-370d-412d-8826-95371a72b4fe' 
  AND matchday = 1;

-- Verify submission is deleted (should return 0 rows):
SELECT COUNT(*) as remaining_submissions FROM test_api_submissions 
WHERE user_id = '9c0bcf50-370d-412d-8826-95371a72b4fe' 
  AND matchday = 1;

-- ============================================
-- SAFETY CONFIRMATION:
-- - ONLY touches test_api_picks table (NOT picks table)
-- - ONLY touches test_api_submissions table (NOT gw_submissions table)
-- - ONLY affects user_id = 9c0bcf50-370d-412d-8826-95371a72b4fe (SP)
-- - ONLY affects matchday = 1 (Test API uses matchday, main game uses gw)
-- ============================================

