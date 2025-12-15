# Future Gameweek Notifications - Automatic Connection

## ✅ Yes, it will always be connected for GW15, GW16, and beyond!

The notification systems are **fully dynamic** and will automatically work for any future gameweek created via the API Admin, as long as one thing is updated:

---

## 🔑 Key Requirement

**When publishing a new gameweek (GW15, GW16, etc.), the `current_gw` value must be updated in the database.**

This is typically done automatically by the API Admin when publishing a new GW, but it's the only requirement.

---

## 📋 How It Works

### 1. **pollLiveScores.ts** (Live Score Polling)
- **Dynamic:** Queries `app_fixtures` for fixtures where `gw = current_gw`
- **Works for:** Any GW as long as `current_gw` in `meta` table matches
- **Example:** When `current_gw = 15`, it will poll for all GW15 fixtures from `app_fixtures`

```typescript
// Gets current_gw from meta table
const currentGw = metaData.current_gw; // e.g., 15

// Queries app_fixtures for that GW
.eq('gw', currentGw) // Will get GW15 fixtures
```

### 2. **sendScoreNotificationsWebhook.ts** (Score Notifications)
- **Dynamic:** Uses the fixture's own `gw` field from the database
- **Works for:** Any GW automatically - no hardcoding
- **Example:** When a GW15 fixture score updates, it looks up the fixture in `app_fixtures`, gets its `gw` value (15), then queries `app_picks` for that GW

```typescript
// Gets fixture from app_fixtures (or fixtures/test_api_fixtures)
const fixture = appFixture.data; // Has gw: 15

// Uses fixture's gw value to query picks
.eq('gw', fixtureGw) // Will query app_picks for GW15
```

### 3. **notifyFinalSubmission.ts** (Final Submission Notifications)
- **Dynamic:** Takes `matchday` as a parameter (the GW number)
- **Works for:** Any GW - the function is called with the specific GW number
- **Example:** When checking if all members submitted for GW15, it queries `app_gw_submissions` for `gw = 15`

```typescript
// Checks app_gw_submissions for the specific matchday/GW
.eq('gw', matchday) // e.g., 15
```

---

## 🔄 Automatic Flow for Future GWs

### When GW15 is Published:

1. **API Admin creates fixtures:**
   - Inserts into `app_fixtures` with `gw = 15`
   - Updates `current_gw = 15` in `meta` table

2. **pollLiveScores automatically:**
   - Reads `current_gw = 15` from `meta` table
   - Queries `app_fixtures` where `gw = 15`
   - Polls live scores for all GW15 fixtures
   - ✅ **No code changes needed**

3. **sendScoreNotificationsWebhook automatically:**
   - When `live_scores` updates, webhook triggers
   - Looks up fixture in `app_fixtures` (finds GW15 fixture)
   - Queries `app_picks` where `gw = 15`
   - Sends notifications to users with picks
   - ✅ **No code changes needed**

4. **notifyFinalSubmission automatically:**
   - Called with `matchday = 15` when user submits
   - Queries `app_gw_submissions` where `gw = 15`
   - Checks if all members submitted
   - Sends notification if all submitted
   - ✅ **No code changes needed**

---

## ✅ Verification Checklist

To ensure future GWs work automatically:

1. **When publishing GW15 (or any new GW):**
   - [ ] Fixtures created in `app_fixtures` with correct `gw` value (e.g., `gw = 15`)
   - [ ] `current_gw` updated in `meta` table to the new GW number
   - [ ] Picks will be created in `app_picks` with correct `gw` value
   - [ ] Submissions will be created in `app_gw_submissions` with correct `gw` value

2. **The notification systems will automatically:**
   - [x] Poll live scores for the new GW (via `pollLiveScores`)
   - [x] Send score notifications for the new GW (via `sendScoreNotificationsWebhook`)
   - [x] Send final submission notifications for the new GW (via `notifyFinalSubmission`)

---

## 🎯 Summary

**All notification systems are fully dynamic and will work for GW15, GW16, GW17, and beyond without any code changes.**

The only requirement is that when a new GW is published:
- Fixtures are created in `app_fixtures` with the correct `gw` value
- `current_gw` is updated in the `meta` table

Everything else happens automatically! ✅

---

## 📝 Code Evidence

### pollLiveScores.ts
```typescript
// Gets current_gw dynamically from meta table
const currentGw = metaData.current_gw; // Works for any GW

// Queries app_fixtures for that GW
.eq('gw', currentGw) // Dynamic - no hardcoding
```

### sendScoreNotificationsWebhook.ts
```typescript
// Gets fixture from app_fixtures (works for any GW)
const fixture = appFixture.data; // Has gw field

// Uses fixture's gw to query picks (dynamic)
.eq('gw', fixtureGw) // Works for any GW
```

### notifyFinalSubmission.ts
```typescript
// Takes matchday as parameter (dynamic)
.eq('gw', matchday) // Works for any GW
```

**No hardcoded GW values anywhere!** 🎉














