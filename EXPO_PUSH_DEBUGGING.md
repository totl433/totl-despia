# Expo Push Notifications Debugging

When Expo (TestFlight) has the token but notifications don't arrive, use this guide.

## Quick checks

### 1. `notification_send_log` (Supabase)

For a recent send to your user:

```sql
SELECT notification_key, result, targeting_summary, payload_summary, error, created_at
FROM notification_send_log
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

- **`result: accepted`** but **`recipients: 0`** → OneSignal accepted but didn't deliver (device not subscribed or APNs issue)
- **`result: suppressed_unsubscribed`** → Device failed verification or OneSignal rejected
- **`targeting_summary.player_ids`** → Which device(s) we tried to send to

### 2. OneSignal Dashboard

1. Go to **Audience** → **All Users**
2. Search for the Expo `player_id` (from `push_subscriptions` or `targeting_summary`)
3. Check:
   - **Status**: Subscribed (green) vs Not Subscribed (grey)
   - **Platform**: iOS
  - **Bundle ID**: Should show `com.despia.totlnative` for Expo

### 3. OneSignal iOS configuration

OneSignal → Your App → **Platforms** → **iOS**:

- **Bundle ID**: Must include `com.despia.totlnative` (Expo's bundle ID)
- **APNs Auth Key**: Production key for TestFlight (sandbox won't work)
- If only Despia's bundle ID is configured, Expo devices may register but not receive

### 4. APNs environment

- **TestFlight** = production APNs
- `onesignal-expo-plugin` must use `mode: 'production'` for production builds (see `app.config.ts` / `eas.json`)

### 5. Existing diagnostics

- `/.netlify/functions/diagnoseCarlNotifications` – device status for a user
- `/.netlify/functions/checkMySubscription` – subscription check by player ID

## Common causes

| Symptom | Likely cause |
|--------|--------------|
| `recipients: 0` | Expo player not subscribed in OneSignal, or wrong APNs env |
| `All included players are not subscribed` | OneSignal rejects the player_id |
| Despia works, Expo doesn't | OneSignal iOS config missing `com.despia.totlnative`, or Expo APNs token invalid |
| Both apps installed, only Despia gets it | Multi-device now sends to both; if Expo still doesn't receive, see above |

## Multi-device support

As of the latest changes, both Despia and Expo (TestFlight) stay active. Notifications are sent to **all** active devices. Users with both apps get both (duplicate during overlap is expected).
