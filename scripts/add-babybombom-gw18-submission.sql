-- SQL script to add BoobyBomBom's GW18 submission record
-- Run this directly in Supabase SQL Editor to bypass RLS
-- SAFETY: Only affects BoobyBomBom's GW18 submission status

-- User ID: b14cd9cb-674c-4976-be20-17d4f8d954ee
-- This will mark BoobyBomBom as having submitted for GW18

-- Insert submission record into app_gw_submissions
INSERT INTO app_gw_submissions (user_id, gw, submitted_at)
VALUES ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, NOW())
ON CONFLICT (user_id, gw) 
DO UPDATE SET submitted_at = EXCLUDED.submitted_at;

-- Insert submission record into gw_submissions
INSERT INTO gw_submissions (user_id, gw, submitted_at)
VALUES ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, NOW())
ON CONFLICT (user_id, gw) 
DO UPDATE SET submitted_at = EXCLUDED.submitted_at;

-- Verify the submissions were inserted
SELECT 
  'app_gw_submissions' as table_name,
  submitted_at,
  'submitted' as status
FROM app_gw_submissions
WHERE user_id = 'b14cd9cb-674c-4976-be20-17d4f8d954ee' 
  AND gw = 18
UNION ALL
SELECT 
  'gw_submissions' as table_name,
  submitted_at,
  'submitted' as status
FROM gw_submissions
WHERE user_id = 'b14cd9cb-674c-4976-be20-17d4f8d954ee' 
  AND gw = 18;




