# Testing Notifications - Direct Approach

Since UI changes aren't showing up in the native app (likely Despia caching), let's test the notification flow directly.

## Current Status:
- ✅ Notification code is correct (fixed schema mismatch)
- ✅ Your device is registered (3 devices)
- ❌ Other members don't have devices registered (Jof, SP, ThomasJamesBird all show 0 devices)

## Solution: Test Device Registration Directly

Since auto-registration isn't working, let's manually register devices using the OneSignal Player IDs you can see in the OneSignal dashboard.

### Step 1: Get Player IDs from OneSignal Dashboard

For each user (Jof, SP, ThomasJamesBird):
1. Go to OneSignal dashboard → Audience → All Users
2. Find their device(s)
3. Copy the OneSignal ID (Player ID) - looks like: `33762d5d-bc28-4326-8333-807f57d...`

### Step 2: Manually Register Devices

Use curl or Postman to call the registerPlayer function directly:

```bash
curl -X POST https://totl-staging.netlify.app/.netlify/functions/registerPlayer \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <THEIR_SUPABASE_JWT_TOKEN>' \
  -d '{
    "playerId": "33762d5d-bc28-4326-8333-807f57d...",
    "platform": "ios"
  }'
```

Replace:
- `<THEIR_SUPABASE_JWT_TOKEN>` with their actual Supabase JWT token (you can get this from Supabase auth.users table or have them copy it)
- `33762d5d-bc28-4326-8333-807f57d...` with their actual Player ID from OneSignal

### Step 3: Verify Registration

After registering, check the database:
```sql
SELECT user_id, player_id, is_active 
FROM public.push_subscriptions 
WHERE user_id IN (
  SELECT user_id FROM public.league_members 
  WHERE league_id = 'c5602a5b-4cf1-45f1-b6dc-db0670db577a'
)
ORDER BY created_at DESC;
```

### Step 4: Test Notifications

Once devices are registered, send a chat message and notifications should work.

## Why Auto-Registration Isn't Working

The auto-registration code should work, but OneSignal might not be initialized when users sign in. The manual registration above bypasses this issue.

## About Despia/UI Changes

Despia likely bundles web assets when building the native app, so UI changes won't appear until:
1. Despia rebuilds the native app with new web assets
2. Users download the new native app version

But we don't need UI changes - we can test notifications directly using the backend functions.

