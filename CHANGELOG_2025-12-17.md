# Work Log: December 17, 2025

## Summary

Tonight we completed a major overhaul of the push notification system, fixing a critical bug that was preventing users from receiving notifications, and building new tools for testing and documentation.

---

## 🆕 New: TOTL Notification Catalog

**What**: A documentation site for all push notifications in the app.

**Where**: 
- Local: `http://localhost:4321/` (run `cd notification_catalog/site && npm run dev`)
- When deployed: `/notification-docs/` on the main site

**Key Feature - Test Console**: `http://localhost:4321/test/`

This page allows you to:
- Select a notification type from a dropdown
- Enter a user UUID
- Fill in test parameters
- Send a test notification directly to that user
- See the result (success/failure with details)

### To Run Locally

```bash
cd notification_catalog/site
npm install
npm run dev
# Open http://localhost:4321/test/
```

---

## 🐛 Critical Bug Fix: External User ID Targeting

### The Problem

Users weren't receiving push notifications even though:
- They showed as "Subscribed" in OneSignal dashboard
- iOS notifications were enabled
- They were registered in our database

### Root Cause

**Despia provides the wrong ID type!**

| What Despia Provides | What OneSignal Needs |
|---------------------|---------------------|
| `window.onesignalplayerid` = **OneSignal ID** (user record) | **Subscription ID** (device subscription) |

OneSignal migrated from v4 to v5 SDK and now has two separate IDs:
- **OneSignal ID** - User record identifier
- **Subscription ID** - Device subscription identifier (what you send to)

Despia's SDK (version `050214`) uses the legacy format and returns the wrong ID.

### The Fix

Switched from `include_player_ids` to `include_external_user_ids` targeting.

Instead of:
```
1. Look up player_id from database
2. Verify subscription with OneSignal API
3. Send with include_player_ids: [player_id]
```

Now:
```
1. Send directly with include_external_user_ids: [user_id]
   (OneSignal resolves the correct subscription internally)
```

### Files Changed

- `netlify/functions/sendPush.ts` - Added `externalUserIds` parameter
- `netlify/functions/lib/notifications/onesignal.ts` - Support for external_user_ids in payload
- `netlify/functions/lib/notifications/dispatch.ts` - Use external_user_ids instead of player_ids
- `netlify/functions/lib/notifications/targeting.ts` - Added helper functions

### Requirement for This to Work

`external_user_id` must be set on the device in OneSignal. This happens during:
1. Normal registration via `registerPlayer` function
2. Manual fix via `forceUserRegistration` function

---

## 🔧 Debugging Session: Cakehurst

User `027502c5-1cd7-4922-abd5-f9bcc569bb4d` (cakehurst) wasn't receiving notifications.

### What We Found

1. **No record in `push_subscriptions`** - Registration never completed after app reinstall
2. **Wrong ID stored** - When we manually registered, the OneSignal ID was stored (wrong type)
3. **External ID not set** - OneSignal dashboard showed empty External ID

### How We Fixed It

1. Found correct Subscription ID in OneSignal dashboard: `5a46a2af-a637-4937-b171-c0219d02c295`
2. Ran `forceUserRegistration` to:
   - Create database record
   - Set `external_user_id` in OneSignal
3. Tested notification - **SUCCESS!**

### Command Used

```bash
curl -X POST https://totl-staging.netlify.app/.netlify/functions/forceUserRegistration \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "027502c5-1cd7-4922-abd5-f9bcc569bb4d",
    "playerId": "5a46a2af-a637-4937-b171-c0219d02c295"
  }'
```

---

## 📊 Useful SQL Queries

### Check a user's push subscriptions

```sql
SELECT player_id, is_active, subscribed, last_checked_at
FROM push_subscriptions
WHERE user_id = 'USER_UUID_HERE'
ORDER BY updated_at DESC;
```

### Check notification send log

```sql
SELECT notification_key, event_id, result, error, created_at
FROM notification_send_log
WHERE user_id = 'USER_UUID_HERE'
ORDER BY created_at DESC
LIMIT 10;
```

### Find all active subscriptions

```sql
SELECT COUNT(*) as total,
       COUNT(CASE WHEN subscribed = true THEN 1 END) as subscribed
FROM push_subscriptions
WHERE is_active = true;
```

---

## 🧪 Testing Notifications

### Via Test Console (Recommended)

1. Run the catalog site: `cd notification_catalog/site && npm run dev`
2. Go to `http://localhost:4321/test/`
3. Select notification type, enter UUID, click Send

### Via curl

```bash
# Using External User ID (new way - preferred)
curl -X POST https://totl-staging.netlify.app/.netlify/functions/sendPush \
  -H 'Content-Type: application/json' \
  -d '{
    "externalUserIds": ["USER_UUID_HERE"],
    "title": "Test",
    "message": "Hello!"
  }'

# Using V2 dispatch pipeline
curl -X POST https://totl-staging.netlify.app/.netlify/functions/sendTestNotification \
  -H 'Content-Type: application/json' \
  -d '{
    "notification_type": "goal-scored",
    "user_id": "USER_UUID_HERE",
    "params": {
      "match_id": "test-123",
      "scorer_name": "Test Player",
      "minute": 45,
      "scoring_team": "Test FC",
      "home_team": "Test FC",
      "away_team": "Test United",
      "home_score": 1,
      "away_score": 0
    }
  }'
```

---

## 📝 Next Steps / Known Issues

1. **Monitor new user registrations** - Verify `external_user_id` is being set correctly
2. **Consider adding a "Re-register" button** in Profile settings for users who have issues
3. **Audit existing users** - Some may need their `external_user_id` set manually

---

## Git Commits

```
ee2ff27 - Switch to external_user_id targeting for push notifications
dbb1a79 - Remove .astro cache folder (contains secrets)
```

---

*Log created: December 17, 2025*

