-- Migration: Add last_poll_time column to meta table for pollLiveScores lock mechanism
-- Run this in Supabase SQL Editor

ALTER TABLE public.meta
  ADD COLUMN IF NOT EXISTS last_poll_time timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.meta.last_poll_time IS 'Timestamp of last pollLiveScores function run, used to prevent overlapping executions';

