# Fix Supabase Storage CORS for playtotl.com

## Problem
Avatar images (user and league) work on `totl-staging.netlify.app` but are broken on `playtotl.com`. Images show `data-src` instead of `src` and `data-autoblocked="1"` attributes, indicating CORS blocking.

## Root Cause
Supabase Storage buckets have CORS (Cross-Origin Resource Sharing) restrictions. The `user-avatars` and `league-avatars` buckets likely only allow requests from `totl-staging.netlify.app` but not from `playtotl.com`.

## Solution Options

### Option 1: Update CORS via Management API (Try This First)

Run the script:
```bash
node scripts/update-storage-cors-api.mjs
```

This uses the Supabase Management API to update CORS settings. If it works, you're done! If you get a 404 error, use Option 2 or 3.

### Option 2: Update CORS via SQL (Check Available Options)

Run the SQL script in Supabase SQL Editor:
```sql
-- See: supabase/sql/update_storage_cors.sql
```

This will check what's available and provide guidance. Note: CORS may not be configurable via SQL in all Supabase plans.

### Option 3: Update CORS via Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project (the one with `gyjagrtwrhctmgkootjj` in the URL)
3. Navigate to **Storage** in the left sidebar

### Step 2: Update CORS for `user-avatars` Bucket
1. Click on **Storage** → **Buckets**
2. Find the `user-avatars` bucket
3. Click on it to open bucket settings
4. Look for **CORS Configuration** or **Settings** tab
5. Update CORS settings to include:
   ```
   https://playtotl.com
   https://www.playtotl.com
   https://totl-staging.netlify.app
   ```
6. Or use wildcard (less secure but simpler):
   ```
   *
   ```

### Step 3: Update CORS for `league-avatars` Bucket
1. Repeat the same steps for the `league-avatars` bucket
2. Add the same domains to CORS settings

### Step 4: Alternative - Use Supabase CLI
If you have Supabase CLI installed, you can update CORS via command line:

```bash
# Update user-avatars bucket CORS
supabase storage update cors user-avatars --allowed-origins "https://playtotl.com,https://www.playtotl.com,https://totl-staging.netlify.app"

# Update league-avatars bucket CORS
supabase storage update cors league-avatars --allowed-origins "https://playtotl.com,https://www.playtotl.com,https://totl-staging.netlify.app"
```

### Step 5: Verify
1. After updating CORS, wait a few minutes for changes to propagate
2. Test on `playtotl.com` - avatar images should now load
3. Check browser console - CORS errors should be gone

## Expected CORS Configuration

For each bucket (`user-avatars` and `league-avatars`), the CORS settings should allow:

**Allowed Origins:**
- `https://playtotl.com`
- `https://www.playtotl.com`
- `https://totl-staging.netlify.app`
- `http://localhost:5173` (for local development)

**Allowed Methods:**
- `GET` (required for reading images)
- `HEAD` (optional, for checking if files exist)

**Allowed Headers:**
- `*` (or specific headers like `Authorization`, `Content-Type`)

**Max Age:**
- `3600` (1 hour cache)

## Notes
- CORS changes may take a few minutes to propagate
- Clear browser cache if images still don't load after updating CORS
- The `data-src` and `data-autoblocked` attributes are added by browsers when CORS blocks the request
- Once CORS is fixed, images should load normally with proper `src` attributes

## Testing
After updating CORS:
1. Open `playtotl.com` in a browser
2. Check browser console for CORS errors (should be none)
3. Verify avatar images load correctly
4. Check network tab - image requests should return 200 status
