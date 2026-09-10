-- ============================================
-- Prediction card season stats on app_team_forms
-- ============================================
-- Captured from Football Data standings when a GW is published.
-- Used by Make Your Predictions Test flip cards.

ALTER TABLE app_team_forms
  ADD COLUMN IF NOT EXISTS played INTEGER,
  ADD COLUMN IF NOT EXISTS won INTEGER,
  ADD COLUMN IF NOT EXISTS drawn INTEGER,
  ADD COLUMN IF NOT EXISTS lost INTEGER,
  ADD COLUMN IF NOT EXISTS goals_for INTEGER,
  ADD COLUMN IF NOT EXISTS goals_against INTEGER;

COMMENT ON COLUMN app_team_forms.played IS 'PL matches played this season at GW publish snapshot';
COMMENT ON COLUMN app_team_forms.won IS 'PL wins this season at GW publish snapshot';
COMMENT ON COLUMN app_team_forms.drawn IS 'PL draws this season at GW publish snapshot';
COMMENT ON COLUMN app_team_forms.lost IS 'PL losses this season at GW publish snapshot';
COMMENT ON COLUMN app_team_forms.goals_for IS 'PL goals for this season at GW publish snapshot';
COMMENT ON COLUMN app_team_forms.goals_against IS 'PL goals against this season at GW publish snapshot';
