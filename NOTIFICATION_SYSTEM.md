# Notification System Documentation

This document explains all notification types in the TOTL app, what triggers them, and how duplicates are prevented.

## Overview

The app uses **two notification systems**:
1. **Local Notifications** (Client-side, scheduled) - Using Despia SDK
2. **Push Notifications** (Server-side, OneSignal) - Via Netlify Functions

---

## 1. Local Notifications (Client-Side)

These are scheduled on the device and sent even when the app is closed. They use the Despia SDK (`despia-native`).

### 1.1 Deadline Reminder ⏰

**When:** 2 hours before the gameweek deadline (75 minutes before first kickoff)

**Trigger:**
- Scheduled in `src/pages/Home.tsx` when fixtures are loaded
- Only for API Test league users
- Only scheduled once per gameweek (fixture_index === 0)

**Notification:**
```
Title: "GW{gameweek} Deadline Reminder"
Message: "Don't forget to submit your predictions! Deadline in 2 hours."
Deep Link: /test-api-predictions
```

**Duplicate Prevention:**
- ✅ Uses `deadlineReminderScheduledRef` ref to prevent re-scheduling
- ✅ Only schedules if ref is `false`
- ✅ Sets ref to `true` after scheduling
- ✅ Persists across page reloads (ref survives component re-renders)

**Code Location:**
- `src/pages/Home.tsx` (line ~732)
- `src/lib/notifications.ts` - `scheduleDeadlineReminder()`

---

### 1.2 Game Week Starting Soon 🚀

**When:** 10 minutes before the first kickoff

**Trigger:**
- Scheduled in `src/pages/Home.tsx` when fixtures are loaded
- Only for API Test league users
- Only scheduled once per gameweek (fixture_index === 0)

**Notification:**
```
Title: "Gameweek {gameweek} Starting Soon! ⚽"
Message: "The action begins in 10 minutes! Get ready for some football magic! 🎯"
Deep Link: /league/api-test
```

**Duplicate Prevention:**
- ✅ Uses `gameweekStartingSoonScheduledRef` ref to prevent re-scheduling
- ✅ Only schedules if ref is `false`
- ✅ Sets ref to `true` after scheduling

**Code Location:**
- `src/pages/Home.tsx` (line ~735)
- `src/lib/notifications.ts` - `scheduleGameweekStartingSoon()`

---

### 1.3 Game Starting Now ⚽

**When:** Exactly at kickoff time for each game

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

**Duplicate Prevention:**
- ✅ Uses `localStorage` with key: `scheduled_game_notification_{kickoffTime}-{homeTeam}-{awayTeam}`
- ✅ Checks localStorage before scheduling
- ✅ If scheduled within last 24 hours, skips
- ✅ Stores timestamp in localStorage after scheduling
- ✅ Cleans up old entries (>7 days) to prevent bloat

**Code Location:**
- `src/pages/Home.tsx` (line ~726)
- `src/lib/notifications.ts` - `scheduleLiveGameNotification()`

---

## 2. Push Notifications (Server-Side)

These are sent via OneSignal API from Netlify Functions. They require device registration and subscription.

### 2.1 Broadcast Notifications (All Users)

**Function:** `netlify/functions/sendPushAll.ts`

**Trigger:**
- Manually called from Admin page when publishing fixtures/results
- Can be triggered via API call

**Notification Examples:**
```
Title: "GW{gameweek} Published"
Message: "Game Week {gameweek} fixtures are live. Make your predictions!"
```

**Duplicate Prevention:**
- ✅ Manual trigger only (no automatic scheduling)
- ✅ Admin must explicitly click "Publish" button
- ✅ No automatic duplicate prevention needed (one-time action)

**Code Location:**
- `netlify/functions/sendPushAll.ts`
- `src/pages/Admin.tsx` - "Publish Fixtures" / "Publish Results" buttons

---

### 2.2 Score Update Notifications 📊

**Function:** `netlify/functions/sendScoreNotifications.ts`

**Trigger:**
- Scheduled function (can be called manually or via cron)
- Checks `live_scores` table for score changes
- Only sends when scores actually change

**Notification Types:**

**A. Goal/Score Change (Live Game):**
```
Title: "⚽ GOAL! {Home Team} {homeScore}-{awayScore} {Away Team}"
Message: "{minute}'" (e.g., "23'", "HT", "Second Half")
```

**B. Full Time (Game Finished):**
```
Title: "FT: {Home Team} {homeScore}-{awayScore} {Away Team}"
Message: "✅ Got it right!" OR "❌ Wrong pick"
```

**C. Game Week Complete:**
```
Title: "Game Week {gameweek} Ended! 🏆"
Message: "You scored {score}/{total}! Check out how you did!"
```

**Duplicate Prevention:**
- ✅ Uses `notification_state` table to track last notified scores
- ✅ Only sends if `home_score` or `away_score` changed since last notification
- ✅ Only sends if game status changed to "FINISHED" (for FT notifications)
- ✅ End-of-GW notification uses special marker ID `999999 - gameweek` in `notification_state`
- ✅ Checks marker before sending end-of-GW notification

**Code Location:**
- `netlify/functions/sendScoreNotifications.ts`

---

### 2.3 League Chat Notifications 💬

**Function:** `netlify/functions/notifyLeagueMessage.ts`

**Trigger:**
- Automatically called when a message is posted to a league chat
- Triggered from `src/pages/League.tsx` - `sendChat()` function

**Notification:**
```
Title: "{senderName} in {leagueName}"
Message: "{message content}"
```

**Duplicate Prevention:**
- ✅ Only sends to league members (excludes sender)
- ✅ Respects user mute settings (checks `league_members.muted` flag)
- ✅ One notification per message (no duplicate prevention needed - one message = one notification)

**Code Location:**
- `netlify/functions/notifyLeagueMessage.ts`
- `src/pages/League.tsx` - `sendChat()` function

---

### 2.4 Final Submission Notifications 🎉

**Function:** `netlify/functions/notifyFinalSubmission.ts`

**Trigger:**
- Can be called manually or via database trigger
- Checks if all league members have submitted predictions

**Notification:**
```
Title: "All predictions submitted! 🎉"
Message: "Everyone in {leagueName} has submitted for {GW/matchday}. Check out who picked what!"
```

**Duplicate Prevention:**
- ✅ Uses `notification_state` table with special marker ID
- ✅ Marker ID: `888888 - matchday - (leagueId hash % 10000)`
- ✅ Checks if notification already sent before sending
- ✅ Stores marker in `notification_state` after sending

**Code Location:**
- `netlify/functions/notifyFinalSubmission.ts`

---

## 3. Subscription Management

### Device Registration

**Function:** `netlify/functions/registerPlayer.ts`

**Trigger:**
- Called when user opens app (if not already registered)
- Stores OneSignal Player ID in `push_subscriptions` table

**Duplicate Prevention:**
- ✅ Database unique constraint on `(user_id, player_id)`
- ✅ Uses `upsert` to update existing records

---

### Subscription Verification

All push notification functions verify subscriptions before sending:

1. **Check Database:** Look up Player IDs in `push_subscriptions` table
2. **Verify with OneSignal:** Call OneSignal API to check if device is actually subscribed
3. **Filter:** Only send to devices that are:
   - In database (`is_active = true`)
   - Verified as subscribed by OneSignal API
   - Not marked as invalid

**Functions that verify subscriptions:**
- `sendPushAll.ts` - Verifies all Player IDs before broadcast
- `sendScoreNotifications.ts` - Verifies Player IDs for users with picks
- `notifyLeagueMessage.ts` - Verifies Player IDs for league members
- `notifyFinalSubmission.ts` - Verifies Player IDs for league members

---

## 4. Notification State Tracking

The `notification_state` table tracks what has been sent to prevent duplicates:

**Schema:**
- `api_match_id` (primary key) - Match ID or special marker
- `last_notified_home_score` - Last home score we notified about
- `last_notified_away_score` - Last away score we notified about
- `last_notified_status` - Last status we notified about
- `last_notified_at` - Timestamp of last notification

**Special Marker IDs:**
- `999999 - gameweek` - End-of-gameweek notification marker
- `888888 - matchday - (leagueId hash)` - Final submission notification marker

---

## 5. Best Practices & Notes

### Local Notifications
- ✅ Maximum scheduling window: 7 days
- ✅ localStorage cleanup: Removes entries older than 7 days
- ✅ Refs prevent duplicate scheduling on component re-renders

### Push Notifications
- ✅ Always verify subscriptions before sending
- ✅ Use `notification_state` table to track what's been sent
- ✅ Use special marker IDs for one-time notifications (end-of-GW, final submission)
- ✅ Filter out invalid/unsubscribed devices

### Common Issues Fixed
1. **38 deadline notifications** - Fixed by adding `deadlineReminderScheduledRef` to prevent re-scheduling
2. **Duplicate score notifications** - Fixed by tracking last notified scores in `notification_state`
3. **Unsubscribed device errors** - Fixed by verifying subscriptions with OneSignal API before sending

---

## 6. Testing Notifications

### Test Local Notifications
- Open app in API Test league
- Check console logs for scheduling messages
- Verify localStorage entries

### Test Push Notifications
- Use Admin page to publish fixtures/results
- Manually trigger `sendScoreNotifications` function
- Check Netlify function logs for delivery status

### Debug Endpoints
- `/.netlify/functions/sendPush?debug=1` - Check OneSignal config
- `/.netlify/functions/sendPushAll?debug=1` - Check broadcast config

---

## 7. File Locations

### Client-Side (Local Notifications)
- `src/lib/notifications.ts` - Notification utility functions
- `src/pages/Home.tsx` - Notification scheduling for API Test league

### Server-Side (Push Notifications)
- `netlify/functions/sendPush.ts` - Targeted push notifications
- `netlify/functions/sendPushAll.ts` - Broadcast to all users
- `netlify/functions/sendScoreNotifications.ts` - Score update notifications
- `netlify/functions/notifyLeagueMessage.ts` - League chat notifications
- `netlify/functions/notifyFinalSubmission.ts` - Final submission notifications
- `netlify/functions/registerPlayer.ts` - Device registration

### Database
- `supabase/sql/push_subscriptions.sql` - Push subscription table schema
- `notification_state` table - Tracks sent notifications (created via migrations)

---

## Summary

| Notification Type | System | Trigger | Duplicate Prevention |
|------------------|--------|---------|---------------------|
| Deadline Reminder | Local | Fixtures loaded | `deadlineReminderScheduledRef` ref |
| Game Week Starting Soon | Local | Fixtures loaded | `gameweekStartingSoonScheduledRef` ref |
| Game Starting Now | Local | Fixtures loaded | localStorage with timestamp |
| Broadcast (Fixtures/Results) | Push | Admin action | Manual trigger only |
| Score Updates | Push | Scheduled function | `notification_state` table |
| Full Time | Push | Score change to FINISHED | `notification_state` table |
| End of Game Week | Push | All games finished | Special marker in `notification_state` |
| League Chat | Push | Message posted | One message = one notification |
| Final Submission | Push | All members submitted | Special marker in `notification_state` |

