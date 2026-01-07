-- Backfill user avatars for legacy users
-- This script generates default avatars for all users who don't have one
-- Run this AFTER setting up the user-avatars storage bucket and users table

-- Note: This SQL script can't actually generate and upload images
-- You'll need to run a script (Node.js/TypeScript) to:
-- 1. Query all users without avatar_url
-- 2. Generate avatar images using the same logic as generateAndUploadDefaultAvatar()
-- 3. Upload to Supabase Storage
-- 4. Update users.avatar_url

-- This SQL file is for reference/documentation
-- The actual backfill should be done via a script that can:
-- - Generate canvas images
-- - Upload to Supabase Storage
-- - Update the database

-- Example query to find users without avatars:
-- SELECT id, name FROM public.users WHERE avatar_url IS NULL;

-- Example query to find all auth.users that might not be in public.users:
-- SELECT id, raw_user_meta_data->>'display_name' as name 
-- FROM auth.users 
-- WHERE id NOT IN (SELECT id FROM public.users);

-- After running the backfill script, verify with:
-- SELECT COUNT(*) FROM public.users WHERE avatar_url IS NULL;
-- Should return 0 (or only very recent signups that haven't generated yet)


