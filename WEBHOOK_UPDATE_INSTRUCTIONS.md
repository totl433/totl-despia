# Update Supabase Webhook to V2 - Step by Step Guide

## Quick Summary
Update the webhook URL from `sendScoreNotificationsWebhook` (V1) to `sendScoreNotificationsWebhookV2` (V2) to enable idempotency, policy checks, and better duplicate prevention.

## Method 1: Supabase Dashboard (Recommended)

### Step-by-Step Instructions

1. **Log in to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Webhooks**
   - In the left sidebar, click **Database**
   - Click **Webhooks** (under Database section)

3. **Find the Live Scores Webhook**
   - Look for a webhook named `live_scores_notifications` or similar
   - It should be configured for the `live_scores` table
   - Events should include `UPDATE` and/or `INSERT`

4. **Edit the Webhook**
   - Click the **Edit** button (pencil icon) next to the webhook

5. **Update the URL**
   - Find the **URL** field
   - **Current (V1):**
     ```
     https://totl-staging.netlify.app/.netlify/functions/sendScoreNotificationsWebhook
     ```
   - **New (V2):**
     ```
     https://totl-staging.netlify.app/.netlify/functions/sendScoreNotificationsWebhookV2
     ```
   - Replace the URL with the V2 version

6. **Save Changes**
   - Click **Save** or **Update** button
   - The webhook is now using V2!

## Method 2: SQL Update (If using pg_net triggers)

If your webhook is configured via SQL triggers (using pg_net extension), run this SQL:

```sql
-- Run this in Supabase SQL Editor
\i supabase/sql/update_webhook_to_v2.sql
```

Or copy/paste the contents of `supabase/sql/update_webhook_to_v2.sql` into the SQL Editor.

## Verification

After updating, verify it's working:

1. **Check Netlify Function Logs**
   - Go to Netlify Dashboard → Functions → `sendScoreNotificationsWebhookV2`
   - Look for logs showing `[scoreWebhookV2]` prefix (not `[sendScoreNotificationsWebhook]`)

2. **Check Database Logs**
   - Query `notification_send_log` table:
   ```sql
   SELECT 
     notification_key,
     result,
     COUNT(*) as count
   FROM notification_send_log
   WHERE created_at > NOW() - INTERVAL '1 hour'
   GROUP BY notification_key, result
   ORDER BY notification_key;
   ```
   - You should see entries with V2 notification types (goal-scored, kickoff, etc.)

3. **Test with a Score Update**
   - Wait for `pollLiveScores` to update a match score
   - Or manually update `live_scores` table to trigger the webhook
   - Check that notifications are sent via V2

## What Changes with V2?

✅ **Idempotency** - No duplicate notifications (database-level protection)
✅ **Policy Checks** - User preferences, cooldowns, quiet hours respected
✅ **Better Grouping** - collapse_id/thread_id/android_group prevent duplicate display
✅ **Edge Case Handling** - Missing oldStatus, goal attribution, etc.
✅ **Audit Trail** - All sends logged in `notification_send_log`

## Troubleshooting

### Webhook Not Found
- If you don't see a webhook in the Dashboard, it might be using SQL triggers
- Check `supabase/sql/check_live_scores_webhook.sql` to see if triggers exist
- If triggers exist, use Method 2 (SQL update)

### Webhook Still Using V1
- Check the webhook URL in Dashboard - make sure it ends with `V2`
- Verify the webhook is enabled (toggle should be ON)
- Check Netlify function logs to see which function is being called

### Notifications Not Working
- Check Netlify function logs for errors
- Verify `notification_send_log` table exists and has entries
- Check that `pollLiveScores` is updating `live_scores` table
- Verify OneSignal credentials are set in Netlify environment variables

## Need Help?

If you're stuck, check:
- `SUPABASE_WEBHOOK_SETUP.md` - Original setup instructions
- `docs/NOTIFICATIONS_RUNBOOK.md` - Debugging guide
- Netlify Function logs for error messages








