# API Live Scores System - Quick Explainer

## Overview
We use the Football Data API to get live scores, store them in Supabase, and display them in the frontend. Notifications are sent automatically when scores change.

---

## 🔄 Data Flow

```
Football Data API
    ↓ (polled every 5 min)
pollLiveScores Function
    ↓ (updates)
Supabase live_scores table
    ↓ (read by)
Frontend (Home, League, Test API pages)
    ↓ (also read by)
sendScoreNotifications Function
    ↓ (sends)
Push Notifications (OneSignal)
```

---

## 📊 Components

### 1. **pollLiveScores** (Netlify Scheduled Function)
- **Runs:** Every 5 minutes (`*/5 * * * *`)
- **What it does:**
  - Gets current GW from `meta` table
  - Finds all fixtures with `api_match_id` (from both `fixtures` and `test_api_fixtures` tables)
  - **Skips FINISHED games** (only polls live/scheduled games)
  - Polls Football Data API for each fixture
  - Updates `live_scores` table in Supabase with:
    - Scores (home_score, away_score)
    - Status (TIMED, IN_PLAY, PAUSED, FINISHED)
    - Minute (or null for FT)
    - Team names, kickoff time

### 2. **live_scores Table** (Supabase)
- **Purpose:** Single source of truth for live scores
- **Key columns:**
  - `api_match_id` (primary key)
  - `gw`, `fixture_index`
  - `home_score`, `away_score`
  - `status` (TIMED, IN_PLAY, PAUSED, FINISHED)
  - `minute` (null for FINISHED)
  - `home_team`, `away_team`
  - `kickoff_time`, `updated_at`

### 3. **Frontend Pages** (Home.tsx, League.tsx, TestApiPredictions.tsx)
- **What they do:**
  - Read from `live_scores` table (NOT directly from API)
  - Poll Supabase every 2 minutes for updates
  - Display scores with live badges:
    - 🔴 Red pulsing dot + "First Half"/"HT"/"Second Half" for live games
    - ⚪ Grey "FT" for finished games
  - Stop polling when games finish

### 4. **sendScoreNotifications** (Netlify Scheduled Function)
- **Runs:** Every 2 minutes (`*/2 * * * *`)
- **What it does:**
  - Reads from `live_scores` table
  - Compares with `notification_state` table to detect changes
  - Sends push notifications for:
    - ⚽ **Score changes:** "⚽ GOAL! Team A 2-1 Team B"
    - 🏁 **Game finished:** "FT: Team A 2-1 Team B"
    - 🎉 **End of GW:** "GW1 Complete! 🎉 All games finished. Check your results!"
  - Updates `notification_state` to prevent duplicates

### 5. **notification_state Table** (Supabase)
- **Purpose:** Track what we've already notified about
- **Prevents:** Duplicate notifications for the same score change
- **Special marker:** Uses `api_match_id = 999999 - gw` to track end-of-GW notifications

---

## 🎯 Key Features

### ✅ Only Polls Live Games
- Checks database first
- Skips FINISHED games (saves API calls)
- Only polls `TIMED`, `IN_PLAY`, `PAUSED` games

### ✅ Works for Any Gameweek
- Queries ALL test fixtures (not just `current_gw`)
- Test games can be in GW 1 even if `current_gw` is 11
- Regular fixtures still filtered by `current_gw`

### ✅ Smart Status Display
- **Live games:** Red pulsing badge with minute/phase
- **Finished games:** Grey "FT" badge (no pulse)
- Uses `formatMinuteDisplay()` function for consistency

### ✅ Automatic Notifications
- Goal notifications sent to users with picks
- FT notifications when games finish
- End-of-GW notification when all games complete
- No duplicate notifications (tracked in `notification_state`)

---

## 🔧 Manual Tools

### `test-poll-function.mjs`
- Manually test the polling logic
- Useful for debugging

### `check-live-score.mjs`
- Check what's in database vs API
- Compare statuses

### `fix-finished-game.mjs`
- Manually set a game to FINISHED
- Useful when API is slow to update status

---

## 📝 Example Flow (Tonight's 22:00 Game)

1. **22:00** - Game starts
   - API status: `TIMED` → `IN_PLAY`
   - `pollLiveScores` updates `live_scores` table
   - Frontend shows red pulsing badge "First Half"

2. **22:15** - Goal scored
   - API updates score: 1-0
   - `pollLiveScores` updates `live_scores` table
   - `sendScoreNotifications` detects change
   - Push notification sent: "⚽ GOAL! Bragantino 1-0 Mineiro"

3. **22:45** - Halftime
   - API status: `PAUSED`
   - Frontend shows "HT"

4. **23:00** - Game finishes
   - API status: `FINISHED` (or manually set)
   - Frontend shows grey "FT" badge
   - Push notification: "FT: Bragantino 1-0 Mineiro"

5. **After all 3 games finish**
   - `sendScoreNotifications` detects all games FINISHED
   - Push notification: "GW1 Complete! 🎉 All games finished. Check your results!"
   - `pollLiveScores` stops polling (all games FINISHED)

---

## 🚨 Important Notes

- **Frontend NEVER calls API directly** - always reads from Supabase
- **API can be slow** - sometimes shows `IN_PLAY` even after game finishes
- **Manual fix available** - use `fix-finished-game.mjs` if needed
- **Notifications are server-side** - more reliable than client-side
- **End-of-GW only triggers once** - tracked in `notification_state`








