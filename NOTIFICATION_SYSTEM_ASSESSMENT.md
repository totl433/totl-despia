# Notification System Assessment

**Date:** December 2025  
**Status:** ✅ Production Ready

---

## Executive Summary

The TOTL notification system is a **server-side push notification system** powered by OneSignal. All notifications are delivered via push notifications to user devices. The system uses shared utilities for consistent subscription verification and user preference checking.

### Key Characteristics:
- **Single Delivery Method:** Push notifications via OneSignal API
- **Webhook-Driven:** Score updates triggered by Supabase database webhooks
- **Admin-Triggered:** Gameweek published notifications from API Admin
- **User Preferences:** Stored in `user_notification_preferences` table
- **No Hardcoded User IDs:** All functions are generic and reusable
- **Shared Utilities:** Consistent subscription and preference checking across all functions

---

## System Architecture

### Delivery Method: Push Notifications Only

All notifications are sent server-side via OneSignal's REST API. There is no client-side notification system.

**Flow:**
1. Event occurs (score update, chat message, gameweek published, etc.)
2. Netlify function is triggered (webhook or admin call)
3. Function checks user subscriptions and preferences
4. Function sends push notification via OneSignal API
5. OneSignal delivers notification to user's device

### Shared Utilities (`netlify/functions/utils/notificationHelpers.ts`)

All notification functions use shared utilities for consistency:

- **`isSubscribed(playerId, appId, restKey)`** - Checks if a device is subscribed in OneSignal
- **`loadUserNotificationPreferences(userIds)`** - Loads user preferences from database
- **`shouldSendNotification(userId, playerId, notificationType, ...)`** - Unified check combining subscription + preferences
- **`filterEligiblePlayerIds(userIds, playerIdsByUser, notificationType, ...)`** - Batch filtering for efficiency

---

## Notification Types

### 1. Score Updates (`score-updates`)
**Function:** `sendScoreNotificationsWebhook.ts`  
**Trigger:** Supabase webhook on `live_scores` table updates  
**Preference Key:** `score-updates`

**Sub-types:**
- **Goal Scored** - When a goal is scored in a live match
- **Goal Disallowed** - When a goal is disallowed (VAR)
- **Kickoff** - When a match starts (status changes from TIMED to IN_PLAY)
- **Half-Time** - When a match reaches half-time

**User Preference:** Can be disabled via `user_notification_preferences.preferences['score-updates'] = false`

---

### 2. Final Whistle (`final-whistle`)
**Function:** `sendScoreNotificationsWebhook.ts`  
**Trigger:** Supabase webhook on `live_scores` table updates  
**Preference Key:** `final-whistle`

**Description:** Sent when a match finishes (status changes to FINISHED)

**User Preference:** Can be disabled via `user_notification_preferences.preferences['final-whistle'] = false`

---

### 3. Gameweek Results Published (`gw-results`)
**Function:** `sendScoreNotificationsWebhook.ts`  
**Trigger:** Supabase webhook on `live_scores` table updates  
**Preference Key:** `gw-results`

**Description:** Sent when all matches in a gameweek are finished and results are published

**User Preference:** Can be disabled via `user_notification_preferences.preferences['gw-results'] = false`

---

### 4. New Gameweek Published (`new-gameweek`)
**Function:** `sendPushAll.ts`  
**Trigger:** Manual call from API Admin when new gameweek is published  
**Preference Key:** `new-gameweek`

**Description:** Broadcast notification to all users when a new gameweek is published

**User Preference:** Can be disabled via `user_notification_preferences.preferences['new-gameweek'] = false`

---

### 5. Chat Messages (`chat-messages`)
**Function:** `notifyLeagueMessage.ts`  
**Trigger:** Manual call from client when user sends a chat message  
**Preference Key:** `chat-messages`

**Description:** Notifies league members when someone posts a message in the mini-league chat

**User Preference:** Can be disabled via `user_notification_preferences.preferences['chat-messages'] = false`

**Note:** Does not notify the sender

---

### 6. All Members Submitted (`final-submission`)
**Function:** `notifyFinalSubmission.ts`  
**Trigger:** Manual call from client when all league members submit predictions  
**Preference Key:** None (no preference check)

**Description:** Notifies league members when everyone in the league has submitted their predictions

**User Preference:** No preference check (always sent if subscribed)

---

## Core Functions

### Production Functions

#### 1. `sendScoreNotificationsWebhook.ts`
**Purpose:** Handles all score-related notifications  
**Trigger:** Supabase webhook on `live_scores` table  
**Notification Types:** `score-updates`, `final-whistle`, `gw-results`

**Key Features:**
- Handles missing `old_record` in webhook payload by querying `notification_state` table
- Prevents duplicate notifications using `notification_state` table
- Checks user preferences before sending
- Formats match information (teams, scores, minutes)

**Flow:**
1. Receive webhook payload with `new_record` (and optionally `old_record`)
2. Determine notification type based on status changes
3. Query `notification_state` to prevent duplicates
4. Load user preferences for affected users
5. Filter eligible users (subscribed + preferences enabled)
6. Send notifications via OneSignal
7. Update `notification_state` to mark as sent

---

#### 2. `notifyLeagueMessage.ts`
**Purpose:** Sends chat message notifications  
**Trigger:** Manual POST from client  
**Notification Type:** `chat-messages`

**Key Features:**
- Authenticates sender via JWT token
- Excludes sender from notification recipients
- Checks user preferences (`chat-messages`)
- Includes deep link to league chat

**Flow:**
1. Authenticate sender
2. Get league members
3. Filter out sender
4. Load user preferences
5. Filter eligible users (subscribed + preferences enabled)
6. Send notifications via OneSignal

---

#### 3. `notifyFinalSubmission.ts`
**Purpose:** Notifies when all league members submit  
**Trigger:** Manual POST from client  
**Notification Type:** `final-submission`

**Key Features:**
- No preference check (always sent if subscribed)
- Checks subscription status only

**Flow:**
1. Get league members
2. Filter to subscribed users only
3. Send notifications via OneSignal

---

#### 4. `sendPushAll.ts`
**Purpose:** Broadcast notifications to all users  
**Trigger:** Manual POST from API Admin  
**Notification Type:** `new-gameweek` (or custom)

**Key Features:**
- Fetches all active/subscribed devices from database
- Verifies subscription status with OneSignal
- Checks user preferences for `new-gameweek` notifications
- Updates database subscription status

**Flow:**
1. Fetch all candidate devices from database
2. Verify subscription status with OneSignal
3. Load user preferences if `new-gameweek` type
4. Filter eligible users (subscribed + preferences enabled)
5. Send notifications via OneSignal
6. Update database with latest subscription status

---

#### 5. `registerPlayer.ts`
**Purpose:** Registers a user's device with OneSignal  
**Trigger:** Manual POST from client  
**Notification Type:** None (registration only)

**Key Features:**
- Registers device with OneSignal
- Stores device info in `push_subscriptions` table
- Links device to user account

**Flow:**
1. Receive device registration request
2. Register with OneSignal API
3. Store in `push_subscriptions` table
4. Return success/failure

---

### Supporting Functions

#### `pollLiveScores.ts`
**Purpose:** Polls external API for live score updates  
**Trigger:** Scheduled (every minute)  
**Notification Type:** None (updates database only)

**Note:** This function updates the `live_scores` table, which triggers webhooks that call `sendScoreNotificationsWebhook.ts`

---

### Diagnostic Functions

All diagnostic functions now accept `userId` as a parameter (no hardcoded user IDs):

- **`testCarlNotification.ts`** - Test notification to specific user (`?userId=...`)
- **`diagnoseCarlNotifications.ts`** - Diagnose user's notification setup (`?userId=...` or `?userIds=id1,id2`)
- **`forceCarlSubscription.ts`** - Attempt to force subscription status (`?userId=...`)
- **`checkJofDevices.ts`** - Check user's devices (`?userId=...`)
- **`checkCarlPlayerId.ts`** - Check OneSignal player status (`?playerId=...`)
- **`listSubscriptions.ts`** - List all subscriptions
- **`testNotificationAll.ts`** - Test notification to all users
- **`checkMySubscription.ts`** - Check current user's subscription (requires auth)

---

## User Preferences System

### Database Table: `user_notification_preferences`

**Schema:**
```sql
user_id (uuid, primary key)
preferences (jsonb) - Object with notification type keys and boolean values
created_at (timestamp)
updated_at (timestamp)
```

**Preference Keys:**
- `score-updates` (boolean) - Score update notifications
- `chat-messages` (boolean) - Chat message notifications
- `new-gameweek` (boolean) - New gameweek published notifications
- `gw-results` (boolean) - Gameweek results published notifications
- `final-whistle` (boolean) - Match finished notifications

**Default Behavior:** If a preference is not set or `null`, notifications are **enabled** (opt-out system)

**Disabling Notifications:** Set preference to `false` to disable

---

## Database Schema

### `push_subscriptions`
Stores device registration information:
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to users)
- `player_id` (text) - OneSignal Player ID
- `platform` (text) - 'ios', 'android', etc.
- `is_active` (boolean) - Device is active
- `subscribed` (boolean) - Device is subscribed in OneSignal
- `last_checked_at` (timestamp) - Last time subscription was verified
- `last_active_at` (timestamp) - Last time device was active
- `created_at` (timestamp)
- `os_payload` (jsonb) - Full OneSignal player data

### `notification_state`
Prevents duplicate notifications:
- `id` (uuid, primary key)
- `marker_id` (text) - Unique identifier for the notification event
- `notification_type` (text) - Type of notification
- `user_id` (uuid) - User who received notification
- `sent_at` (timestamp) - When notification was sent
- `created_at` (timestamp)

**Marker ID Format:** `{notification_type}:{unique_event_id}`  
Example: `goal-scored:match-123:minute-45`

### `user_notification_preferences`
User notification preferences (see above)

---

## Notification Flow Examples

### Score Update Flow

```
1. External API updates match score
   ↓
2. pollLiveScores.ts runs (scheduled, every minute)
   ↓
3. Updates live_scores table in Supabase
   ↓
4. Supabase webhook triggers sendScoreNotificationsWebhook.ts
   ↓
5. Function determines notification type (goal scored, kickoff, etc.)
   ↓
6. Checks notification_state to prevent duplicates
   ↓
7. Loads user preferences for affected users
   ↓
8. Filters eligible users (subscribed + preferences enabled)
   ↓
9. Sends push notifications via OneSignal API
   ↓
10. Updates notification_state to mark as sent
```

### Chat Message Flow

```
1. User sends message in league chat (client-side)
   ↓
2. Client calls notifyLeagueMessage.ts
   ↓
3. Function authenticates sender
   ↓
4. Gets league members (excludes sender)
   ↓
5. Loads user preferences
   ↓
6. Filters eligible users (subscribed + chat-messages enabled)
   ↓
7. Sends push notifications via OneSignal API
```

### New Gameweek Published Flow

```
1. Admin publishes new gameweek in API Admin
   ↓
2. API Admin calls sendPushAll.ts with type='new-gameweek'
   ↓
3. Function fetches all active devices from database
   ↓
4. Verifies subscription status with OneSignal
   ↓
5. Loads user preferences for all users
   ↓
6. Filters eligible users (subscribed + new-gameweek enabled)
   ↓
7. Sends push notifications via OneSignal API
   ↓
8. Updates database subscription status
```

---

## Current Status

### ✅ Completed

- [x] Unified notification system (push-only)
- [x] Shared utilities for subscription and preference checking
- [x] User preference system implemented
- [x] Duplicate prevention via `notification_state` table
- [x] All hardcoded user IDs removed
- [x] Diagnostic functions accept `userId` parameter
- [x] Webhook handling for score updates
- [x] Preference checks for all notification types
- [x] Proper error handling and logging

### ⚠️ Known Limitations

1. **Email Preferences Not Wired Up** - Email preferences page exists but not connected to backend
2. **No Monitoring/Alerting** - No automated alerts for notification failures
3. **No Retry Logic** - Failed notifications are not retried
4. **Limited Analytics** - No tracking of notification delivery rates

### 🔄 Future Improvements

- [ ] Wire up email preferences to backend
- [ ] Add monitoring/alerting for notification failures
- [ ] Implement retry logic for failed notifications
- [ ] Add analytics dashboard for notification metrics
- [ ] Add rate limiting to prevent spam
- [ ] Add notification history/audit log
- [ ] Organize diagnostic functions into subdirectory
- [ ] Add automated tests for notification logic

---

## Environment Variables

Required environment variables:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)
- `ONESIGNAL_APP_ID` - OneSignal application ID
- `ONESIGNAL_REST_API_KEY` - OneSignal REST API key

---

## Testing

### Test Notification to Specific User
```bash
curl -X POST "https://your-site.netlify.app/.netlify/functions/testCarlNotification?userId=<user-id>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "message": "Test notification"}'
```

### Test Notification to All Users
```bash
curl -X POST "https://your-site.netlify.app/.netlify/functions/testNotificationAll"
```

### List All Subscriptions
```bash
curl "https://your-site.netlify.app/.netlify/functions/listSubscriptions"
```

### Diagnose User's Notifications
```bash
curl "https://your-site.netlify.app/.netlify/functions/diagnoseCarlNotifications?userId=<user-id>"
```

---

## Conclusion

The notification system is **production-ready** and follows best practices:
- ✅ Single source of truth for subscription checking
- ✅ Unified preference system
- ✅ No code duplication
- ✅ No hardcoded user IDs
- ✅ Proper error handling
- ✅ Duplicate prevention
- ✅ User preference support

The system is maintainable, scalable, and ready for production use.
