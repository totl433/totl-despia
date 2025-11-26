# Complete Notification System Breakdown

## Overview
The notification system uses **OneSignal** for push notifications, triggered by various Netlify functions. Notifications are sent to users who have:
1. Active push subscriptions in `push_subscriptions` table
2. Picks for the relevant fixtures/gameweeks

---

## Notification Sources & Types

### 1. **sendScoreNotifications** (Scheduled Function)
**Trigger:** Runs every minute via Netlify cron (`* * * * *`)  
**Location:** `netlify/functions/sendScoreNotifications.ts`  
**Purpose:** Polls `live_scores` table and sends notifications for score changes, kickoffs, and game finishes

#### Notifications Sent:

**a) 15-Minute Pre-Kickoff Notification**
- **When:** 14-16 minutes before fixture kickoff time
- **Title:** `⚽ [Home Team] vs [Away Team]`
- **Message:** `Fixture will start in 15 minutes!`
- **Who:** Users who have picks for that fixture
- **Deduplication:** Checks `notification_state.last_notified_status = 'PRE_KICKOFF_15MIN'`

**b) Kickoff Notifications**
- **When:** Game status changes to `IN_PLAY` with score 0-0
- **Single Game:**
  - **Title:** `⚽ [Home Team] vs [Away Team]`
  - **Message:** `Kickoff!`
- **Multiple Games (grouped by time slot):**
  - **Title:** `⚽ Games Starting!`
  - **Message:** `[N] games kicking off now`
- **Who:** Users who have picks for those fixtures
- **Deduplication:** Checks `notification_state.last_notified_status = 'IN_PLAY'` with score 0-0

**c) Goal Notifications**
- **When:** New goals detected (compares goal arrays to find new goals)
- **Title:** `⚽ GOAL! [Home Team] [score]-[score] [Away Team]`
- **Message:** `[Scorer Name] [minute]'`
- **Who:** Users who have picks for that fixture
- **Deduplication:** Compares goal hashes to detect only NEW goals

**d) Red Card Notifications**
- **When:** New red cards detected
- **Title:** `🟥 RED CARD! [Home Team] vs [Away Team]`
- **Message:** `[Player Name] ([Team]) [minute]'`
- **Who:** Users who have picks for that fixture
- **Deduplication:** Compares red card arrays to find new ones

**e) Game Finished Notifications**
- **When:** Game status changes to `FINISHED`
- **Title:** `FT: [Home Team] [score]-[score] [Away Team]`
- **Message:** `✅ Got it right!` or `❌ Wrong pick` (based on user's pick)
- **Who:** Users who have picks for that fixture
- **Deduplication:** Checks if status was already `FINISHED`

**f) Gameweek Complete Notification**
- **When:** ALL games in a GW are finished
- **Title:** `[GW Label] Ended! 🏆` (e.g., "GW 12 Ended! 🏆" or "Test GW 1 Ended! 🏆")
- **Message:** `You scored [X]/[Total]! Check out how you did!`
- **Who:** All users who have picks for that GW
- **Deduplication:** Uses special marker ID in `notification_state` (999999 - gw)

---

### 2. **sendScoreNotificationsWebhook** (Webhook Function)
**Trigger:** Called by Supabase database webhook when `live_scores` table is INSERTED or UPDATED  
**Location:** `netlify/functions/sendScoreNotificationsWebhook.ts`  
**Purpose:** Instant notifications when scores change (faster than scheduled polling)

#### Notifications Sent:

**a) Goal Notifications (Instant)**
- **When:** Webhook fires with new goals in payload
- **Title:** `[Team Name] scores!`
- **Message:** `[minute]' [Scorer Name]\n[Home Team] [score] - [score] [Away Team]`
- **Who:** Users who have picks for that fixture
- **Deduplication:** Compares goal hashes, skips if already notified within 2 minutes

**b) Kickoff Notifications (Instant)**
- **When:** Status changes from non-IN_PLAY to `IN_PLAY` with 0-0 score
- **Title:** `⚽ [Home Team] vs [Away Team]`
- **Message:** `Kickoff!`
- **Who:** Users who have picks for that fixture
- **Deduplication:** Checks `notification_state.last_notified_status = 'IN_PLAY'` with score 0-0

**c) Game Finished Notifications (Instant)**
- **When:** Status changes to `FINISHED`
- **Title:** `FT: [Home Team] [score]-[score] [Away Team]`
- **Message:** `✅ Got it right!` or `❌ Wrong pick`
- **Who:** Users who have picks for that fixture

**d) Gameweek Complete Notification (Instant)**
- **When:** Last game in GW finishes (all games are `FINISHED`)
- **Title:** `🎉 Gameweek [GW] Complete!`
- **Message:** `All games finished. Check your results!`
- **Who:** All users who have picks for that GW
- **Deduplication:** Checks `notification_state.last_notified_status = 'GW_FINISHED'` within last hour

---

### 3. **notifyLeagueMessage** (HTTP Function)
**Trigger:** Called manually when a league message is sent  
**Location:** `netlify/functions/notifyLeagueMessage.ts`  
**Purpose:** Notify league members about new chat messages

#### Notifications Sent:

**League Chat Message Notification**
- **When:** Someone sends a message in a league chat
- **Title:** `[Sender Name]` (or "New message" if no name)
- **Message:** First 180 characters of message content
- **Who:** All league members (except sender) who:
  - Have active push subscriptions
  - Haven't muted notifications for that league (`league_notification_settings.muted = false`)
- **Deduplication:** None (each message triggers a notification)

---

### 4. **notifyFinalSubmission** (HTTP Function)
**Trigger:** Called manually when user submits predictions (from `TestApiPredictions.tsx`)  
**Location:** `netlify/functions/notifyFinalSubmission.ts`  
**Purpose:** Notify league when all members have submitted

#### Notifications Sent:

**All Predictions Submitted Notification**
- **When:** Last member in a league submits their predictions
- **Title:** `All predictions submitted! 🎉`
- **Message:** `Everyone in [League Name] has submitted for [GW Label]. Check out who picked what!`
- **Who:** All league members who have active push subscriptions
- **Deduplication:** Uses special marker ID in `notification_state` (999999 - matchday - 200000)

---

## Notification Flow

### For Live Scores (Goals, Kickoffs, FT):

**Option A: Webhook (Instant) - PREFERRED**
1. `pollLiveScores` updates `live_scores` table
2. Supabase database webhook fires → calls `sendScoreNotificationsWebhook`
3. Webhook function detects changes and sends notifications immediately

**Option B: Scheduled Polling (Every Minute) - FALLBACK**
1. `sendScoreNotifications` runs every minute
2. Checks `live_scores` table for changes
3. Compares with `notification_state` to find new events
4. Sends notifications for new events

**Note:** Both can run simultaneously, but deduplication prevents duplicates.

---

## Deduplication Mechanism

All notifications use the `notification_state` table to prevent duplicates:

- **Key Fields:**
  - `api_match_id`: Unique identifier for each match
  - `last_notified_status`: Last status we notified about
  - `last_notified_home_score`: Last home score we notified about
  - `last_notified_away_score`: Last away score we notified about
  - `last_notified_goals`: Array of all goals we've notified about
  - `last_notified_red_cards`: Array of all red cards we've notified about
  - `last_notified_at`: Timestamp of last notification

- **Special Marker IDs:**
  - End of GW: `999999 - gw` (regular) or `999999 - testGw - 100000` (test)
  - Final submission: `999999 - matchday - 200000`

---

## Current Issues

1. **Duplicate "4 games starting" notifications:**
   - **Cause:** Both webhook and scheduled function detecting kickoffs
   - **Status:** Fixed with deduplication checks (but may still occur if state isn't updated fast enough)

2. **Webhook trigger not working:**
   - **Cause:** `pg_net` extension issues or webhook not configured in Supabase
   - **Status:** Webhook trigger removed, using scheduled function as fallback

---

## Configuration

### Scheduled Functions (netlify.toml):
- `pollLiveScores`: Every minute (`* * * * *`)
- `sendScoreNotifications`: Every minute (`* * * * *`)

### Webhook Setup:
- **Supabase Database Webhook** (if available):
  - Table: `live_scores`
  - Events: INSERT, UPDATE
  - URL: `https://totl-staging.netlify.app/.netlify/functions/sendScoreNotificationsWebhook`

---

## Tables Used

- `live_scores`: Current match scores and status
- `notification_state`: Tracks what we've already notified about
- `push_subscriptions`: User device IDs for OneSignal
- `test_api_picks` / `picks`: User predictions
- `test_api_fixtures` / `fixtures`: Match information
- `league_notification_settings`: Per-league mute preferences

