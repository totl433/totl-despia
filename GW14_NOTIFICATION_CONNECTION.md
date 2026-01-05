# GW14 Notification System Connection Status

## Summary

All notification systems have been updated to support GW14 fixtures created via the API Admin using the app tables (`app_fixtures`, `app_picks`, `app_gw_submissions`).

---

## ✅ Updated Functions

### 1. `sendScoreNotificationsWebhook.ts` ✅
**Status:** Connected to GW14 app tables

**Changes:**
- Now checks `app_fixtures` table when looking up fixture info (in addition to `fixtures` and `test_api_fixtures`)
- Queries `app_picks` table when determining which users to send score notifications to (in addition to `picks` and `test_api_picks`)
- Updated in 6 locations where picks are queried:
  1. Goal notifications
  2. Score change notifications (without goals)
  3. Kickoff notifications
  4. Half-time notifications
  5. Full-time notifications
  6. End of gameweek notifications

**How it works:**
- When `live_scores` table is updated (via webhook from `pollLiveScores`), the function:
  1. Looks up fixture in `app_fixtures` (and falls back to `fixtures`/`test_api_fixtures`)
  2. Determines if it's an app fixture (`isAppFixture` flag)
  3. Queries `app_picks` for users who have picks for that fixture
  4. Sends notifications to those users

---

### 2. `notifyFinalSubmission.ts` ✅
**Status:** Connected to GW14 app tables

**Changes:**
- Now checks `app_gw_submissions` table first when determining if all league members have submitted
- Falls back to `test_api_submissions` or `gw_submissions` if no app submissions found

**How it works:**
- When a user submits predictions, the function:
  1. First checks `app_gw_submissions` for submissions for that GW
  2. If found, uses app table; otherwise falls back to regular/test tables
  3. Checks if all league members have submitted
  4. Sends "All predictions submitted!" notification if all have submitted

---

### 3. `pollLiveScores.ts` ✅
**Status:** Already connected (updated previously)

**Changes:**
- Now queries `app_fixtures` table when determining which matches to poll for live scores
- Includes fixtures from `app_fixtures` in the polling list

**How it works:**
- When `pollLiveScores` runs, it:
  1. Queries `fixtures`, `test_api_fixtures`, and `app_fixtures` for current GW
  2. Polls external API for live scores for all matches
  3. Updates `live_scores` table
  4. Supabase webhook triggers `sendScoreNotificationsWebhook` automatically

---

## 📋 Notification Flow for GW14

### Score Update Notifications (Goals, Kickoff, Half-Time, Full-Time)

```
1. pollLiveScores runs (scheduled/triggered)
   ↓
2. Queries app_fixtures for GW14 fixtures
   ↓
3. Polls external API for live scores
   ↓
4. Updates live_scores table
   ↓
5. Supabase webhook triggers sendScoreNotificationsWebhook
   ↓
6. sendScoreNotificationsWebhook:
   - Looks up fixture in app_fixtures
   - Queries app_picks for users with picks
   - Sends notifications to those users
```

### Final Submission Notifications

```
1. User submits predictions
   ↓
2. Submission saved to app_gw_submissions
   ↓
3. notifyFinalSubmission called
   ↓
4. Checks app_gw_submissions for all league members
   ↓
5. If all submitted, sends "All predictions submitted!" notification
```

---

## 🔍 Verification Checklist

To verify GW14 notifications are working:

1. **Score Notifications:**
   - [ ] Check that `pollLiveScores` includes GW14 fixtures from `app_fixtures`
   - [ ] Verify `sendScoreNotificationsWebhook` finds fixtures in `app_fixtures`
   - [ ] Confirm `app_picks` are queried when determining notification recipients
   - [ ] Test that goal notifications are sent to users with picks in `app_picks`

2. **Final Submission Notifications:**
   - [ ] Verify `notifyFinalSubmission` checks `app_gw_submissions` first
   - [ ] Test that notification is sent when all members submit (using app tables)

3. **Live Score Updates:**
   - [ ] Confirm `useLiveScores` hook in `TestApiPredictions.tsx` subscribes to `live_scores` updates
   - [ ] Verify real-time score updates appear in the app when games are live

---

## 📝 Notes

- All notification systems now support **three fixture/pick systems**:
  1. **Regular** (`fixtures`, `picks`, `gw_submissions`) - Original system
  2. **Test API** (`test_api_fixtures`, `test_api_picks`, `test_api_submissions`) - Test system
  3. **App Tables** (`app_fixtures`, `app_picks`, `app_gw_submissions`) - GW14+ system (API Admin)

- The functions check app tables first, then fall back to regular/test tables
- This ensures backward compatibility with existing gameweeks while supporting new GW14 system

---

## 🚀 Next Steps

When GW14 games kick off this evening:
1. `pollLiveScores` will poll for live scores (already includes `app_fixtures`)
2. `live_scores` table will be updated
3. Webhook will trigger `sendScoreNotificationsWebhook`
4. Notifications will be sent to users with picks in `app_picks`
5. App will display live scores via `useLiveScores` hook subscription

All systems are now connected! ✅





























