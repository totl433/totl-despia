-- Add goals and red_cards columns to live_scores table
-- These will store JSONB arrays with goal and red card information

ALTER TABLE live_scores
ADD COLUMN IF NOT EXISTS goals JSONB,
ADD COLUMN IF NOT EXISTS red_cards JSONB;

-- Add comment to explain the structure
COMMENT ON COLUMN live_scores.goals IS 'JSONB array of goals: [{minute, scorer, scorerId, team, teamId}]';
COMMENT ON COLUMN live_scores.red_cards IS 'JSONB array of red cards: [{minute, player, playerId, team, teamId}]';


