<objective>
Add functionality for mini league admins to upload custom avatar images for their leagues. The uploaded avatar should display on the home screen mini league cards. If no custom avatar is uploaded, the system should default to one of five provided default avatars (ML-avatar-1.png through ML-avatar-5.png) based on a deterministic selection.

This feature will allow league admins to personalize their leagues and improve visual identification on the home screen.
</objective>

<context>
This is a React + TypeScript application using Supabase for backend services. The app displays mini leagues on the home screen with avatar images. Currently, avatars are generated using Unsplash/Picsum photos based on league ID.

- The dropdown menu is implemented in `src/pages/League.tsx` around lines 3514-3579
- Admin menu opens when clicking "Manage" button (around line 1768)
- Avatars are displayed in `src/pages/Home.tsx` (around line 2518) and `src/pages/Tables.tsx` (around line 1038)
- Avatar helper functions are in `src/lib/leagueAvatars.ts`
- Default avatar files exist: `public/assets/league-avatars/ML-avatar-1.png` through `ML-avatar-5.png`
- The `leagues` table has an `avatar` field that can store avatar filenames or URLs
- Supabase is used for database and should be used for file storage

@src/pages/League.tsx
@src/pages/Home.tsx
@src/pages/Tables.tsx
@src/lib/leagueAvatars.ts
</context>

<requirements>
1. **Add "Upload avatar" option to admin dropdown menu**
   - Add a new menu item in the dropdown menu (after "Manage" or in the admin section)
   - Only visible to admins (when `isAdmin` is true)
   - Should trigger a file upload dialog when clicked

2. **Implement file upload functionality**
   - Use Supabase Storage to store uploaded avatar images
   - Create a storage bucket for league avatars (e.g., `league-avatars`)
   - Upload files with naming convention: `{leagueId}-{timestamp}.{ext}` or `{leagueId}.{ext}`
   - Support common image formats (PNG, JPG, JPEG, WebP)
   - **CRITICAL: Compress and resize images before upload**
     - Resize images to appropriate dimensions (suggest 256x256px or 512x512px max)
     - Compress images to maximum 20KB file size
     - Use client-side image compression library (e.g., `browser-image-compression` or `compressorjs`)
     - Maintain aspect ratio during resize
     - Optimize image quality to meet 20KB target while maintaining visual quality
   - Validate file size (max 2MB before compression, must be ≤20KB after compression) and file type
   - Show upload progress/loading state
   - Handle upload errors gracefully

3. **Update database with avatar URL**
   - After successful upload, update the `leagues` table `avatar` field with the Supabase Storage URL
   - The URL format should be: `https://{project}.supabase.co/storage/v1/object/public/league-avatars/{filename}`

4. **Update avatar display logic**
   - Modify `getGenericLeaguePhoto()` or create a new helper function to check for custom avatar first
   - If `league.avatar` exists and is a Supabase Storage URL, use that
   - If `league.avatar` exists and is a default filename (ML-avatar-1.png, etc.), use `/assets/league-avatars/{filename}`
   - If no custom avatar, default to one of ML-avatar-1.png through ML-avatar-5.png based on deterministic selection (use league ID hash)
   - Update avatar display in `Home.tsx` and `Tables.tsx` to use the new logic

5. **Update leagueAvatars.ts helper functions**
   - Add function to get default ML avatar based on league ID: `getDefaultMlAvatar(leagueId: string): string`
   - Update `getLeagueAvatarPath()` to handle Supabase Storage URLs
   - Create helper function: `getLeagueAvatarUrl(league: League): string` that returns the appropriate avatar URL

6. **UI/UX considerations**
   - Show current avatar preview in upload dialog
   - Allow removing custom avatar to revert to default
   - Show success/error messages after upload
   - Optimize image display (use object-fit: cover for consistent sizing)
   - Ensure avatars are displayed consistently across Home and Tables pages
</requirements>

<implementation>
1. **Supabase Storage Setup**
   - Create storage bucket `league-avatars` in Supabase dashboard (or check if it exists)
   - Set bucket to public access for avatar images
   - Configure RLS policies to allow admins to upload, all users to read

2. **File Upload Component/Function**
   - Create a file input handler that:
     - Accepts image files only
     - Validates file size (max 2MB before compression)
     - Validates file type (PNG, JPG, JPEG, WebP)
     - **Compresses and resizes image before upload:**
       - Resize to max 256x256px or 512x512px (maintain aspect ratio)
       - Compress to maximum 20KB file size
       - Use `browser-image-compression` library or similar
       - Example compression options:
         ```typescript
         {
           maxSizeMB: 0.02, // 20KB
           maxWidthOrHeight: 256,
           useWebWorker: true,
           fileType: 'image/jpeg' // or 'image/png'
         }
         ```
     - Shows preview of compressed image before upload
     - Validates final compressed file size (must be ≤20KB)
   - Use `supabase.storage.from('league-avatars').upload()` to upload compressed image
   - Get public URL using `supabase.storage.from('league-avatars').getPublicUrl()`

3. **Database Update**
   - After successful upload, update leagues table:
     ```typescript
     await supabase
       .from('leagues')
       .update({ avatar: publicUrl })
       .eq('id', leagueId)
     ```
   - Only allow admins to update (check `isAdmin` before allowing update)

4. **Default Avatar Selection**
   - Use deterministic hash of league ID to select from ML-avatar-1.png through ML-avatar-5.png
   - Ensure same league always gets same default avatar if no custom avatar is set

5. **Avatar Display Priority**
   - Priority order:
     1. Custom uploaded avatar (Supabase Storage URL in `league.avatar`)
     2. Default ML avatar filename in `league.avatar` field
     3. Deterministic default ML avatar based on league ID hash

6. **Error Handling**
   - Handle upload failures with user-friendly error messages
   - Handle invalid file types/sizes
   - Handle compression failures (if image cannot be compressed to 20KB, show error)
   - Handle network errors
   - Provide fallback to default avatar if custom avatar fails to load

7. **Image Compression Requirements**
   - **MANDATORY: All uploaded images must be compressed to ≤20KB**
   - Resize images to appropriate dimensions (256x256px recommended, max 512x512px)
   - Use client-side compression library (`browser-image-compression` recommended)
   - Show compression progress to user
   - If compression fails or cannot achieve 20KB target, show error message
   - Validate compressed file size before upload
   - This ensures fast loading times and efficient storage usage
</implementation>

<output>
Modify/create files:
- `src/pages/League.tsx` - Add "Upload avatar" menu item and upload functionality with image compression
- `src/lib/leagueAvatars.ts` - Add helper functions for default ML avatars and URL resolution
- `src/pages/Home.tsx` - Update avatar display to use new helper functions
- `src/pages/Tables.tsx` - Update avatar display to use new helper functions
- `src/components/AvatarUploadModal.tsx` (new) - Optional: Create reusable avatar upload modal component with compression
- `package.json` - Add `browser-image-compression` dependency (or similar compression library)

Ensure all avatar displays use the same logic for consistency.
Ensure all uploaded images are compressed to ≤20KB before upload.
</output>

<verification>
Before declaring complete, verify:
1. Admin can see "Upload avatar" option in dropdown menu
2. File upload dialog opens when clicking "Upload avatar"
3. File validation works (size, type)
4. **Image compression works correctly:**
   - Images are resized to appropriate dimensions (256x256px or smaller)
   - Images are compressed to ≤20KB before upload
   - Compression progress/status is shown to user
   - Compressed file size is validated before upload
5. Upload succeeds and updates database
6. Avatar displays correctly on home screen after upload
7. Default avatars (ML-avatar-1.png through ML-avatar-5.png) display when no custom avatar is set
8. Avatar displays correctly in both Home.tsx and Tables.tsx
9. Removing custom avatar reverts to default
10. Error messages display appropriately for failed uploads and compression failures
11. Images are optimized and display consistently (circular, proper sizing)
12. Uploaded avatar files are ≤20KB in size (verify in Supabase Storage)
</verification>

<success_criteria>
- Admins can upload custom avatars for their leagues
- **All uploaded images are compressed to ≤20KB and resized appropriately**
- Uploaded avatars display on home screen mini league cards
- Default avatars (ML-avatar-1.png through ML-avatar-5.png) display when no custom avatar is uploaded
- Avatar selection is deterministic (same league always gets same default if no custom)
- Upload functionality is secure (admin-only, validated files)
- Image compression is performed client-side before upload
- UI is intuitive and provides feedback during upload and compression process
- Avatar displays are consistent across all pages (Home, Tables, League page)
- Uploaded files meet size requirements (≤20KB) for optimal performance
</success_criteria>

