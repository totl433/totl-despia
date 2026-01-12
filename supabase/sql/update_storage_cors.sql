-- ============================================
-- Update Supabase Storage CORS Configuration
-- ============================================
-- This script attempts to update CORS settings for storage buckets
-- Note: CORS may need to be configured via Dashboard or Management API
-- Run this in Supabase SQL Editor

-- Check if buckets table has CORS columns
-- Note: Supabase Storage CORS is typically managed via Dashboard, not SQL
-- This script checks what's available and provides guidance

-- Step 1: Check bucket structure
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name IN ('user-avatars', 'league-avatars')
ORDER BY name;

-- Step 2: Attempt to update CORS via bucket metadata
-- Note: This may not work if CORS is managed separately
-- Supabase Storage CORS is typically configured via:
-- 1. Dashboard: Storage → Buckets → [bucket] → Settings → CORS
-- 2. Management API: POST /storage/v1/bucket/{id}/cors

-- If the above doesn't show CORS settings, you'll need to use one of these methods:

-- ============================================
-- Method 1: Via Supabase Dashboard (Recommended)
-- ============================================
-- 1. Go to: https://supabase.com/dashboard/project/[your-project]/storage/buckets
-- 2. Click on "user-avatars" bucket
-- 3. Look for "Settings" or "Configuration" tab
-- 4. Find "CORS" section
-- 5. Add these allowed origins:
--    - https://playtotl.com
--    - https://www.playtotl.com
--    - https://totl-staging.netlify.app
--    - http://localhost:5173
-- 6. Repeat for "league-avatars" bucket

-- ============================================
-- Method 2: Via Supabase Management API
-- ============================================
-- Use curl or Postman to call the Management API:
--
-- For user-avatars:
-- curl -X POST 'https://api.supabase.com/v1/projects/[project-ref]/storage/buckets/user-avatars/cors' \
--   -H 'Authorization: Bearer [service-role-key]' \
--   -H 'Content-Type: application/json' \
--   -d '{
--     "allowed_origins": [
--       "https://playtotl.com",
--       "https://www.playtotl.com",
--       "https://totl-staging.netlify.app",
--       "http://localhost:5173"
--     ],
--     "allowed_methods": ["GET", "HEAD"],
--     "allowed_headers": ["*"],
--     "max_age": 3600
--   }'
--
-- Repeat for league-avatars bucket

-- ============================================
-- Method 3: Check if we can update via storage.objects policies
-- ============================================
-- CORS is separate from RLS policies, but let's verify policies are correct:

-- Check existing policies for user-avatars
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%avatar%'
ORDER BY policyname;

-- ============================================
-- Verification Query
-- ============================================
-- After updating CORS (via Dashboard or API), verify buckets exist and are public:
SELECT 
  name,
  public,
  file_size_limit,
  CASE 
    WHEN allowed_mime_types IS NULL THEN 'Any'
    ELSE array_to_string(allowed_mime_types, ', ')
  END as allowed_types
FROM storage.buckets
WHERE name IN ('user-avatars', 'league-avatars')
ORDER BY name;
