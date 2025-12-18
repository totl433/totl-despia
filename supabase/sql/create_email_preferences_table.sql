-- ============================================
-- Create email_preferences table
-- ============================================
-- Stores user email notification preferences
-- One row per user with three boolean preferences

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_gameweek BOOLEAN NOT NULL DEFAULT false,
  results_published BOOLEAN NOT NULL DEFAULT false,
  news_updates BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id ON public.email_preferences(user_id);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at_email_preferences()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_email_preferences ON public.email_preferences;
CREATE TRIGGER trg_touch_updated_at_email_preferences
BEFORE UPDATE ON public.email_preferences
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_email_preferences();

-- Enable Row Level Security
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can read their own email preferences" ON public.email_preferences;
DROP POLICY IF EXISTS "Users can insert their own email preferences" ON public.email_preferences;
DROP POLICY IF EXISTS "Users can update their own email preferences" ON public.email_preferences;

-- RLS Policies: Users can only manage their own preferences
CREATE POLICY "Users can read their own email preferences" ON public.email_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email preferences" ON public.email_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email preferences" ON public.email_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Comments for Documentation
COMMENT ON TABLE public.email_preferences IS 'User email notification preferences (New Gameweek Published, Results Published, TOTL News & Updates)';
COMMENT ON COLUMN public.email_preferences.new_gameweek IS 'Email when new gameweek fixtures are published';
COMMENT ON COLUMN public.email_preferences.results_published IS 'Email when results and league tables are updated';
COMMENT ON COLUMN public.email_preferences.news_updates IS 'Occasional emails about new features and announcements';

