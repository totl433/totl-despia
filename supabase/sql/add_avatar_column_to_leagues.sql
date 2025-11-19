-- Add avatar column to leagues table
-- This column stores the URL to the custom avatar image uploaded by league admins

ALTER TABLE public.leagues 
ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN public.leagues.avatar IS 'URL to custom avatar image. Can be a Supabase Storage URL or a default avatar filename (ML-avatar-1.png through ML-avatar-5.png).';

