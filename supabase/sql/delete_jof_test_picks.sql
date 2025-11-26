-- Delete Jof's test API picks and submission for matchday 1
-- This script ONLY deletes Jof's picks/submission for test GW, no other data is affected

-- Jof's user ID
DO $$
DECLARE
    jof_user_id UUID := '4542c037-5b38-40d0-b189-847b8f17c222';
    deleted_picks_count INTEGER;
    deleted_submissions_count INTEGER;
BEGIN
    -- Delete picks (explicitly cast matchday to ensure type match)
    DELETE FROM test_api_picks
    WHERE user_id = jof_user_id
      AND matchday::integer = 1;
    
    GET DIAGNOSTICS deleted_picks_count = ROW_COUNT;
    
    -- Delete submission (explicitly cast matchday to ensure type match)
    DELETE FROM test_api_submissions
    WHERE user_id = jof_user_id
      AND matchday::integer = 1;
    
    GET DIAGNOSTICS deleted_submissions_count = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % picks and % submission(s) for Jof (matchday 1)', deleted_picks_count, deleted_submissions_count;
END $$;

