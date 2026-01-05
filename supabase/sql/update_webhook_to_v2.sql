-- Update webhook to use V2 dispatcher
-- This updates the pg_net-based trigger (if enabled)
-- If you're using Supabase Dashboard webhooks, update those manually (see instructions below)

-- Update the function to use V2 webhook URL
CREATE OR REPLACE FUNCTION public.notify_live_scores_webhook()
RETURNS TRIGGER AS $$
DECLARE
  -- V2 webhook URL - uses new dispatcher system with idempotency
  webhook_url TEXT := 'https://totl-staging.netlify.app/.netlify/functions/sendScoreNotificationsWebhookV2';
  payload JSONB;
  request_id BIGINT;
BEGIN
  -- Build the payload in the format expected by the webhook
  payload := jsonb_build_object(
    'type', TG_OP,  -- 'INSERT' or 'UPDATE'
    'table', 'live_scores',
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  -- Make HTTP request to Netlify function using pg_net
  -- Wrap in exception handler so trigger never blocks the INSERT/UPDATE
  BEGIN
    SELECT net.http_post(
      webhook_url::text,
      jsonb_build_object('Content-Type', 'application/json'),
      payload::text
    ) INTO request_id;
  EXCEPTION 
    WHEN undefined_function THEN
      -- pg_net might not be available - this is OK if using Dashboard webhooks
      NULL;
    WHEN OTHERS THEN
      -- Any other error - log but don't block
      NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: If you're using Supabase Dashboard webhooks (not pg_net triggers),
-- you need to update the webhook URL manually in the Dashboard:
-- 1. Go to Supabase Dashboard → Database → Webhooks
-- 2. Find "live_scores_notifications" webhook
-- 3. Edit URL to: https://totl-staging.netlify.app/.netlify/functions/sendScoreNotificationsWebhookV2
-- 4. Save










