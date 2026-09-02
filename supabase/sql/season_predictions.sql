-- Season Predictions side game for the four Prem Predictions players.
-- Apply in the Supabase SQL editor. Does not auto-run from the repo.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_season_predictions_player(p_uid uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_uid IN (
    '4542c037-5b38-40d0-b189-847b8f17c222'::uuid,
    '9c0bcf50-370d-412d-8826-95371a72b4fe'::uuid,
    '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid,
    'f8a1669e-2512-4edf-9c21-b9f87b3efbe2'::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_season_predictions_results_editor(p_uid uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_uid = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid;
$$;

-- 10pm UK on 2 Sep 2026 (BST = UTC+1)
CREATE OR REPLACE FUNCTION public.season_predictions_deadline()
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT timestamptz '2026-09-02 21:00:00+00';
$$;

CREATE OR REPLACE FUNCTION public.all_season_predictions_submitted(p_season_key text DEFAULT '2026-27')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(*)
    FROM public.season_prediction_picks
    WHERE season_key = p_season_key
      AND submitted_at IS NOT NULL
      AND user_id IN (
        '4542c037-5b38-40d0-b189-847b8f17c222'::uuid,
        '9c0bcf50-370d-412d-8826-95371a72b4fe'::uuid,
        '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid,
        'f8a1669e-2512-4edf-9c21-b9f87b3efbe2'::uuid
      )
  ) = 4;
$$;

CREATE OR REPLACE FUNCTION public.season_prediction_player_status(p_season_key text DEFAULT '2026-27')
RETURNS TABLE (user_id uuid, submitted boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_season_predictions_player(auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT player.id AS user_id, EXISTS (
    SELECT 1
    FROM public.season_prediction_picks picks
    WHERE picks.season_key = p_season_key
      AND picks.user_id = player.id
      AND picks.submitted_at IS NOT NULL
  ) AS submitted
  FROM (
    SELECT unnest(ARRAY[
      '4542c037-5b38-40d0-b189-847b8f17c222'::uuid,
      '9c0bcf50-370d-412d-8826-95371a72b4fe'::uuid,
      '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid,
      'f8a1669e-2512-4edf-9c21-b9f87b3efbe2'::uuid
    ]) AS id
  ) player;
END;
$$;

CREATE TABLE IF NOT EXISTS public.season_prediction_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_key text NOT NULL DEFAULT '2026-27',
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pos_1 text,
  pos_2 text,
  pos_3 text,
  pos_4 text,
  pos_5 text,
  pos_6 text,
  pos_18 text,
  pos_19 text,
  pos_20 text,
  haaland_goals integer,
  first_manager_id text,
  highest_scorer text,
  most_assists text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_key, user_id)
);

CREATE TABLE IF NOT EXISTS public.season_prediction_results (
  season_key text PRIMARY KEY,
  pos_1 text,
  pos_2 text,
  pos_3 text,
  pos_4 text,
  pos_5 text,
  pos_6 text,
  pos_18 text,
  pos_19 text,
  pos_20 text,
  haaland_goals integer,
  first_manager_id text,
  highest_scorer text,
  most_assists text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE OR REPLACE FUNCTION public.touch_season_prediction_picks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_season_prediction_picks ON public.season_prediction_picks;
CREATE TRIGGER trg_touch_season_prediction_picks
BEFORE UPDATE ON public.season_prediction_picks
FOR EACH ROW EXECUTE FUNCTION public.touch_season_prediction_picks();

CREATE OR REPLACE FUNCTION public.guard_season_prediction_picks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Season predictions are locked after submit';
  END IF;

  IF now() >= public.season_predictions_deadline() THEN
    RAISE EXCEPTION 'Season predictions deadline has passed';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change season prediction owner';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_season_prediction_picks ON public.season_prediction_picks;
CREATE TRIGGER trg_guard_season_prediction_picks
BEFORE INSERT OR UPDATE ON public.season_prediction_picks
FOR EACH ROW EXECUTE FUNCTION public.guard_season_prediction_picks();

ALTER TABLE public.season_prediction_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_prediction_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS season_prediction_picks_select ON public.season_prediction_picks;
CREATE POLICY season_prediction_picks_select ON public.season_prediction_picks
  FOR SELECT
  USING (
    public.is_season_predictions_player(auth.uid())
    AND (
      user_id = auth.uid()
      OR (
        submitted_at IS NOT NULL
        AND (
          now() >= public.season_predictions_deadline()
          OR public.all_season_predictions_submitted(season_key)
        )
      )
    )
  );

DROP POLICY IF EXISTS season_prediction_picks_insert ON public.season_prediction_picks;
CREATE POLICY season_prediction_picks_insert ON public.season_prediction_picks
  FOR INSERT
  WITH CHECK (
    public.is_season_predictions_player(auth.uid())
    AND user_id = auth.uid()
    AND now() < public.season_predictions_deadline()
  );

DROP POLICY IF EXISTS season_prediction_picks_update ON public.season_prediction_picks;
CREATE POLICY season_prediction_picks_update ON public.season_prediction_picks
  FOR UPDATE
  USING (
    public.is_season_predictions_player(auth.uid())
    AND user_id = auth.uid()
    AND submitted_at IS NULL
    AND now() < public.season_predictions_deadline()
  )
  WITH CHECK (
    public.is_season_predictions_player(auth.uid())
    AND user_id = auth.uid()
    AND now() < public.season_predictions_deadline()
  );

DROP POLICY IF EXISTS season_prediction_results_select ON public.season_prediction_results;
CREATE POLICY season_prediction_results_select ON public.season_prediction_results
  FOR SELECT
  USING (public.is_season_predictions_player(auth.uid()));

DROP POLICY IF EXISTS season_prediction_results_upsert ON public.season_prediction_results;
CREATE POLICY season_prediction_results_insert ON public.season_prediction_results
  FOR INSERT
  WITH CHECK (public.is_season_predictions_results_editor(auth.uid()));

DROP POLICY IF EXISTS season_prediction_results_update ON public.season_prediction_results;
CREATE POLICY season_prediction_results_update ON public.season_prediction_results
  FOR UPDATE
  USING (public.is_season_predictions_results_editor(auth.uid()))
  WITH CHECK (public.is_season_predictions_results_editor(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.season_prediction_picks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.season_prediction_results TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_season_predictions_player(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_season_predictions_results_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.season_predictions_deadline() TO authenticated;
REVOKE ALL ON FUNCTION public.all_season_predictions_submitted(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.season_prediction_player_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.all_season_predictions_submitted(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.season_prediction_player_status(text) TO authenticated;

COMMENT ON TABLE public.season_prediction_picks IS 'Prem Predictions 2026/27 season side-game picks. Draft until submitted_at; hidden from others until all four have submitted, or the deadline.';
COMMENT ON TABLE public.season_prediction_results IS 'Official Season Predictions results. Editable by Jof only.';

COMMIT;
