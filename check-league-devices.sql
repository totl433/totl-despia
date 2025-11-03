-- Get all Player IDs for league members and check their OneSignal subscription status
-- This helps identify which devices are "registered" vs "subscribed"

-- Step 1: Get Player IDs for league members
SELECT 
  lm.user_id,
  u.name,
  ps.player_id,
  ps.is_active,
  ps.created_at as registered_at
FROM public.league_members lm
JOIN public.users u ON u.id = lm.user_id
LEFT JOIN public.push_subscriptions ps ON ps.user_id = lm.user_id AND ps.is_active = true
WHERE lm.league_id = 'c5602a5b-4cf1-45f1-b6dc-db0670db577a'  -- Replace with your league_id
ORDER BY u.name;

-- This shows:
-- ✅ "registered" = Player ID exists in your database (registered_at column has a date)
-- ❓ "subscribed" = Need to check OneSignal dashboard or use checkOneSignalDevices endpoint
--
-- To check subscription status in OneSignal:
-- 1. Copy the player_id values from this query
-- 2. Go to OneSignal Dashboard → Audience → Subscriptions
-- 3. Search for each Subscription ID (should match player_id)
-- 4. Check Status column: "Subscribed" (green) = good, "Never Subscribed" (grey) = problem
--
-- Or use the diagnostic endpoint:
-- curl "https://totl-staging.netlify.app/.netlify/functions/checkOneSignalDevices?playerIds=PLAYER_ID_1,PLAYER_ID_2,PLAYER_ID_3"

