-- Register devices directly in Supabase
-- Run this in Supabase SQL Editor

INSERT INTO public.push_subscriptions (user_id, player_id, platform, is_active)
VALUES 
  ('4542c037-5b38-40d0-b189-847b8f17c222', '8e576d7a-76dc-4cb2-9c35-c74f6760ec39', 'ios', true),
  ('9c0bcf50-370d-412d-8826-95371a72b4fe', '90552486-8c1e-4dda-8de8-3521c7f08aa6', 'ios', true),
  ('36f31625-6d6c-4aa4-815a-1493a812841b', '33762d5d-bc28-4326-8333-807f57ddffd3', 'ios', true)
ON CONFLICT (user_id, player_id) 
DO UPDATE SET 
  is_active = true,
  updated_at = NOW();

