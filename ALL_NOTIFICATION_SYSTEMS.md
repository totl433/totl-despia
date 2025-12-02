# All Notification Systems in TOTL App

This document lists **all systems that send notifications** in the TOTL application.

---

## Summary Table

| System | Type | Trigger | Function/File | Delivery Method |
|--------|------|---------|---------------|-----------------|
| **1. League Chat Messages** | Push | User sends message | `notifyLeagueMessage.ts` | OneSignal API |
| **2. Final Submission (All Members)** | Push | All league members submit | `notifyFinalSubmission.ts` | OneSignal API |
| **3. Score Updates (Goals)** | Push | Goal scored (webhook) | `sendScoreNotificationsWebhook.ts` | OneSignal API |
| **4. Score Updates (Scheduled)** | Push | Scheduled polling | `sendScoreNotifications.ts` | OneSignal API |
| **5. Kickoff Notifications** | Push | Game starts | `sendScoreNotificationsWebhook.ts` | OneSignal API |
| **6. Half-Time Notifications** | Push | Half-time reached | `sendScoreNotificationsWebhook.ts` | OneSignal API |
| **7. Full-Time Notifications** | Push | Game finishes | `sendScoreNotificationsWebhook.ts` | OneSignal API |
| **8. End of Game Week** | Push | All games finished | `sendScoreNotificationsWebhook.ts` | OneSignal API |
| **9. Broadcast (All Users)** | Push | Admin action | `sendPushAll.ts` | OneSignal API |
| **10. Gameweek Published** | Push | Admin publishes GW | `sendPushAll.ts` | OneSignal API |
| **11. Targeted Push** | Push | Manual/API call | `sendPush.ts` | OneSignal API |
| **11. Deadline Reminder** | Local | 2h before deadline | `notifications.ts` | Despia SDK |
| **12. Game Week Starting Soon** | Local | 10min before kickoff | `notifications.ts` | Despia SDK |
| **13. Game Starting Now** | Local | At kickoff time | `notifications.ts` | Despia SDK |

---

## 1. Push Notifications (Server-Side via OneSignal)

All push notifications use **OneSignal REST API** and require:
- Device registration (`push_subscriptions` table)
- Subscription verification (checks OneSignal API)
- OneSignal credentials (`ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`)

### 1.1 League Chat Messages
**Function:** `netlify/functions/notifyLeagueMessage.ts`

**Trigger:**
- User sends a message in a mini-league chat
- Called from `src/pages/League.tsx` - `sendChat()` function
- Called from `src/components/MiniLeagueChatBeta.tsx` - chat component

**Notification:**
```
Title: "{senderName} in {leagueName}"
Message: "{message content}"
```

**Recipients:**
- All league members (excluding sender)
- Excludes muted users (checks `league_notification_settings` table)
- Only sends to subscribed devices (verifies with OneSignal API)

**Duplicate Prevention:**
- One message = one notification (no duplicates possible)
- Respects user mute settings

---

### 1.2 Final Submission (All Members Submitted)
**Function:** `netlify/functions/notifyFinalSubmission.ts`

**Trigger:**
- Called when a user submits predictions
- Checks if all league members have submitted
- Called from:
  - `src/pages/TestApiPredictions.tsx` (line 1371)
  - `src/pages/NewPredictionsCentre.tsx` (line 910)
  - `src/pages/Predictions.tsx` (line 405)

**Notification:**
```
Title: "All predictions submitted! 🎉"
Message: "Everyone in {leagueName} has submitted for {GW/matchday}. Check out who picked what!"
```

**Recipients:**
- All league members
- Only sends if ALL members have submitted

**Duplicate Prevention:**
- Uses `notification_state` table with special marker ID
- Marker: `888888 - matchday - (leagueId hash % 10000)`
- Checks marker before sending

---

### 1.3 Score Update Notifications (Goals)
**Function:** `netlify/functions/sendScoreNotificationsWebhook.ts`

**Trigger:**
- **Automatic webhook** from Supabase when `live_scores` table is updated
- Supabase webhook configured to call this function on `UPDATE` events
- Also triggered by `pollLiveScores` function when it updates scores

**Notification Types:**

**A. Goal Scored:**
```
Title: "⚽ GOAL! {Home Team} {homeScore}-{awayScore} {Away Team}"
Message: "{minute}'" (e.g., "23'", "HT", "Second Half")
```

**B. Kickoff:**
```
Title: "{Home Team} vs {Away Team} is starting!"
Message: "The game is kicking off now!"
```

**C. Half-Time:**
```
Title: "HT: {Home Team} {homeScore}-{awayScore} {Away Team}"
Message: "Half-time update"
```

**D. Full-Time:**
```
Title: "FT: {Home Team} {homeScore}-{awayScore} {Away Team}"
Message: "✅ Got it right!" OR "❌ Wrong pick"
```

**E. End of Game Week:**
```
Title: "Game Week {gameweek} Ended! 🏆"
Message: "You scored {score}/{total}! Check out how you did!"
```

**Recipients:**
- Users who have picks for the specific fixture
- Only sends to subscribed devices

**Duplicate Prevention:**
- Uses `notification_state` table to track:
  - Last notified scores (`last_notified_home_score`, `last_notified_away_score`)
  - Last notified goals (`last_notified_goals`)
  - Last notified status (`last_notified_status`)
  - Timestamp (`last_notified_at`)
- Only sends if:
  - Score changed (home_score or away_score)
  - New goals detected (compares goal arrays)
  - Status changed (e.g., SCHEDULED → IN_PLAY, IN_PLAY → FINISHED)
- Early skip check: If same goals notified within last minute, skips immediately

**Webhook Setup:**
- Supabase Dashboard → Database → Webhooks
- Webhook name: `live_scores_notifications`
- Table: `live_scores`
- Events: `UPDATE`, `INSERT`
- URL: `https://totl-staging.netlify.app/.netlify/functions/sendScoreNotificationsWebhook`

---

### 1.4 Score Update Notifications (Scheduled)
**Function:** `netlify/functions/sendScoreNotifications.ts`

**Trigger:**
- Can be called manually or via scheduled cron job
- Checks `live_scores` table for score changes
- Alternative to webhook-based notifications

**Notification Types:**
- Same as `sendScoreNotificationsWebhook.ts` (goals, kickoff, half-time, full-time, end of GW)

**Recipients:**
- Users who have picks for fixtures with score changes
- Only sends to subscribed devices

**Duplicate Prevention:**
- Uses `notification_state` table (same as webhook version)

---

### 1.5 Broadcast Notifications (All Users)
**Function:** `netlify/functions/sendPushAll.ts`

**Trigger:**
- Manual trigger from Admin page
- Used when publishing fixtures or results
- Can be called via API

**Notification Examples:**
```
Title: "GW{gameweek} Results Published"
Message: "Game Week {gameweek} results are in! Check your scores!"
```

**Recipients:**
- All subscribed users (broadcast)
- Verifies subscriptions with OneSignal API before sending

**Duplicate Prevention:**
- Manual trigger only (no automatic scheduling)

---

### 1.6 Gameweek Published Notifications
**Function:** `netlify/functions/sendPushAll.ts`

**Trigger:**
- Automatically triggered when a new gameweek is published
- Called from `src/pages/Admin.tsx` - `activateGameweek()` function
- Called from `src/pages/ApiAdmin.tsx` - `saveGameweek()` function

**Notification:**
```
Title: "GAME WEEK {gameweek} - FIXTURES ARE OUT!"
Message: "Make your predictions now!"
```

**Recipients:**
- All subscribed users (broadcast)
- Verifies subscriptions with OneSignal API before sending

**When:**
- When Admin publishes fixtures via regular Admin page
- When API Admin saves a new gameweek with fixtures

**Duplicate Prevention:**
- One notification per gameweek publication (manual trigger)

---

### 1.7 Targeted Push Notifications
**Function:** `netlify/functions/sendPush.ts`

**Trigger:**
- Manual/API call
- Can target specific users by `playerIds` or `subscriptionIds`

**Notification:**
```
Title: Custom
Message: Custom
```

**Recipients:**
- Specified Player IDs or Subscription IDs
- Supports both legacy OneSignal SDK (`player_ids`) and v5+ SDK (`subscription_ids`)

---

## 2. Local Notifications (Client-Side via Despia SDK)

These are scheduled on the device and sent even when the app is closed. They use the **Despia SDK** (`despia-native`).

## 2. Local Notifications (Client-Side via Despia SDK)

These are scheduled on the device and sent even when the app is closed. They use the **Despia SDK** (`despia-native`).

### 2.1 Deadline Reminder
**File:** `src/lib/notifications.ts` - `scheduleDeadlineReminder()`

**Trigger:**
- Scheduled in `src/pages/Home.tsx` when fixtures are loaded
- Only for API Test league users
- Only scheduled once per gameweek

**Notification:**
```
Title: "GW{gameweek} Deadline Reminder"
Message: "Don't forget to submit your predictions! Deadline in 2 hours."
Deep Link: /test-api-predictions
```

**When:**
- 2 hours before the gameweek deadline (75 minutes before first kickoff)

**Duplicate Prevention:**
- Uses `deadlineReminderScheduledRef` ref to prevent re-scheduling
- Only schedules if ref is `false`
- Sets ref to `true` after scheduling

---

### 2.2 Game Week Starting Soon
**File:** `src/lib/notifications.ts` - `scheduleGameweekStartingSoon()`

**Trigger:**
- Scheduled in `src/pages/Home.tsx` when fixtures are loaded
- Only for API Test league users
- Only scheduled once per gameweek

**Notification:**
```
Title: "Gameweek {gameweek} Starting Soon! ⚽"
Message: "The action begins in 10 minutes! Get ready for some football magic! 🎯"
Deep Link: /league/api-test
```

**When:**
- 10 minutes before the first kickoff

**Duplicate Prevention:**
- Uses `localStorage` with key: `scheduled_gw_starting_soon_gw{gameweek}-{firstKickoffTime}`
- Checks localStorage before scheduling
- If scheduled within last 24 hours, skips
- Stores timestamp in localStorage after scheduling
- Cleans up old entries (>7 days)

---

### 2.3 Game Starting Now
**File:** `src/lib/notifications.ts` - `scheduleLiveGameNotification()`

**Trigger:**
- Scheduled in `src/pages/Home.tsx` when fixtures are loaded
- One notification per fixture
- Only for fixtures whose kickoff is in the future

**Notification:**
```
Title: "Game Starting Now!"
Message: "{Home Team} vs {Away Team} is kicking off now!"
Deep Link: /league/api-test
```

**When:**
- Exactly at kickoff time for each game

**Duplicate Prevention:**
- Uses `localStorage` with key: `scheduled_game_notification_{kickoffTime}-{homeTeam}-{awayTeam}`
- Checks localStorage before scheduling
- If scheduled within last 24 hours, skips
- Stores timestamp in localStorage after scheduling
- Cleans up old entries (>7 days)

---

## 3. Supporting Systems

### 3.1 Device Registration
**Function:** `netlify/functions/registerPlayer.ts`

**Purpose:**
- Registers OneSignal Player ID in `push_subscriptions` table
- Called automatically from `src/context/AuthContext.tsx` when user logs in
- Stores `(user_id, player_id, platform)` in database

**Duplicate Prevention:**
- Database unique constraint on `(user_id, player_id)`
- Uses `upsert` to update existing records

---

### 3.2 Subscription Verification
**Used by:** All push notification functions

**Process:**
1. Query `push_subscriptions` table for Player IDs
2. Call OneSignal API to verify device is actually subscribed
3. Filter to only subscribed devices
4. Send notifications only to verified subscribers

**Functions that verify:**
- `sendPushAll.ts`
- `sendScoreNotifications.ts`
- `sendScoreNotificationsWebhook.ts`
- `notifyLeagueMessage.ts`
- `notifyFinalSubmission.ts`

---

### 3.3 Notification State Tracking
**Table:** `notification_state`

**Purpose:**
- Tracks what notifications have been sent to prevent duplicates
- Stores last notified scores, goals, status, and timestamp

**Schema:**
- `api_match_id` (primary key) - Match ID or special marker
- `last_notified_home_score` - Last home score notified
- `last_notified_away_score` - Last away score notified
- `last_notified_goals` - Last goals array notified (JSON)
- `last_notified_status` - Last status notified
- `last_notified_at` - Timestamp of last notification

**Special Marker IDs:**
- `999999 - gameweek` - End-of-gameweek notification marker
- `888888 - matchday - (leagueId hash % 10000)` - Final submission notification marker

---

## 4. Notification Flow Diagrams

### 4.1 Chat Notification Flow
```
User sends message
  ↓
League.tsx → sendChat()
  ↓
Insert into league_messages table
  ↓
Call /.netlify/functions/notifyLeagueMessage
  ↓
Function:
  1. Get league members (exclude sender)
  2. Filter muted users
  3. Get Player IDs from push_subscriptions
  4. Verify subscriptions with OneSignal API
  5. Send via OneSignal API
```

### 4.2 Score Update Flow
```
pollLiveScores runs (every minute)
  ↓
Updates live_scores table
  ↓
Supabase webhook triggers automatically
  ↓
Calls /.netlify/functions/sendScoreNotificationsWebhook
  ↓
Function:
  1. Parse webhook payload
  2. Detect score/goal/status changes
  3. Check notification_state (prevent duplicates)
  4. Get users with picks for this fixture
  5. Verify subscriptions
  6. Send goal/kickoff/half-time/full-time notifications
  7. Update notification_state
```

### 4.3 Final Submission Flow
```
User submits predictions
  ↓
Insert into app_gw_submissions table
  ↓
Call /.netlify/functions/notifyFinalSubmission
  ↓
Function:
  1. Check if all league members submitted
  2. Check notification_state marker (prevent duplicates)
  3. Get Player IDs for all league members
  4. Verify subscriptions
  5. Send "All predictions submitted!" notification
  6. Update notification_state marker
```

---

## 5. Environment Variables Required

All push notification functions require:
- `ONESIGNAL_APP_ID` - OneSignal App ID
- `ONESIGNAL_REST_API_KEY` - OneSignal REST API Key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for database access)
- `SUPABASE_ANON_KEY` - Supabase anon key (for user verification in some functions)

---

## 6. Database Tables

### 6.1 `push_subscriptions`
Stores OneSignal Player IDs per user
- `user_id` (uuid)
- `player_id` (text) - OneSignal Player ID
- `platform` (text) - 'ios' | 'android'
- `is_active` (boolean)
- `subscribed` (boolean) - Subscription status from OneSignal
- `last_checked_at` (timestamptz) - Last time subscription was verified

### 6.2 `notification_state`
Tracks sent notifications to prevent duplicates
- `api_match_id` (bigint, primary key) - Match ID or special marker
- `last_notified_home_score` (integer)
- `last_notified_away_score` (integer)
- `last_notified_goals` (jsonb) - Array of goals
- `last_notified_status` (text)
- `last_notified_at` (timestamptz)

### 6.3 `league_notification_settings`
User mute preferences per league
- `user_id` (uuid)
- `league_id` (uuid)
- `muted` (boolean) - If true, user won't receive chat notifications

---

## 7. Files Reference

### Push Notification Functions
- `netlify/functions/notifyLeagueMessage.ts` - Chat notifications
- `netlify/functions/notifyFinalSubmission.ts` - Final submission notifications
- `netlify/functions/sendScoreNotificationsWebhook.ts` - Score updates (webhook-triggered)
- `netlify/functions/sendScoreNotifications.ts` - Score updates (scheduled)
- `netlify/functions/sendPushAll.ts` - Broadcast to all users
- `netlify/functions/sendPush.ts` - Targeted push notifications
- `netlify/functions/registerPlayer.ts` - Device registration

### Local Notification Functions
- `src/lib/notifications.ts` - All local notification scheduling
- `src/pages/Home.tsx` - Schedules local notifications when fixtures load

### Client-Side Triggers
- `src/pages/League.tsx` - Calls `notifyLeagueMessage` when sending chat
- `src/components/MiniLeagueChatBeta.tsx` - Calls `notifyLeagueMessage` when sending chat
- `src/pages/TestApiPredictions.tsx` - Calls `notifyFinalSubmission` after submission
- `src/pages/NewPredictionsCentre.tsx` - Calls `notifyFinalSubmission` after submission
- `src/pages/Predictions.tsx` - Calls `notifyFinalSubmission` after submission
- `src/context/AuthContext.tsx` - Auto-registers Player IDs on login

### Database Setup
- `supabase/sql/push_subscriptions.sql` - Push subscription table schema
- `supabase/sql/league_notification_settings.sql` - Mute settings table
- `supabase/sql/create_live_scores_webhook.sql` - Webhook setup SQL (reference)

---

## 8. Testing & Debugging

### Test Push Notifications
- Use Admin page to trigger broadcast notifications
- Check Netlify function logs for delivery status
- Verify OneSignal dashboard shows notifications sent

### Test Local Notifications
- Open app in API Test league
- Check console logs for scheduling messages
- Verify localStorage entries

### Debug Endpoints
- `/.netlify/functions/sendPush?debug=1` - Check OneSignal config
- `/.netlify/functions/sendPushAll?debug=1` - Check broadcast config
- `/.netlify/functions/notifyLeagueMessage?debug=1` - Check chat notification config

---

## Summary

**Total Notification Systems: 14**

- **10 Push Notification Systems** (via OneSignal API)
- **3 Local Notification Systems** (via Despia SDK)
- **1 Device Registration System** (supporting)

All systems include duplicate prevention mechanisms to ensure users don't receive the same notification multiple times.

