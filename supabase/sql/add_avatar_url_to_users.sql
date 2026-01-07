-- Add avatar_url column to users table
-- This column stores the URL to the user's avatar image (Supabase Storage path)

-- Note: The users table already exists with id and name columns
-- We just need to add the avatar_url column and updated_at if they don't exist

-- Add avatar_url column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add updated_at column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS users_avatar_url_idx ON public.users(avatar_url) WHERE avatar_url IS NOT NULL;

-- Add trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_users_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_users_updated_at ON public.users;
CREATE TRIGGER trg_touch_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.touch_users_updated_at();

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all user avatars (public)
DROP POLICY IF EXISTS "Anyone can read user avatars" ON public.users;
CREATE POLICY "Anyone can read user avatars"
ON public.users
FOR SELECT
USING (true);

-- Policy: Users can update their own avatar
DROP POLICY IF EXISTS "Users can update own avatar" ON public.users;
CREATE POLICY "Users can update own avatar"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy: System can insert user records (for new signups)
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
CREATE POLICY "Users can insert own record"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Add comment
COMMENT ON COLUMN public.users.avatar_url IS 'URL to user avatar image stored in Supabase Storage (user-avatars bucket). Format: https://{project}.supabase.co/storage/v1/object/public/user-avatars/{userId}.{ext}';

