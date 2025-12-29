-- ============================================
-- Remove Flatcher's Late GW18 Submission
-- ============================================
-- This script removes Flatcher's late submission and picks for GW18
-- Run this directly in Supabase SQL editor (bypasses RLS)

-- Flatcher's user ID
DO $$
DECLARE
  flatcher_user_id UUID := 'fb5a55b1-5039-4f41-82ae-0429ec78a544';
  gw_number INTEGER := 18;
  deleted_picks_count INTEGER;
  deleted_submissions_count INTEGER;
  picks_before_count INTEGER;
  submissions_before_count INTEGER;
BEGIN
  -- Safety check: Count records before deletion
  SELECT COUNT(*) INTO picks_before_count
  FROM app_picks
  WHERE user_id = flatcher_user_id AND gw = gw_number;
  
  SELECT COUNT(*) INTO submissions_before_count
  FROM app_gw_submissions
  WHERE user_id = flatcher_user_id AND gw = gw_number;
  
  RAISE NOTICE 'About to delete: % picks and % submission(s) for Flatcher (GW %)', 
    picks_before_count, submissions_before_count, gw_number;
  
  -- Delete picks from app_picks
  -- SAFETY: Only deletes where BOTH user_id = Flatcher AND gw = 18
  DELETE FROM app_picks
  WHERE user_id = flatcher_user_id AND gw = gw_number;
  GET DIAGNOSTICS deleted_picks_count = ROW_COUNT;
  
  -- Delete picks from picks (web table) if they exist
  -- SAFETY: Only deletes where BOTH user_id = Flatcher AND gw = 18
  DELETE FROM picks
  WHERE user_id = flatcher_user_id AND gw = gw_number;
  
  -- Delete submission from app_gw_submissions
  -- SAFETY: Only deletes where BOTH user_id = Flatcher AND gw = 18
  DELETE FROM app_gw_submissions
  WHERE user_id = flatcher_user_id AND gw = gw_number;
  GET DIAGNOSTICS deleted_submissions_count = ROW_COUNT;
  
  -- Delete submission from gw_submissions (web table) if it exists
  -- SAFETY: Only deletes where BOTH user_id = Flatcher AND gw = 18
  DELETE FROM gw_submissions
  WHERE user_id = flatcher_user_id AND gw = gw_number;
  
  RAISE NOTICE 'Deleted % picks and % submission(s) for Flatcher (GW %)', 
    deleted_picks_count, deleted_submissions_count, gw_number;
END $$;

-- Verify deletion
SELECT 
  'app_picks' as table_name,
  COUNT(*) as remaining_count
FROM app_picks
WHERE user_id = 'fb5a55b1-5039-4f41-82ae-0429ec78a544' AND gw = 18

UNION ALL

SELECT 
  'app_gw_submissions' as table_name,
  COUNT(*) as remaining_count
FROM app_gw_submissions
WHERE user_id = 'fb5a55b1-5039-4f41-82ae-0429ec78a544' AND gw = 18;

