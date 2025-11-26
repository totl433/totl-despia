-- Create webhook trigger for live_scores table
-- This trigger calls the Netlify function when live_scores is inserted or updated

-- First, ensure pg_net extension is enabled (for making HTTP requests from triggers)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.notify_live_scores_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := 'https://totl-staging.netlify.app/.netlify/functions/sendScoreNotificationsWebhook';
  payload JSONB;
BEGIN
  -- Build the payload in the format expected by the webhook
  payload := jsonb_build_object(
    'type', TG_OP,  -- 'INSERT' or 'UPDATE'
    'table', 'live_scores',
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  -- Make HTTP request to Netlify function
  -- Use pg_net.http_post to send the webhook
  PERFORM net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := payload::text
  );

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

