-- Retro Totl Daily — The Players
-- One row per player × Premier League club career (appearances aggregated).
-- Web game can also run from the local seed pack until this table is fully backfilled.

CREATE TABLE IF NOT EXISTS public.retro_player_club_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  player_key text NOT NULL,
  club_code text NOT NULL,
  club_name text NOT NULL,
  appearances integer NOT NULL CHECK (appearances >= 0),
  goals integer,
  first_season text,
  last_season text,
  source text NOT NULL DEFAULT 'seed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retro_player_club_apps_player_club_uniq UNIQUE (player_key, club_code)
);

CREATE INDEX IF NOT EXISTS retro_player_club_apps_apps_idx
  ON public.retro_player_club_apps (appearances DESC);

CREATE INDEX IF NOT EXISTS retro_player_club_apps_club_idx
  ON public.retro_player_club_apps (club_code);

CREATE INDEX IF NOT EXISTS retro_player_club_apps_player_idx
  ON public.retro_player_club_apps (player_key);

COMMENT ON TABLE public.retro_player_club_apps IS
  'Premier League career appearances by club for Retro Totl Daily — The Players';

ALTER TABLE public.retro_player_club_apps ENABLE ROW LEVEL SECURITY;

-- Public read for the daily game (no writes from clients).
DROP POLICY IF EXISTS "retro_player_club_apps_public_read" ON public.retro_player_club_apps;
CREATE POLICY "retro_player_club_apps_public_read"
  ON public.retro_player_club_apps
  FOR SELECT
  TO anon, authenticated
  USING (true);
