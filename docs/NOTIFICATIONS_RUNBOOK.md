# Push Notifications Runbook

This runbook helps diagnose and investigate push notification issues in the TOTL app.

## Quick Reference

### Database Tables
- `push_subscriptions` - Device registrations (user_id ↔ player_id mapping)
- `notification_send_log` - Audit log of all send attempts (idempotency)
- `user_notification_preferences` - User opt-out settings
- `notification_state` - Legacy dedup state for score notifications
- `league_notification_settings` - Per-league mute settings

### Notification Types
| Key | Trigger | Preference Key |
|-----|---------|----------------|
| `goal-scored` | Score update webhook | `score-updates` |
| `goal-disallowed` | Score decreased | `score-updates` |
| `kickoff` | Status → IN_PLAY | `score-updates` |
| `half-time` | Status → PAUSED | (none) |
| `final-whistle` | Status → FINISHED | `final-whistle` |
| `gameweek-complete` | All GW fixtures done | `gw-results` |
| `chat-message` | Client POST | `chat-messages` |
| `final-submission` | All members submitted | (none) |
| `new-gameweek` | Admin broadcast | `new-gameweek` |

---

## "Why did user X get 6 pushes?"

### Step 1: Check notification_send_log

```sql
-- Find all sends to a user in the last 24 hours
SELECT 
  notification_key,
  event_id,
  result,
  created_at,
  onesignal_notification_id
FROM notification_send_log
WHERE user_id = 'USER_UUID_HERE'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Step 2: Check for duplicate event_ids

```sql
-- Find duplicate event_ids (should never happen with new system)
SELECT 
  event_id,
  notification_key,
  COUNT(*) as count
FROM notification_send_log
WHERE user_id = 'USER_UUID_HERE'
  AND result = 'accepted'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_id, notification_key
HAVING COUNT(*) > 1;
```

### Step 3: Check for multiple devices

```sql
-- Check if user has multiple registered devices
SELECT 
  player_id,
  is_active,
  subscribed,
  platform,
  updated_at
FROM push_subscriptions
WHERE user_id = 'USER_UUID_HERE';
```

### Common Causes
1. **Multiple devices registered** - User has multiple player_ids in push_subscriptions
2. **Old V1 senders still active** - Check if non-V2 functions are running
3. **Missing collapse_id** - V1 senders didn't set collapse_id

---

## "Why did user Y get none?"

### Step 1: Check if user has registered device

```sql
SELECT 
  player_id,
  is_active,
  subscribed,
  invalid,
  last_checked_at,
  os_payload->'notification_types' as notification_types
FROM push_subscriptions
WHERE user_id = 'USER_UUID_HERE'
  AND is_active = true;
```

### Step 2: Check user preferences

```sql
SELECT preferences
FROM user_notification_preferences
WHERE user_id = 'USER_UUID_HERE';
```

### Step 3: Check send log for suppressions

```sql
SELECT 
  notification_key,
  event_id,
  result,
  created_at
FROM notification_send_log
WHERE user_id = 'USER_UUID_HERE'
ORDER BY created_at DESC
LIMIT 50;
```

### Step 4: Verify OneSignal subscription

Use the OneSignal API to check player status:
```bash
curl "https://onesignal.com/api/v1/players/PLAYER_ID?app_id=YOUR_APP_ID" \
  -H "Authorization: Basic YOUR_REST_API_KEY"
```

Check `notification_types`:
- `1` = Subscribed (will receive)
- `-2` = Unsubscribed
- `0` = Disabled
- `null` = Still initializing

### Common Causes
1. **No device registered** - User hasn't opened the app recently
2. **Device not subscribed in OneSignal** - notification_types != 1
3. **User disabled preference** - Check user_notification_preferences
4. **Suppressed by cooldown** - Check send_log for `suppressed_cooldown`
5. **No picks** - User didn't make picks for the fixture

---

## "What was sent for match X?"

```sql
-- Get all notifications for a specific match
SELECT 
  notification_key,
  event_id,
  user_id,
  result,
  payload_summary,
  created_at
FROM notification_send_log
WHERE notification_key IN ('goal-scored', 'kickoff', 'half-time', 'final-whistle')
  AND payload_summary->>'api_match_id' = 'MATCH_ID_HERE'
ORDER BY created_at;
```

```sql
-- Summary by notification type
SELECT 
  notification_key,
  result,
  COUNT(*) as count
FROM notification_send_log
WHERE payload_summary->>'api_match_id' = 'MATCH_ID_HERE'
GROUP BY notification_key, result
ORDER BY notification_key;
```

---

## Notification Flow Diagram

```
                     ┌─────────────────────┐
                     │   Event Trigger     │
                     │ (webhook/client)    │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  Build Intent       │
                     │  (notification_key, │
                     │   event_id, users)  │
                     └──────────┬──────────┘
                                │
                                ▼
              ┌─────────────────────────────────────┐
              │         dispatchNotification()      │
              └─────────────────┬───────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
 ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
 │  Idempotency  │    │    Policy     │    │   Targeting   │
 │    Check      │    │    Checks     │    │   Resolution  │
 │ (send_log)    │    │ (prefs, cool) │    │ (player_ids)  │
 └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
         │                    │                    │
         │ duplicate?         │ suppressed?        │ no devices?
         │     ▼              │     ▼              │     ▼
         │   SKIP             │   SKIP             │   SKIP
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼ (if allowed)
                     ┌─────────────────────┐
                     │   OneSignal API     │
                     │ (with collapse_id,  │
                     │  thread_id, group)  │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  Update send_log    │
                     │  (result + OS ID)   │
                     └─────────────────────┘
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ONESIGNAL_APP_ID` | OneSignal application ID |
| `ONESIGNAL_REST_API_KEY` | OneSignal REST API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (for backend) |
| `NOTIFICATION_ENV` | Environment override (prod/dev/staging) |

---

## Health Checks

### Check send_log stats (last 24h)

```sql
SELECT 
  notification_key,
  result,
  COUNT(*) as count
FROM notification_send_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY notification_key, result
ORDER BY notification_key, count DESC;
```

### Check for orphaned devices

```sql
-- Devices in DB but not in OneSignal (subscribed but invalid)
SELECT 
  user_id,
  player_id,
  last_checked_at
FROM push_subscriptions
WHERE subscribed = true
  AND invalid = true;
```

### Check duplicate rate

```sql
-- Should be 0 with new system
SELECT 
  COUNT(*) as duplicate_count
FROM notification_send_log
WHERE result = 'suppressed_duplicate'
  AND created_at > NOW() - INTERVAL '24 hours';
```

---

## Migration Status

### V2 Senders (use dispatcher)
- [ ] `notifyLeagueMessageV2.ts` - Chat notifications
- [ ] `sendPushAllV2.ts` - Broadcast notifications
- [ ] `sendScoreNotificationsWebhookV2.ts` - Score notifications

### V1 Senders (direct OneSignal - to be deprecated)
- `notifyLeagueMessage.ts`
- `sendPushAll.ts`
- `sendScoreNotificationsWebhook.ts`
- `notifyFinalSubmission.ts`
- `sendPush.ts`

### To Fully Migrate
1. Deploy V2 functions
2. Update client code to call V2 endpoints
3. Monitor send_log for V2 results
4. Disable V1 functions once V2 is stable

