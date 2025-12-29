-- ============================================================================
-- SAFE READ-ONLY CHECK: Find users with GW18 submissions in app but NOT in web
-- ============================================================================
-- This is a diagnostic query - NO WRITES, NO CHANGES
-- Run this first to see what we're dealing with before making any changes
-- ============================================================================

-- Step 1: Find all users who have GW18 submissions in app_gw_submissions
WITH app_users_gw18 AS (
  SELECT 
    ags.user_id,
    ags.gw,
    ags.submitted_at as app_submitted_at,
    u.name as user_name,
    u.email as user_email
  FROM app_gw_submissions ags
  LEFT JOIN users u ON u.id = ags.user_id
  WHERE ags.gw = 18
),
-- Step 2: Check which ones are missing in web
web_users_gw18 AS (
  SELECT 
    gs.user_id,
    gs.gw,
    gs.submitted_at as web_submitted_at
  FROM gw_submissions gs
  WHERE gs.gw = 18
)
-- Step 3: Show comparison
SELECT 
  app.user_id,
  app.user_name,
  app.user_email,
  app.app_submitted_at,
  web.web_submitted_at,
  CASE 
    WHEN web.user_id IS NULL THEN '❌ MISSING IN WEB'
    WHEN app.app_submitted_at != web.web_submitted_at THEN '⚠️ DIFFERENT TIMESTAMP'
    ELSE '✅ EXISTS IN WEB'
  END as status,
  -- Count picks in app for this user/GW
  (SELECT COUNT(*) 
   FROM app_picks ap 
   WHERE ap.user_id = app.user_id AND ap.gw = 18) as app_pick_count,
  -- Count picks in web for this user/GW
  (SELECT COUNT(*) 
   FROM picks p 
   WHERE p.user_id = app.user_id AND p.gw = 18) as web_pick_count
FROM app_users_gw18 app
LEFT JOIN web_users_gw18 web ON web.user_id = app.user_id
ORDER BY 
  CASE 
    WHEN web.user_id IS NULL THEN 1  -- Missing in web first
    WHEN app.app_submitted_at != web.web_submitted_at THEN 2  -- Different timestamp second
    ELSE 3  -- Already synced last
  END,
  app.user_name;

-- ============================================================================
-- Summary counts
-- ============================================================================
SELECT 
  'Summary' as report_type,
  COUNT(*) FILTER (WHERE ags.user_id IS NOT NULL) as total_app_submissions_gw18,
  COUNT(*) FILTER (WHERE gs.user_id IS NOT NULL) as total_web_submissions_gw18,
  COUNT(*) FILTER (WHERE ags.user_id IS NOT NULL AND gs.user_id IS NULL) as missing_in_web_count,
  COUNT(*) FILTER (WHERE ags.user_id IS NOT NULL AND gs.user_id IS NOT NULL 
                    AND ags.submitted_at != gs.submitted_at) as different_timestamp_count
FROM app_gw_submissions ags
FULL OUTER JOIN gw_submissions gs 
  ON gs.user_id = ags.user_id AND gs.gw = ags.gw
WHERE (ags.gw = 18 OR gs.gw = 18);

-- ============================================================================
-- Detailed breakdown: Show pick counts per user for GW18
-- ============================================================================
SELECT 
  u.id as user_id,
  u.name as user_name,
  COALESCE(app_picks.count, 0) as app_picks_count,
  COALESCE(web_picks.count, 0) as web_picks_count,
  CASE 
    WHEN app_picks.count IS NULL AND web_picks.count IS NULL THEN 'No picks'
    WHEN app_picks.count IS NOT NULL AND web_picks.count IS NULL THEN '❌ Only in app'
    WHEN app_picks.count IS NULL AND web_picks.count IS NOT NULL THEN 'Only in web'
    WHEN app_picks.count != web_picks.count THEN '⚠️ Count mismatch'
    ELSE '✅ Same count'
  END as pick_status
FROM users u
LEFT JOIN (
  SELECT user_id, COUNT(*) as count
  FROM app_picks
  WHERE gw = 18
  GROUP BY user_id
) app_picks ON app_picks.user_id = u.id
LEFT JOIN (
  SELECT user_id, COUNT(*) as count
  FROM picks
  WHERE gw = 18
  GROUP BY user_id
) web_picks ON web_picks.user_id = u.id
WHERE app_picks.count IS NOT NULL OR web_picks.count IS NOT NULL
ORDER BY 
  CASE 
    WHEN app_picks.count IS NOT NULL AND web_picks.count IS NULL THEN 1
    WHEN app_picks.count != web_picks.count THEN 2
    ELSE 3
  END,
  u.name;





