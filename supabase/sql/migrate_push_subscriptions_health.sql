-- Migration: Add subscription health tracking columns to push_subscriptions
-- Run this in Supabase SQL Editor

-- Add new columns for subscription health tracking
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS subscribed boolean,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS invalid boolean,
  ADD COLUMN IF NOT EXISTS os_payload jsonb,
  ADD COLUMN IF NOT EXISTS device_fingerprint text;

-- Update existing rows: set subscribed = true for now (will be verified by server checks)
UPDATE public.push_subscriptions
SET subscribed = true
WHERE subscribed IS NULL;

-- Create index for device fingerprint (for multi-device support)
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_unique_device
  ON public.push_subscriptions (user_id, device_fingerprint)
  WHERE device_fingerprint IS NOT NULL;

-- Add index for subscribed status queries
CREATE INDEX IF NOT EXISTS push_subscriptions_subscribed_idx
  ON public.push_subscriptions (subscribed)
  WHERE subscribed = true AND is_active = true;

-- Add index for cleanup queries (stale devices)
CREATE INDEX IF NOT EXISTS push_subscriptions_last_active_idx
  ON public.push_subscriptions (last_active_at, is_active);

