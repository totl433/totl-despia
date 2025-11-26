-- Create table to track which score updates we've already notified about
-- This prevents duplicate notifications

CREATE TABLE IF NOT EXISTS public.notification_state (
  api_match_id integer PRIMARY KEY,
  last_notified_home_score integer NOT NULL DEFAULT 0,
  last_notified_away_score integer NOT NULL DEFAULT 0,
  last_notified_status text NOT NULL DEFAULT 'SCHEDULED',
  last_notified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS notification_state_api_match_id_idx ON public.notification_state (api_match_id);

-- Enable RLS (but only service role can write)
ALTER TABLE public.notification_state ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (for debugging)
DROP POLICY IF EXISTS "Anyone can read notification state" ON public.notification_state;
CREATE POLICY "Anyone can read notification state"
ON public.notification_state FOR SELECT
USING (true);

-- Only service role can insert/update (via Netlify function)
-- This is handled by using SUPABASE_SERVICE_ROLE_KEY in the function

