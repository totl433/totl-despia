-- Diagnostic query to check notification setup
-- Run this in Supabase SQL Editor after exchanging messages

-- 1. Check if devices are registered
SELECT 
  'Device Registration' as check_type,
  user_id,
  player_id,
  platform,
  is_active,
  created_at
FROM public.push_subscriptions
WHERE user_id IN (
  SELECT user_id FROM public.league_members 
  WHERE league_id = 'c5602a5b-4cf1-45f1-b6dc-db0670db577a'
)
ORDER BY created_at DESC;

-- 2. Check league members
SELECT 
  'League Members' as check_type,
  user_id,
  league_id
FROM public.league_members
WHERE league_id = 'c5602a5b-4cf1-45f1-b6dc-db0670db577a';

-- 3. Check recent messages (to verify messages are being sent)
SELECT 
  'Recent Messages' as check_type,
  id,
  league_id,
  user_id,
  content,
  created_at
FROM public.league_messages
WHERE league_id = 'c5602a5b-4cf1-45f1-b6dc-db0670db577a'
ORDER BY created_at DESC
LIMIT 10;

