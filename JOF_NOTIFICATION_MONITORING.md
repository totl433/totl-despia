# Jof's Notification Monitoring Guide

**Your User ID:** `4542c037-5b38-40d0-b189-847b8f17c222`

## Current Status (as of last check)

### ✅ What's Working
- **Push Subscription**: Active device is subscribed ✅
- **Notification Preferences**: All enabled ✅
- **Some notifications working**: Kickoff notifications are being accepted (3 in last 24h)

### ❌ What's Not Working
- **Missing external_user_id**: Your active device doesn't have `external_user_id` set in OneSignal
- **Result**: Some notifications are `suppressed_unsubscribed` (kickoff, half-time, goal-scored)

## How to Monitor

### Option 1: Run the monitoring script
```bash
node scripts/monitor-jof-notifications.mjs
```

This shows:
- Your push subscription status
- Recent notification attempts
- What succeeded vs failed
- Error details

### Option 2: Use Supabase SQL
Run the queries in `scripts/monitor-jof-notifications.sql` in Supabase SQL editor.

### Option 3: Quick check after a realtime update
```bash
# Run this right after a game event happens
node scripts/monitor-jof-notifications.mjs | grep -A 5 "RECENT NOTIFICATIONS"
```

## What to Watch For

When the next realtime update happens (goal, kickoff, half-time, etc.):

1. **Check if notification was sent:**
   - Look for `notification_send_log` entry with your user_id
   - Check the `result` field:
     - ✅ `accepted` = Notification sent successfully
     - ❌ `failed` = Error sending
     - ⏸️ `suppressed_unsubscribed` = external_user_id not set (this is the current issue)
     - ⏸️ `suppressed_preference` = You disabled this notification type
     - ⏸️ `suppressed_cooldown` = Too soon after previous notification
     - ⏸️ `suppressed_duplicate` = Already sent for this event

2. **If you see `suppressed_unsubscribed`:**
   - The `external_user_id` fix hasn't been applied yet
   - **Solution**: Open the app - the new `registerPlayer` code will fix it automatically
   - Or manually call the fix function (once deployed)

3. **If you see `accepted` but no notification on your phone:**
   - Check OneSignal dashboard → Messages → Delivery
   - Look for the notification by `onesignal_notification_id`
   - Check if it was delivered or if there's a delivery error

## Expected Behavior After Fix

Once `external_user_id` is properly set:
- All notifications should show `accepted` (not `suppressed_unsubscribed`)
- You should receive notifications on your phone
- The monitoring script will show `✅ accepted` for all notification types

## Quick Commands

```bash
# Monitor in real-time (updates every 5 seconds)
watch -n 5 node scripts/monitor-jof-notifications.mjs

# Check just the last hour
# (modify the script to change time window)

# Check for a specific notification type
node scripts/monitor-jof-notifications.mjs | grep "goal-scored"
```

## Next Steps

1. **Wait for next realtime update** (goal, kickoff, etc.)
2. **Run monitoring script** immediately after
3. **Check the result** - should be `accepted` if fix worked
4. **Report back** what you see!








