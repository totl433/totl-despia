-- ============================================
-- JOF NOTIFICATION MONITORING QUERIES
-- User ID: 4542c037-5b38-40d0-b189-847b8f17c222
-- ============================================

-- 1. Check Jof's current push subscription status
SELECT 
  user_id,
  player_id,
  platform,
  is_active,
  subscribed,
  last_checked_at,
  last_active_at,
  invalid,
  created_at
FROM push_subscriptions
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222'
ORDER BY created_at DESC;

-- 2. Check Jof's notification preferences
SELECT 
  user_id,
  preferences,
  updated_at
FROM user_notification_preferences
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222';

-- 3. Recent notification send logs for Jof (last 24 hours)
SELECT 
  notification_key,
  event_id,
  result,
  error,
  target_type,
  targeting_summary,
  onesignal_notification_id,
  created_at
FROM notification_send_log
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- 4. Summary of notification results for Jof (last 24 hours)
SELECT 
  result,
  COUNT(*) as count,
  MAX(created_at) as last_occurrence
FROM notification_send_log
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY result
ORDER BY count DESC;

-- 5. Failed notifications for Jof with error details (last 24 hours)
SELECT 
  notification_key,
  event_id,
  result,
  error,
  created_at
FROM notification_send_log
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222'
  AND result IN ('failed', 'suppressed_unsubscribed')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 6. Check for duplicate/suppressed notifications (last 24 hours)
SELECT 
  notification_key,
  event_id,
  result,
  created_at
FROM notification_send_log
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222'
  AND result LIKE 'suppressed_%'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 7. All notifications sent to Jof in the last hour (for real-time monitoring)
SELECT 
  notification_key,
  event_id,
  result,
  error,
  targeting_summary,
  payload_summary,
  created_at
FROM notification_send_log
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

