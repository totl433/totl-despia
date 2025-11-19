# Supabase Storage Setup for League Avatars

## Option 1: Using Supabase Dashboard (Recommended - Easier)

### Step 1: Create the Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"** button
4. Configure the bucket:
   - **Name**: `league-avatars`
   - **Public bucket**: ✅ **Check this** (allows public read access)
   - **File size limit**: `100` KB (we compress to ~60KB, but allow buffer for complex images)
   - **Allowed MIME types**: `image/png,image/jpeg,image/jpg,image/webp`
5. Click **"Create bucket"**

### Step 2: Configure Storage Policies

1. Click on the `league-avatars` bucket you just created
2. Go to the **"Policies"** tab
3. Click **"New Policy"**

#### Policy 1: Public Read Access
- **Policy name**: `Public read access for league avatars`
- **Allowed operation**: `SELECT`
- **Policy definition**:
  ```sql
  (bucket_id = 'league-avatars')
  ```
- Click **"Save policy"**

#### Policy 2: Admin Upload Access
- **Policy name**: `Admins can upload league avatars`
- **Allowed operation**: `INSERT`
- **Policy definition**:
  ```sql
  (bucket_id = 'league-avatars' AND auth.uid() IS NOT NULL)
  ```
- Click **"Save policy"**

#### Policy 3: Admin Update Access
- **Policy name**: `Admins can update league avatars`
- **Allowed operation**: `UPDATE`
- **Policy definition**:
  ```sql
  (bucket_id = 'league-avatars' AND auth.uid() IS NOT NULL)
  ```
- Click **"Save policy"**

#### Policy 4: Admin Delete Access
- **Policy name**: `Admins can delete league avatars`
- **Allowed operation**: `DELETE`
- **Policy definition**:
  ```sql
  (bucket_id = 'league-avatars' AND auth.uid() IS NOT NULL)
  ```
- Click **"Save policy"**

**Note**: The application code already checks `isAdmin` before allowing uploads, so allowing all authenticated users at the storage level is safe. The application-level check provides the actual security.

---

## Option 2: Using SQL Editor

### Step 1: Add avatar column to leagues table

1. Go to **SQL Editor** in Supabase Dashboard
2. Open the file `supabase/sql/add_avatar_column_to_leagues.sql`
3. Copy and paste the SQL into the editor
4. Click **"Run"**

This adds the `avatar` column to store avatar URLs.

### Step 2: Create storage bucket and policies

1. Go to **SQL Editor** in Supabase Dashboard
2. Open the file `supabase/sql/setup_league_avatars_storage.sql`
3. Copy and paste the SQL into the editor
4. Click **"Run"**

**Note**: If you don't have superuser access, you'll need to create the bucket via the Dashboard first (Option 1, Step 1), then run only the policy creation SQL (the DROP POLICY and CREATE POLICY statements).

---

## Verification

After setup, test the upload:

1. Go to a mini league page where you're an admin
2. Click the three-dot menu (top right)
3. Click **"🖼️ Upload avatar"**
4. Select an image file
5. The image should upload and compress to ~60KB (max 80KB)
6. The avatar should appear on the home screen mini league card

If you get permission errors, check:
- Bucket is set to **Public**
- Policies are created correctly
- You're logged in as an authenticated user
- You're the admin of the league (created_by matches your user ID)

---

## Troubleshooting

### Error: "new row violates row-level security policy"
- Make sure the bucket policies are created
- Verify the bucket name is exactly `league-avatars` (case-sensitive)
- Check that you're authenticated (auth.uid() IS NOT NULL)

### Error: "Bucket not found"
- Create the bucket first via Dashboard
- Verify the bucket name matches exactly: `league-avatars`

### Images not displaying
- Check the bucket is set to **Public**
- Verify the public URL is correct
- Check browser console for CORS or loading errors

