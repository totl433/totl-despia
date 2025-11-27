# Notification Debug Guide

## Where to Check Logs

### Netlify Dashboard
1. Go to: **Netlify Dashboard** → **Functions** → Select function → **Logs**
2. Or: **Netlify Dashboard** → **Site** → **Functions** → Select function → **View logs**

### Functions to Check
- `pollLiveScores` - Runs every minute, fetches scores, calls webhook
- `sendScoreNotificationsWebhook` - Handles goal notifications

## What to Look For

### When a Goal is Scored

#### ✅ Good Signs (No Duplicates)
```
[pollLiveScores] Successfully updated 5 live scores
[pollLiveScores] Skipping webhook for match 551948 - no changes detected
[pollLiveScores] Triggered webhook notifications for 1 matches (5 total updates)

[sendScoreNotificationsWebhook] [abc123] Webhook received: { api_match_id: 551948, ... }
[sendScoreNotificationsWebhook] [abc123] Processing match 551948
[sendScoreNotificationsWebhook] [abc123] ✅ NEW GOAL DETECTED: { scorer: "Mbappé", minute: 29 }
[sendScoreNotificationsWebhook] [abc123] Sent goal notification to user abc-123 (2 devices)
```

#### ❌ Bad Signs (Duplicates)
```
# Two different request IDs for same match = webhook called twice
[sendScoreNotificationsWebhook] [abc123] Webhook received: match 551948
[sendScoreNotificationsWebhook] [xyz789] Webhook received: match 551948  ← DUPLICATE!

# Or same request ID sending twice = processing issue
[sendScoreNotificationsWebhook] [abc123] Sent goal notification to user X
[sendScoreNotificationsWebhook] [abc123] Sent goal notification to user X  ← DUPLICATE!
```

## Key Log Messages

### pollLiveScores
- `Successfully updated X live scores` - Updates completed
- `Skipping webhook for match X - no changes detected` - ✅ Good! Filtering works
- `Triggered webhook notifications for X matches` - Only matches with changes

### sendScoreNotificationsWebhook
- `[requestId] Webhook received` - Webhook called (note the request ID)
- `[requestId] Processing match X` - Processing started
- `✅ NEW GOAL DETECTED` - Goal found (should only appear once per goal)
- `🚫 SKIPPING - already notified` - Deduplication working
- `🚫 SKIPPING - state was updated by another process` - Race condition prevented
- `Sent goal notification to user X` - Notification sent (should only appear once per user)

## Quick Debug Steps

1. **Filter logs** for: `sendScoreNotificationsWebhook` + `NEW GOAL DETECTED`
2. **Count occurrences** - Should be 1 per goal, not 2
3. **Check request IDs** - Same goal should have same request ID (or be skipped)
4. **Check timing** - Duplicates usually appear within seconds of each other

## Common Issues

### Issue: Duplicate notifications
**Check:**
- Are there two different request IDs for the same match?
- Is `pollLiveScores` calling the webhook twice?
- Is the deduplication check working?

### Issue: No notifications
**Check:**
- Is `pollLiveScores` running? (should run every minute)
- Are goals being detected? Look for `NEW GOAL DETECTED`
- Are users registered? Check `push_subscriptions` table
- Are picks found? Look for `No picks found` message

### Issue: Notifications delayed
**Check:**
- Is `pollLiveScores` running on schedule?
- Are API calls succeeding? Look for errors in `pollLiveScores` logs
- Is the webhook being called? Look for `Webhook received` messages

