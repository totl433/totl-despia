-- Fix Leeds v Villa score to 1-2
-- API match ID: 537901
-- Run this in Supabase SQL Editor

UPDATE live_scores
SET 
  home_score = 1,
  away_score = 2,
  updated_at = NOW()
WHERE api_match_id = 537901;

-- Verify the update
SELECT 
  api_match_id,
  home_team,
  away_team,
  home_score,
  away_score,
  status,
  updated_at
FROM live_scores
WHERE api_match_id = 537901;

