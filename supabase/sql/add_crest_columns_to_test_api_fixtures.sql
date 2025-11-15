-- Add crest URL columns to test_api_fixtures table
ALTER TABLE test_api_fixtures 
ADD COLUMN IF NOT EXISTS home_crest TEXT,
ADD COLUMN IF NOT EXISTS away_crest TEXT;

