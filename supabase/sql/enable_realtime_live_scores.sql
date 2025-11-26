-- Enable real-time replication for live_scores table
-- This allows Supabase real-time subscriptions to work

-- Enable replication for the live_scores table
ALTER PUBLICATION supabase_realtime ADD TABLE live_scores;

-- Verify it's enabled (this will show the table in the replication list)
-- You can check in Supabase Dashboard → Database → Replication

