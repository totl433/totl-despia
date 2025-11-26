-- Remove webhook trigger for live_scores table
-- This will allow pollLiveScores to update live_scores without errors

-- Drop the trigger
DROP TRIGGER IF EXISTS trg_notify_live_scores_webhook ON public.live_scores;

-- Drop the function
DROP FUNCTION IF EXISTS public.notify_live_scores_webhook();

