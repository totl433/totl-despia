-- Add current_viewing_gw column to user_notification_preferences table
-- This tracks which gameweek the user is currently viewing (for GW transition banner)

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS current_viewing_gw integer;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS user_notification_preferences_viewing_gw_idx 
  ON public.user_notification_preferences(current_viewing_gw);

-- Note: current_viewing_gw will be null initially for all users
-- It will be set when a user clicks the "GW ready" banner to transition to a new GW













