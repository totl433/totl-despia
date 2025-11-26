# Chat Notification Fix - Root Cause Analysis

## Problem Summary

Chat notifications were not being sent to mini-league members despite:
- ✅ OneSignal properly configured
- ✅ Devices registered in OneSignal (showing as "Subscribed")
- ✅ Auto-registration code in place
- ✅ `push_subscriptions` table created

## Root Cause

**Schema Mismatch**: The code was trying to query for a `subscription_id` column that doesn't exist in the database.

### The Issue

1. **Database Schema** (`push_subscriptions.sql`):
   - Only has `player_id` column (legacy OneSignal SDK format)
   - Does NOT have `subscription_id` column (newer OneSignal SDK format)

2. **Code** (`notifyLeagueMessage.ts`):
   - Was querying: `SELECT user_id, subscription_id, player_id, is_active`
   - This query would fail or return null for `subscription_id`
   - The code tried to use `include_subscription_ids` (OneSignal v5+ API)
   - Only fell back to `player_id` if `subscription_id` was missing

3. **Why This Happened**:
   - Despia uses the **legacy OneSignal SDK** (not v5+)
   - Despia only provides `despia.onesignalplayerid` (which is a `player_id`, not `subscription_id`)
   - The code was written assuming the newer OneSignal SDK format

## Fix Applied

### 1. Fixed `notifyLeagueMessage.ts`
- ✅ Removed all `subscription_id` references
- ✅ Simplified to only query `player_id`
- ✅ Uses `include_player_ids` in OneSignal API (correct for legacy SDK)
- ✅ Added better logging for debugging

### 2. Fixed `registerPlayer.ts`
- ✅ Removed `subscription_id` parameter handling
- ✅ Simplified to only accept `playerId` (what Despia provides)
- ✅ Updated error messages to be clearer

### 3. Flow Verification

**Expected Flow:**
1. User opens app → Despia SDK initializes OneSignal → `despia.onesignalplayerid` becomes available
2. `AuthContext.tsx` detects user is signed in → attempts to register Player ID
3. Calls `/.netlify/functions/registerPlayer` with `playerId` and user's JWT
4. Function stores `(user_id, player_id)` in `push_subscriptions` table
5. When user sends chat message → `sendChat()` calls `notifyLeagueMessage`
6. Function queries `push_subscriptions` for recipients' `player_id`s
7. Sends notification via OneSignal using `include_player_ids`

## Testing Checklist

After deploying these fixes:

1. **Verify Device Registration**:
   - Open app, sign in
   - Check browser console for `[Push] Auto-registered Player ID: ...`
   - In Supabase SQL Editor, verify row exists:
     ```sql
     SELECT user_id, player_id, is_active 
     FROM public.push_subscriptions 
     WHERE user_id = '<your-user-id>'
     ```

2. **Test Chat Notification**:
   - Have 2+ users in same mini-league
   - Both users must have registered devices (see step 1)
   - User A sends message
   - User B should receive push notification (if app is closed/backgrounded)

3. **Check Netlify Function Logs**:
   - Go to Netlify → Functions → `notifyLeagueMessage` → Logs
   - Look for: `[notifyLeagueMessage] Sending to X devices for Y recipients`
   - If you see `No registered devices`, check step 1

## Key Takeaways

1. **Despia uses legacy OneSignal SDK**: Only `player_id` is available, not `subscription_id`
2. **Database schema must match code**: The table only has `player_id`, so code must only use `player_id`
3. **OneSignal API**: Use `include_player_ids` (not `include_subscription_ids`) for legacy SDK

## Files Changed

- ✅ `netlify/functions/notifyLeagueMessage.ts` - Removed subscription_id, simplified to player_id only
- ✅ `netlify/functions/registerPlayer.ts` - Removed subscription_id handling, simplified to playerId only

## Next Steps

1. Deploy these changes to staging
2. Have all users:
   - Close and reopen the app (to trigger auto-registration)
   - Or manually register via Admin page "Register Device" button
3. Test chat notifications between 2+ users in same mini-league
4. Check Netlify logs if issues persist

