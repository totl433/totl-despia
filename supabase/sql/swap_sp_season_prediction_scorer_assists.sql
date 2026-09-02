-- Swap SP's highest_scorer and most_assists (Cole Palmer ↔ Pedro).
-- Uses delete + insert because submitted rows are locked by an UPDATE trigger.
-- Safe to run in Supabase SQL editor before the Season Predictions deadline.

DO $$
DECLARE
  sp_user_id uuid := '9c0bcf50-370d-412d-8826-95371a72b4fe';
  season text := '2026-27';
  old_row public.season_prediction_picks%ROWTYPE;
BEGIN
  SELECT * INTO old_row
  FROM public.season_prediction_picks
  WHERE season_key = season AND user_id = sp_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No season_prediction_picks row found for SP';
  END IF;

  DELETE FROM public.season_prediction_picks
  WHERE season_key = season AND user_id = sp_user_id;

  INSERT INTO public.season_prediction_picks (
    season_key,
    user_id,
    pos_1, pos_2, pos_3, pos_4, pos_5, pos_6,
    pos_18, pos_19, pos_20,
    haaland_goals,
    first_manager_id,
    highest_scorer,
    most_assists,
    submitted_at
  ) VALUES (
    old_row.season_key,
    old_row.user_id,
    old_row.pos_1, old_row.pos_2, old_row.pos_3, old_row.pos_4, old_row.pos_5, old_row.pos_6,
    old_row.pos_18, old_row.pos_19, old_row.pos_20,
    old_row.haaland_goals,
    old_row.first_manager_id,
    old_row.most_assists,
    old_row.highest_scorer,
    old_row.submitted_at
  );

  RAISE NOTICE 'Swapped SP picks: highest_scorer % -> %, most_assists % -> %',
    old_row.highest_scorer, old_row.most_assists, old_row.most_assists, old_row.highest_scorer;
END $$;
