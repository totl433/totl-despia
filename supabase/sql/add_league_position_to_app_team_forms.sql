-- ============================================
-- Add league_position to app_team_forms
-- ============================================

ALTER TABLE app_team_forms
ADD COLUMN IF NOT EXISTS league_position INTEGER;

COMMENT ON COLUMN app_team_forms.league_position IS
'Premier League table position (1-20) captured alongside form for this GW snapshot';

