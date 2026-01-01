-- Reset current_viewing_gw to test the "GW ready" banner again
-- This sets your viewing GW back to the previous GW (18) so the banner will reappear

-- Replace 'YOUR_USER_ID' with your actual user ID (or use the query below to find it)
-- To find your user ID, run: SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Option 1: Reset for a specific user by user_id
UPDATE user_notification_preferences
SET current_viewing_gw = 18,
    updated_at = NOW()
WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid; -- Jof's user ID

-- Option 2: Reset for a specific user by email (if you know the email)
-- UPDATE user_notification_preferences
-- SET current_viewing_gw = 18,
--     updated_at = NOW()
-- WHERE user_id = (
--   SELECT id FROM auth.users WHERE email = 'your-email@example.com'
-- );

-- Option 3: Reset to previous GW automatically (sets to current_gw - 1)
-- UPDATE user_notification_preferences
-- SET current_viewing_gw = (
--   SELECT current_gw - 1 FROM app_meta WHERE id = 1
-- ),
-- updated_at = NOW()
-- WHERE user_id = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid;

-- Verify the change
SELECT 
  unp.user_id,
  au.email,
  unp.current_viewing_gw,
  am.current_gw as published_gw
FROM user_notification_preferences unp
LEFT JOIN auth.users au ON au.id = unp.user_id
CROSS JOIN app_meta am
WHERE unp.user_id = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid;


