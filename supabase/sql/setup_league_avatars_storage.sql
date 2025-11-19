-- ============================================
-- Setup League Avatars Storage Bucket
-- ============================================
-- This script creates the storage bucket and RLS policies for league avatars
-- Run this in Supabase SQL Editor

-- Step 1: Create the storage bucket (if it doesn't exist)
-- Note: Bucket creation via SQL requires superuser privileges
-- If you don't have superuser access, create the bucket via Supabase Dashboard:
--   1. Go to Storage in Supabase Dashboard
--   2. Click "New bucket"
--   3. Name: league-avatars
--   4. Public bucket: Yes (checked)
--   5. File size limit: 100KB (since we compress to ~60KB, but allow buffer)
--   6. Allowed MIME types: image/png,image/jpeg,image/jpg,image/webp

-- If you have superuser access, you can create it via SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'league-avatars',
  'league-avatars',
  true, -- Public bucket
  102400, -- 100KB limit (we compress to ~60KB, but allow buffer for complex images)
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Step 2: Create Storage Policies
-- ============================================
-- Storage policies use a different syntax than table RLS policies

-- Policy 1: Allow all authenticated users to read (SELECT) avatars
-- This allows anyone to view league avatars
DROP POLICY IF EXISTS "Public read access for league avatars" ON storage.objects;
CREATE POLICY "Public read access for league avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'league-avatars');

-- Policy 2: Allow admins to upload (INSERT) avatars
-- Only league admins (users who created the league) can upload
-- We check if the user is the creator of the league by checking the filename pattern
-- Filename format: {leagueId}.{ext}
-- We verify the user is the creator by checking the leagues table
DROP POLICY IF EXISTS "Admins can upload league avatars" ON storage.objects;
CREATE POLICY "Admins can upload league avatars"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'league-avatars' AND
  auth.uid() IS NOT NULL AND
  -- Check if user is admin of the league (creator)
  EXISTS (
    SELECT 1 FROM leagues
    WHERE id::text = (storage.foldername(name))[1]
    AND created_by = auth.uid()
  )
);

-- Policy 3: Allow admins to update (UPDATE) their own league avatars
-- Admins can replace existing avatars for their leagues
DROP POLICY IF EXISTS "Admins can update league avatars" ON storage.objects;
CREATE POLICY "Admins can update league avatars"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'league-avatars' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM leagues
    WHERE id::text = (storage.foldername(name))[1]
    AND created_by = auth.uid()
  )
);

-- Policy 4: Allow admins to delete (DELETE) their own league avatars
-- Admins can remove avatars for their leagues
DROP POLICY IF EXISTS "Admins can delete league avatars" ON storage.objects;
CREATE POLICY "Admins can delete league avatars"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'league-avatars' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM leagues
    WHERE id::text = (storage.foldername(name))[1]
    AND created_by = auth.uid()
  )
);

-- ============================================
-- Alternative: Simpler approach if the above doesn't work
-- ============================================
-- If the filename-based approach doesn't work, you can use a simpler policy
-- that allows any authenticated user to upload, and rely on application-level
-- checks (which we already have in the code - checking isAdmin)

-- Uncomment these if the above policies don't work:

-- DROP POLICY IF EXISTS "Public read access for league avatars" ON storage.objects;
-- CREATE POLICY "Public read access for league avatars"
-- ON storage.objects
-- FOR SELECT
-- USING (bucket_id = 'league-avatars');

-- DROP POLICY IF EXISTS "Authenticated users can upload league avatars" ON storage.objects;
-- CREATE POLICY "Authenticated users can upload league avatars"
-- ON storage.objects
-- FOR INSERT
-- WITH CHECK (
--   bucket_id = 'league-avatars' AND
--   auth.uid() IS NOT NULL
-- );

-- DROP POLICY IF EXISTS "Authenticated users can update league avatars" ON storage.objects;
-- CREATE POLICY "Authenticated users can update league avatars"
-- ON storage.objects
-- FOR UPDATE
-- USING (
--   bucket_id = 'league-avatars' AND
--   auth.uid() IS NOT NULL
-- );

-- DROP POLICY IF EXISTS "Authenticated users can delete league avatars" ON storage.objects;
-- CREATE POLICY "Authenticated users can delete league avatars"
-- ON storage.objects
-- FOR DELETE
-- USING (
--   bucket_id = 'league-avatars' AND
--   auth.uid() IS NOT NULL
-- );

