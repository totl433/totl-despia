-- Additive: reveal picks once all four have submitted, and expose submit-status without picks.
-- Safe to run on the existing Season Predictions tables.

BEGIN;

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

REVOKE ALL ON FUNCTION public.all_season_predictions_submitted(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.season_prediction_player_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.all_season_predictions_submitted(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.season_prediction_player_status(text) TO authenticated;

COMMENT ON TABLE public.season_prediction_picks IS 'Prem Predictions 2026/27 season side-game picks. Draft until submitted_at; hidden from others until all four have submitted, or the deadline.';

COMMIT;
