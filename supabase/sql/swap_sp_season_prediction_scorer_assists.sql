-- Swap SP's highest_scorer and most_assists (Cole Palmer ↔ Pedro).
-- Safe to run in Supabase SQL editor before the Season Predictions deadline.

DO $$
DECLARE
  sp_user_id uuid := '9c0bcf50-370d-412d-8826-95371a72b4fe';
  season text := '2026-27';
  orig_submitted timestamptz;
  old_scorer text;
  old_assists text;
BEGIN
  SELECT submitted_at, highest_scorer, most_assists
  INTO orig_submitted, old_scorer, old_assists
  FROM public.season_prediction_picks
  WHERE season_key = season AND user_id = sp_user_id;

  IF orig_submitted IS NULL AND old_scorer IS NULL AND old_assists IS NULL THEN
    RAISE EXCEPTION 'No season_prediction_picks row found for SP';
  END IF;

  UPDATE public.season_prediction_picks
  SET submitted_at = NULL
  WHERE season_key = season AND user_id = sp_user_id;

  UPDATE public.season_prediction_picks
  SET
    highest_scorer = old_assists,
    most_assists = old_scorer,
    submitted_at = orig_submitted
  WHERE season_key = season AND user_id = sp_user_id;

  RAISE NOTICE 'Swapped SP picks: highest_scorer % -> %, most_assists % -> %',
    old_scorer, old_assists, old_assists, old_scorer;
END $$;
