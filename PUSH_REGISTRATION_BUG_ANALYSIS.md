# Push Registration Bug Analysis - Cakehurst Case

## Problem
Cakehurst signed up but their device wasn't automatically registered in `push_subscriptions` table, while Sim's registration worked fine.

## Root Cause Analysis

### Potential Issues Found:

1. **Race Condition: session.access_token might be null initially**
   - The registration `useEffect` depends on `[user?.id, session?.access_token]`
   - If `session` exists but `access_token` is `null` initially, the effect runs but registration fails
   - **FIXED**: Added explicit check for `session.access_token` before attempting registration
   - **FIXED**: Added retry logic if `access_token` isn't ready initially

2. **Session Validation Missing**
   - The effect checked `if (!user || !session)` but didn't validate `session.access_token`
   - Registration would attempt but fail silently when calling the API
   - **FIXED**: Added validation at multiple points

3. **Visibility Change Handler Missing Validation**
   - When app becomes visible, it retried registration but didn't check `session.access_token`
   - **FIXED**: Added `session?.access_token` check

4. **Periodic Re-registration Missing Validation**
   - Periodic checks didn't validate `session.access_token`
   - **FIXED**: Added `session?.access_token` check

## Changes Made

1. **src/context/AuthContext.tsx**:
   - Added explicit `session.access_token` check before running registration effect
   - Added validation during registration attempts
   - Added delay/retry if `access_token` isn't ready initially
   - Fixed visibility change handler to check `session.access_token`
   - Fixed periodic re-registration to check `session.access_token`

2. **src/lib/pushNotifications.ts**:
   - Improved error logging for registration failures
   - More detailed error messages with status codes

## Testing Recommendations

1. **Test with new user signup**:
   - Sign up a new user
   - Monitor console logs for registration attempts
   - Verify device appears in `push_subscriptions` table

2. **Test session timing**:
   - Check if registration happens when `session.access_token` becomes available after initial null

3. **Monitor Netlify logs**:
   - Check `registerPlayer` function logs for Cakehurst's user ID
   - Look for any errors or failed attempts

## Next Steps

1. Deploy fixes to staging
2. Ask Cakehurst to reopen the app (registration should now work)
3. Monitor logs to confirm registration succeeds
4. If still failing, check Netlify function logs for specific errors
