# Push Notification Issue: Chat Notifications Not Working

## Problem Summary
Chat notifications for mini-league messages are not being delivered to users, despite:
- ✅ OneSignal properly configured (App ID, REST API Key)
- ✅ Devices registered in database (`push_subscriptions` table)
- ✅ Function correctly identifying recipients and Player IDs
- ✅ OneSignal API call succeeds (HTTP 200 OK)

## Error Message
```
OneSignal API Response:
{
  "ok": true,
  "result": {
    "errors": ["All included players are not subscribed"],
    "id": null,
    "recipients": 0
  },
  "sent": 3,
  "used": "player_ids"
}
```

## Technical Stack
- **Frontend**: React/TypeScript/Vite
- **Backend**: Netlify Functions (Node.js)
- **Push Service**: OneSignal REST API v1
- **Native Wrapper**: Despia SDK (provides `despia.onesignalplayerid`)
- **Database**: Supabase PostgreSQL

## Current Flow
1. User sends chat message → `sendChat()` in `src/pages/League.tsx`
2. Message inserted into Supabase `league_messages` table
3. `notifyLeagueMessage` Netlify function called (`/.netlify/functions/notifyLeagueMessage`)
4. Function:
   - Loads league members (excludes sender)
   - Filters muted users
   - Queries `push_subscriptions` table for `player_id` values
   - Calls OneSignal API with `include_player_ids: [player_id_1, player_id_2, ...]`
5. OneSignal rejects request: "All included players are not subscribed"

## Root Cause Analysis

### What We Know Works
- ✅ Database queries: Player IDs correctly retrieved from `push_subscriptions`
- ✅ Function logic: Recipients correctly identified (excluding sender, muted users)
- ✅ API call format: Correct OneSignal API format (`Authorization: Basic <REST_API_KEY>`, `app_id` in body)
- ✅ HTTP response: OneSignal returns `200 OK` (not a network/auth error)

### The Problem
**OneSignal's API rejects the Player IDs because devices are not "subscribed" in OneSignal's system.**

#### Key Distinction:
- **Registered in Database** ≠ **Subscribed in OneSignal**
  - `push_subscriptions` table stores Player IDs (registration)
  - OneSignal requires devices to be actively subscribed (subscription status)

#### Evidence:
1. **OneSignal Dashboard**: Some devices show "Subscribed" (green), others show "Never Subscribed" (grey)
2. **Database**: All Player IDs present and `is_active: true`
3. **API Rejection**: OneSignal rejects batch if ANY Player ID is not subscribed

### Device Registration Flow
1. User opens app → Despia SDK initializes OneSignal → `despia.onesignalplayerid` becomes available
2. `AuthContext.tsx` detects user signed in → calls `/.netlify/functions/registerPlayer`
3. Function stores `(user_id, player_id)` in `push_subscriptions` table
4. **BUT**: OneSignal subscription status is separate from database registration

## What's Broken

### Issue 1: `despia-native` Import Error (FIXED)
- **Error**: `TypeError: Failed to resolve module specifier 'despia-native'`
- **Cause**: Code attempted dynamic import of `despia-native`, which isn't a real npm module
- **Fix**: Removed dynamic import, now only checks `globalThis.despia` and `window.despia`
- **Status**: ✅ Fixed (committed to staging)

### Issue 2: Device Subscription Status (UNRESOLVED)
- **Problem**: Player IDs stored in database don't match OneSignal's "Subscribed Users" segment
- **Likely Causes**:
  1. Users haven't granted push permissions in iOS Settings
  2. OneSignal SDK didn't complete subscription initialization
  3. Devices were registered but never subscribed in OneSignal
  4. Stale Player IDs (devices reinstalled but old IDs still in database)

## Database Schema
```sql
-- push_subscriptions table
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  player_id text NOT NULL,  -- OneSignal Player ID (from despia.onesignalplayerid)
  platform text,
  is_active boolean DEFAULT true,
  created_at timestamptz,
  updated_at timestamptz
);

-- Unique constraint prevents duplicate registrations
CREATE UNIQUE INDEX push_subscriptions_user_player_unique 
  ON public.push_subscriptions (user_id, player_id);
```

## OneSignal API Call
```typescript
// netlify/functions/notifyLeagueMessage.ts
const payloadOS = {
  app_id: ONESIGNAL_APP_ID,
  include_player_ids: playerIds,  // Array of Player IDs from database
  headings: { en: title },
  contents: { en: message },
  data: { type: 'league_message', leagueId, senderId }
};

const resp = await fetch('https://onesignal.com/api/v1/notifications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
  },
  body: JSON.stringify(payloadOS)
});
```

## Diagnostic Tools Created
1. **`checkOneSignalDevices`**: Verifies subscription status for Player IDs
   - Endpoint: `/.netlify/functions/checkOneSignalDevices?playerIds=id1,id2,id3`
   - Returns: Which Player IDs are subscribed vs not subscribed
2. **`diagnoseLeague`**: Shows league member device registration status
   - Endpoint: `/.netlify/functions/diagnoseLeague?leagueId=uuid`
   - Returns: Member count, devices registered, breakdown per user

## Next Steps / Recommendations

### Immediate Actions
1. **Verify Subscription Status**: Use `checkOneSignalDevices` endpoint to identify which Player IDs are subscribed
2. **Check OneSignal Dashboard**: Manually verify each Player ID's subscription status
3. **Identify Problem Devices**: Determine which users' devices show "Never Subscribed"

### Potential Solutions

#### Option 1: Filter Unsubscribed Devices (Recommended)
- Before sending to OneSignal, check each Player ID's subscription status
- Only send to subscribed Player IDs
- Log which devices were filtered out

#### Option 2: Re-register Devices
- Have users delete and reinstall app
- Ensure push permissions granted
- Wait 10-15 seconds for OneSignal initialization
- Verify devices appear as "Subscribed" in OneSignal dashboard

#### Option 3: Use OneSignal Segments
- Instead of `include_player_ids`, use `included_segments: ['Subscribed Users']`
- Only sends to devices OneSignal considers subscribed
- **Downside**: Less targeted (sends to all subscribed users, not just league members)

### Code Changes Needed
If filtering unsubscribed devices:
```typescript
// In notifyLeagueMessage.ts, before sending to OneSignal:
const subscribedPlayerIds = await Promise.all(
  playerIds.map(async (playerId) => {
    const checkResp = await fetch(`https://onesignal.com/api/v1/players/${playerId}`, {
      headers: { 'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}` }
    });
    const player = await checkResp.json();
    return player.invalid_identifier === false && player.last_active ? playerId : null;
  })
);
const validPlayerIds = subscribedPlayerIds.filter(Boolean);
// Then send to validPlayerIds only
```

## Files Involved
- `src/pages/League.tsx` - Chat UI, calls `notifyLeagueMessage`
- `netlify/functions/notifyLeagueMessage.ts` - Sends notifications to league members
- `netlify/functions/registerPlayer.ts` - Registers Player IDs in database
- `src/context/AuthContext.tsx` - Auto-registers Player IDs on login
- `supabase/sql/push_subscriptions.sql` - Database schema

## Environment Variables Required
- `ONESIGNAL_APP_ID` - OneSignal App ID
- `ONESIGNAL_REST_API_KEY` - OneSignal REST API Key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

## Testing
To test notification flow:
1. Send a chat message in a mini-league
2. Check browser console for `[Chat] Notification result:` log
3. Check Netlify function logs for `[notifyLeagueMessage]` entries
4. Verify OneSignal dashboard shows notification sent/delivered

## Questions for Investigation
1. Why are some Player IDs showing as "Never Subscribed" in OneSignal dashboard?
2. Is there a timing issue where devices register before OneSignal SDK completes subscription?
3. Should we use Subscription IDs instead of Player IDs? (Despia only provides Player IDs)
4. Is there a way to programmatically subscribe devices via OneSignal API?

