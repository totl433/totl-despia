-- Check if the live_scores webhook trigger is still active
-- Run this in Supabase SQL Editor to see if the trigger exists

SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_notify_live_scores_webhook'
  AND event_object_table = 'live_scores';

-- If the above query returns a row, the trigger is ACTIVE
-- If it returns no rows, the trigger has been removed

-- To remove the trigger, run:
-- DROP TRIGGER IF EXISTS trg_notify_live_scores_webhook ON public.live_scores;
-- DROP FUNCTION IF EXISTS public.notify_live_scores_webhook();

