# Fix: Termly AutoBlocker Blocking Avatar Images

## Root Cause
The broken avatar images on `playtotl.com` are **NOT a CORS issue**. The problem is **Termly AutoBlocker** blocking third-party images (including Supabase storage) until users accept cookies.

**Evidence:**
- Console shows: `"[Termly] AutoBlocker is enabled for this website"`
- Images have `data-src` instead of `src` and `data-autoblocked="1"` attributes
- One league avatar image loaded successfully (status 200), proving CORS is fine
- Images work on `totl-staging.netlify.app` (likely because Termly isn't configured there)

## Solution Implemented

### 1. Workaround in CookieConsent Component
Added code to restore `src` attributes for Supabase storage images after Termly AutoBlocker modifies them:

- Monitors for images with `data-src` and `data-autoblocked="1"`
- Restores `src` attribute for Supabase storage URLs (`supabase.co/storage`)
- Uses MutationObserver to catch new images as they're added to DOM
- Runs periodically to catch any images Termly modifies after initial load

**File:** `src/components/CookieConsent.tsx`

### 2. Enhanced Error Handling in UserAvatar Component
Added better error detection and logging to identify when images are blocked:

- Logs when `src` is converted to `data-src`
- Attempts to restore `src` attribute on error
- Logs CORS issues if they occur

**File:** `src/components/UserAvatar.tsx`

## Alternative Solutions (If Workaround Doesn't Work)

### Option 1: Configure Termly Dashboard
1. Go to Termly Dashboard
2. Find your website configuration
3. Look for "AutoBlocker" or "Resource Blocker" settings
4. Add `gyjagrtwrhctmgkootjj.supabase.co` to allowed/whitelisted domains
5. Or disable AutoBlocker for image resources

### Option 2: Disable AutoBlocker (Not Recommended)
Remove `data-auto-block="on"` from the Termly script, but this reduces GDPR compliance.

### Option 3: Pre-load Images Before Termly
Load avatar images before Termly script initializes (complex, may not work).

## Testing
1. Deploy the fix to `playtotl.com`
2. Clear browser cache
3. Visit `https://playtotl.com/league/prem-predictions`
4. Check browser console - should see `[CookieConsent] Restoring Supabase storage image src` messages
5. Verify avatar images load correctly

## Files Modified
- `src/components/CookieConsent.tsx` - Added workaround to restore image src
- `src/components/UserAvatar.tsx` - Enhanced error handling
- `src/lib/userAvatars.ts` - Added logging and validation

## Status
✅ **Fix implemented** - Workaround added to restore Supabase storage image src attributes
⏳ **Testing needed** - Deploy and test on playtotl.com
