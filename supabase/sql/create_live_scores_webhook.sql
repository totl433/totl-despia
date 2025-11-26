-- Create webhook trigger for live_scores table
-- This trigger calls the Netlify function when live_scores is inserted or updated
-- 
-- NOTE: This uses pg_net extension. If pg_net is not available, you'll need to:
-- 1. Enable pg_net extension in Supabase dashboard (Database → Extensions)
-- 2. Or use Supabase Edge Functions instead
-- 3. Or configure webhooks through Supabase Dashboard → Database → Webhooks

-- First, try to enable pg_net extension (may require superuser privileges)
-- If this fails, enable it manually in Supabase Dashboard → Database → Extensions
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  -- Extension might not be available or requires manual enable
  RAISE NOTICE 'pg_net extension not available. Please enable it manually in Supabase Dashboard → Database → Extensions, or use alternative webhook method.';
END;
$$;

-- Create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.notify_live_scores_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := 'https://totl-staging.netlify.app/.netlify/functions/sendScoreNotificationsWebhook';
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
  -- Try the standard pg_net syntax
  BEGIN
    SELECT net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := payload::text
    ) INTO request_id;
  EXCEPTION WHEN OTHERS THEN
    -- If pg_net.http_post doesn't work, try alternative syntax
    -- Or log the error and continue (webhook will fail silently)
    RAISE WARNING 'Failed to call webhook: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires on INSERT or UPDATE
DROP TRIGGER IF EXISTS trg_notify_live_scores_webhook ON public.live_scores;
CREATE TRIGGER trg_notify_live_scores_webhook
  AFTER INSERT OR UPDATE ON public.live_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_live_scores_webhook();

-- Note: The webhook will be called asynchronously by pg_net
-- If pg_net is not available, you may need to use Supabase Edge Functions instead

