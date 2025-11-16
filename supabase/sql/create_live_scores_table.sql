-- Create table to store live scores from Football Data API
-- This table is updated by a scheduled Netlify function, not by clients

CREATE TABLE IF NOT EXISTS public.live_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_match_id integer NOT NULL UNIQUE,
  gw integer,
  fixture_index integer,
  home_score integer NOT NULL DEFAULT 0,
  away_score integer NOT NULL DEFAULT 0,
  status text NOT NULL, -- 'SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'CANCELLED', 'SUSPENDED', 'POSTPONED'
  minute integer,
  home_team text,
  away_team text,
  kickoff_time timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookups by api_match_id
CREATE INDEX IF NOT EXISTS live_scores_api_match_id_idx ON public.live_scores (api_match_id);

-- Index for looking up by gw and fixture_index
CREATE INDEX IF NOT EXISTS live_scores_gw_fixture_idx ON public.live_scores (gw, fixture_index);

-- Index for finding live games
CREATE INDEX IF NOT EXISTS live_scores_status_idx ON public.live_scores (status) WHERE status IN ('IN_PLAY', 'PAUSED');

-- Index for updated_at (to find recently updated scores)
CREATE INDEX IF NOT EXISTS live_scores_updated_at_idx ON public.live_scores (updated_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.touch_live_scores_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_live_scores_updated_at ON public.live_scores;
CREATE TRIGGER trg_touch_live_scores_updated_at
BEFORE UPDATE ON public.live_scores
FOR EACH ROW EXECUTE FUNCTION public.touch_live_scores_updated_at();

-- Enable RLS (but allow public read access)
ALTER TABLE public.live_scores ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read live scores (they're public data)
-- Drop policy if it exists first (IF NOT EXISTS not supported for CREATE POLICY)
DROP POLICY IF EXISTS "Anyone can read live scores" ON public.live_scores;
CREATE POLICY "Anyone can read live scores"
ON public.live_scores FOR SELECT
USING (true);

-- Only service role can insert/update (via Netlify function)
-- This is handled by using SUPABASE_SERVICE_ROLE_KEY in the function

