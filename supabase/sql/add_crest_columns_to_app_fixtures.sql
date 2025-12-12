-- Add crest URL columns to app_fixtures table
ALTER TABLE app_fixtures 
ADD COLUMN IF NOT EXISTS home_crest TEXT,
ADD COLUMN IF NOT EXISTS away_crest TEXT;

