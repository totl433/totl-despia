-- Notification Send Log
-- Provides hard idempotency and audit trail for all notification sends
-- Migration: 20241216_notification_send_log.sql

-- Create enum-like type for send results (using text for flexibility)
-- Values: accepted, failed, suppressed_duplicate, suppressed_preference, 
--         suppressed_cooldown, suppressed_quiet_hours, suppressed_muted, suppressed_rollout

-- Create the notification_send_log table
CREATE TABLE IF NOT EXISTS public.notification_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Environment separation
  environment TEXT NOT NULL DEFAULT 'prod' CHECK (environment IN ('prod', 'dev', 'staging')),
  
  -- Notification identification
  notification_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  
  -- Targeting
  user_id UUID,
  external_id TEXT,
  
  -- OneSignal response
  onesignal_notification_id TEXT,
  
  -- Targeting method used
  target_type TEXT CHECK (target_type IN ('external_user_ids', 'player_ids', 'segment', 'filters')),
  
  -- Summary data (for debugging without storing full payloads)
  targeting_summary JSONB DEFAULT '{}'::jsonb,
  payload_summary JSONB DEFAULT '{}'::jsonb,
  
  -- Result
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN (
    'pending',
    'accepted',
    'failed',
    'suppressed_duplicate',
    'suppressed_preference',
    'suppressed_cooldown',
    'suppressed_quiet_hours',
    'suppressed_muted',
    'suppressed_rollout',
    'suppressed_unsubscribed'
  )),
  
  -- Error details (for failed sends)
  error JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL: Unique constraint for idempotency
-- This prevents duplicate notifications for the same (env, notification_key, event_id, user_id) combination
CREATE UNIQUE INDEX IF NOT EXISTS notification_send_log_idempotency_idx
  ON public.notification_send_log (environment, notification_key, event_id, user_id)
  WHERE user_id IS NOT NULL;

-- For non-user-targeted notifications (broadcasts)
CREATE UNIQUE INDEX IF NOT EXISTS notification_send_log_idempotency_global_idx
  ON public.notification_send_log (environment, notification_key, event_id)
  WHERE user_id IS NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS notification_send_log_user_id_idx 
  ON public.notification_send_log (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_send_log_notification_key_idx 
  ON public.notification_send_log (notification_key);

CREATE INDEX IF NOT EXISTS notification_send_log_created_at_idx 
  ON public.notification_send_log (created_at DESC);

CREATE INDEX IF NOT EXISTS notification_send_log_result_idx 
  ON public.notification_send_log (result);

-- Composite index for cooldown checks
CREATE INDEX IF NOT EXISTS notification_send_log_cooldown_idx
  ON public.notification_send_log (user_id, notification_key, created_at DESC)
  WHERE result = 'accepted';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_notification_send_log_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_send_log_updated_at ON public.notification_send_log;
CREATE TRIGGER trg_notification_send_log_updated_at
  BEFORE UPDATE ON public.notification_send_log
  FOR EACH ROW EXECUTE FUNCTION public.touch_notification_send_log_updated_at();

-- Enable RLS
ALTER TABLE public.notification_send_log ENABLE ROW LEVEL SECURITY;

-- DENY ALL for public (only service role can write)
-- No policies = deny all for non-service-role users
-- Service role bypasses RLS automatically

-- Helpful views for debugging

-- Recent sends by user
CREATE OR REPLACE VIEW public.notification_send_log_recent AS
SELECT 
  id,
  environment,
  notification_key,
  event_id,
  user_id,
  result,
  created_at
FROM public.notification_send_log
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Send stats by notification type (last 24h)
CREATE OR REPLACE VIEW public.notification_send_stats AS
SELECT 
  notification_key,
  environment,
  result,
  COUNT(*) as count,
  MAX(created_at) as last_sent
FROM public.notification_send_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY notification_key, environment, result
ORDER BY notification_key, result;

-- Grant select on views to authenticated users (for debugging in dashboard)
GRANT SELECT ON public.notification_send_log_recent TO authenticated;
GRANT SELECT ON public.notification_send_stats TO authenticated;

-- Comment on table
COMMENT ON TABLE public.notification_send_log IS 
  'Audit log for all notification send attempts. Provides hard idempotency via unique index on (environment, notification_key, event_id, user_id).';

COMMENT ON INDEX notification_send_log_idempotency_idx IS 
  'Ensures only one notification per (environment, notification_key, event_id, user_id) combination. INSERT will fail with unique violation if duplicate.';

