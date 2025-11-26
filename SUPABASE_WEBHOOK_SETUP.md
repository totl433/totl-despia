# Supabase Webhook Setup for Live Scores Notifications

## Overview
Instead of `pollLiveScores` calling the webhook directly, we're using Supabase's built-in webhook system to automatically trigger notifications when `live_scores` table is updated.

## Setup Instructions

### 1. Go to Supabase Dashboard
- Navigate to: **Supabase Dashboard** → **Database** → **Webhooks**

### 2. Create New Webhook
Click **"Create a new webhook"** or **"New webhook"**

### 3. Configure Webhook

**Name:** `live_scores_notifications`

**Table:** `live_scores`

**Events:** 
- ✅ `UPDATE` (when scores/goals change)
- ✅ `INSERT` (when new matches are added)

**Type:** `HTTP Request`

**Method:** `POST`

**URL:** 
```
https://totl-staging.netlify.app/.netlify/functions/sendScoreNotificationsWebhook
```

**Headers:**
```
Content-Type: application/json
```

**Payload:**
Supabase will automatically send the webhook payload in this format:
```json
{
  "type": "UPDATE",
  "table": "live_scores",
  "record": {
    "api_match_id": 12345,
    "home_score": 1,
    "away_score": 0,
    "goals": [...],
    ...
  },
  "old_record": {
    "api_match_id": 12345,
    "home_score": 0,
    "away_score": 0,
    "goals": [],
    ...
  }
}
```

### 4. Save Webhook

### 5. Test
After saving, when `pollLiveScores` updates the `live_scores` table, Supabase will automatically call the webhook function.

## Benefits
- ✅ Automatic - no need for `pollLiveScores` to manually call webhook
- ✅ More reliable - Supabase handles retries and error handling
- ✅ Cleaner code - separation of concerns
- ✅ No race conditions - Supabase ensures webhook is called once per update

## Verification
After setup, check Netlify function logs for:
- `[sendScoreNotificationsWebhook] [xxx] Webhook received` messages
- These should appear automatically when `live_scores` is updated

