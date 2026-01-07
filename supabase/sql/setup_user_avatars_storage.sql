-- ============================================
-- Setup User Avatars Storage Bucket
-- ============================================
-- This script creates the storage bucket and RLS policies for user avatars
-- Run this in Supabase SQL Editor

-- Step 1: Create the storage bucket (if it doesn't exist)
-- Note: Bucket creation via SQL requires superuser privileges
-- If you don't have superuser access, create the bucket via Supabase Dashboard:
--   1. Go to Storage in Supabase Dashboard
--   2. Click "New bucket"
--   3. Name: user-avatars
--   4. Public bucket: Yes (checked)
--   5. File size limit: 2MB (allows for high-quality avatars)
--   6. Allowed MIME types: image/png,image/jpeg,image/jpg,image/webp

-- If you have superuser access, you can create it via SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true, -- Public bucket
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Step 2: Create Storage Policies
-- ============================================
-- Note: RLS is already enabled on storage.objects by Supabase
-- We just need to create the policies

-- Policy 1: Allow public read access for avatars
-- Anyone can view user avatars
DROP POLICY IF EXISTS "Public read access for user avatars" ON storage.objects;
CREATE POLICY "Public read access for user avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'user-avatars');

-- Policy 2: Allow users to upload their own avatars
-- Users can upload avatars (stored in folder: {userId}/avatar.png)
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
CREATE POLICY "Users can upload own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars' AND
  -- Check if file is in user's folder: {userId}/avatar.png
  -- Use SPLIT_PART as fallback if storage.foldername() returns NULL
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    SPLIT_PART(name, '/', 1) = auth.uid()::text
  )
);

-- Policy 3: Allow users to update their own avatars
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-avatars' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    SPLIT_PART(name, '/', 1) = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'user-avatars' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    SPLIT_PART(name, '/', 1) = auth.uid()::text
  )
);

-- Policy 4: Allow users to delete their own avatars
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
CREATE POLICY "Users can delete own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-avatars' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    SPLIT_PART(name, '/', 1) = auth.uid()::text
  )
);

-- ============================================
-- Step 3: Verify Policies Were Created
-- ============================================
-- Check that policies exist (for debugging)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%avatar%'
ORDER BY policyname;

