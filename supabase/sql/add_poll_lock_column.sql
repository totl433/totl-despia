-- Migration: Add last_poll_time column to the meta tables used by pollLiveScores
-- Run this in Supabase SQL Editor

ALTER TABLE public.meta
  ADD COLUMN IF NOT EXISTS last_poll_time timestamptz;

ALTER TABLE public.app_meta
  ADD COLUMN IF NOT EXISTS last_poll_time timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.meta.last_poll_time IS 'Timestamp of last pollLiveScores function run, used to prevent overlapping executions';
COMMENT ON COLUMN public.app_meta.last_poll_time IS 'Timestamp of last pollLiveScores function run, used to prevent overlapping executions';

