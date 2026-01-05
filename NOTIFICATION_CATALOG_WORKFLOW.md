# Notification Catalog Workflow Guide

## Overview

The **Notification Catalog** serves as the **single source of truth** for all push notification types in TOTL. It has two parts:

1. **Documentation Site** (Astro/Starlight) - Human-readable documentation
2. **Embedded Catalog** (TypeScript) - Machine-readable metadata used by backend functions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SOURCE OF TRUTH: Markdown Files                            │
│  notification_catalog/site/src/content/docs/notifications/  │
│  - goal-scored.md                                           │
│  - chat-message.md                                          │
│  - etc.                                                     │
└─────────────────────────────────────────────────────────────┘
                    │
                    ├─► Build Script
                    │   scripts/build-notification-catalog.ts
                    │
                    ├─► JSON Output
                    │   notification_catalog/generated/catalog.json
                    │
                    └─► Embedded TypeScript (MANUAL)
                        netlify/functions/lib/notifications/catalog.ts
                        (Used by backend dispatcher)
```

## Workflow: Adding or Modifying a Notification

### Step 1: Edit the Markdown File

Edit the notification definition in:
```
notification_catalog/site/src/content/docs/notifications/{notification-key}.md
```

**Required Frontmatter Fields:**
- `notification_key` - Unique identifier (e.g., `goal-scored`)
- `owner` - Who triggers it (e.g., `score-webhook`, `client-triggered`)
- `status` - `active`, `deprecated`, or `disabled`
- `channels` - Array like `["push"]`
- `audience` - Who receives it (e.g., `league_members_except_sender`)
- `source` - How it's triggered (e.g., `webhook`, `client_post`)
- `trigger.event_id_format` - Template for deduplication (e.g., `goal:{api_match_id}:{scorer}:{minute}`)
- `dedupe.scope` - `per_user_per_event` or `global`
- `dedupe.ttl_seconds` - How long to dedupe (e.g., `120`)
- `cooldown.per_user_seconds` - Minimum time between sends to same user
- `quiet_hours.start` / `quiet_hours.end` - Optional quiet hours (e.g., `"23:00"`, `"07:00"`)
- `preferences.preference_key` - User preference key (e.g., `score-updates`)
- `preferences.default` - Default enabled/disabled
- `onesignal.collapse_id_format` - OneSignal collapse ID template
- `onesignal.thread_id_format` - OneSignal thread ID template
- `onesignal.android_group_format` - Android group name
- `deep_links.url_format` - Deep link URL template (e.g., `"/league/{leagueCode}"`)
- `rollout.enabled` - Whether rollout is enabled
- `rollout.percentage` - Rollout percentage (0-100)

**Example:**
```markdown
---
notification_key: goal-scored
owner: score-webhook
status: active
channels:
  - push
audience: users_with_picks_for_fixture
source: webhook
trigger:
  name: goal_scored
  event_id_format: "goal:{api_match_id}:{scorer_normalized}:{minute}"
dedupe:
  scope: per_user_per_event
  ttl_seconds: 120
cooldown:
  per_user_seconds: 30
quiet_hours:
  start: "23:00"
  end: "07:00"
preferences:
  preference_key: score-updates
  default: true
onesignal:
  collapse_id_format: "goal:{api_match_id}"
  thread_id_format: "match:{api_match_id}"
  android_group_format: "totl_scores"
deep_links:
  url_format: "/predictions"
rollout:
  enabled: true
  percentage: 100
---

# Goal Scored Notification

[Documentation content here...]
```

### Step 2: Generate the JSON Catalog

Run the build script to validate and generate the JSON catalog:

```bash
npx tsx scripts/build-notification-catalog.ts
```

This will:
- ✅ Validate all required fields
- ✅ Generate `notification_catalog/generated/catalog.json`
- ✅ Show any validation errors

### Step 3: Update the Embedded TypeScript Catalog

**IMPORTANT:** The build script only generates JSON. You must manually update the embedded catalog in:

```
netlify/functions/lib/notifications/catalog.ts
```

**How to update:**

1. Open `netlify/functions/lib/notifications/catalog.ts`
2. Find the `catalogData` object (starts around line 13)
3. Copy the relevant entry from `notification_catalog/generated/catalog.json`
4. Paste it into the `catalogData` object in `catalog.ts`
5. Ensure proper TypeScript formatting (quotes, commas, etc.)

**Example:**
```typescript
const catalogData = {
  "goal-scored": {
    "notification_key": "goal-scored",
    "owner": "score-webhook",
    // ... rest of the entry from catalog.json
  },
  // ... other entries
};
```

### Step 4: Test Locally

1. **Test the build script:**
   ```bash
   npx tsx scripts/build-notification-catalog.ts
   ```

2. **Test TypeScript compilation:**
   ```bash
   npm run check
   ```

3. **Test the notification function:**
   - Use the admin page or test scripts to trigger the notification
   - Check that it uses the correct metadata from the catalog

### Step 5: Build Documentation Site (Optional)

If you want to view the documentation site locally:

```bash
cd notification_catalog/site
npm install  # First time only
npm run dev  # Start dev server
```

The site will be available at `http://localhost:4321`

**Note:** The documentation site is separate from the embedded catalog. The embedded catalog is what the backend actually uses.

## When to Update the Catalog

### Add a New Notification Type

1. Create new markdown file: `notification_catalog/site/src/content/docs/notifications/{new-key}.md`
2. Follow Step 1-3 above
3. Update the dispatcher code to handle the new notification type

### Modify an Existing Notification

1. Edit the markdown file
2. Regenerate JSON (Step 2)
3. Update embedded catalog (Step 3)
4. Test that existing notifications still work

### Change Notification Behavior

If you need to change:
- Event ID format
- Collapse ID format
- Thread ID format
- Cooldown settings
- Quiet hours
- Preference keys

→ Update the markdown file → Regenerate → Update embedded catalog

## Current Notification Types

All defined in `notification_catalog/site/src/content/docs/notifications/`:

1. ✅ `goal-scored` - Goal scored in a match
2. ✅ `goal-disallowed` - VAR disallowed goal
3. ✅ `kickoff` - Match kickoff (1st/2nd half)
4. ✅ `half-time` - Half-time score update
5. ✅ `final-whistle` - Full-time result with pick outcome
6. ✅ `gameweek-complete` - All matches in GW finished
7. ✅ `chat-message` - League chat message
8. ✅ `final-submission` - All league members submitted picks
9. ✅ `new-gameweek` - New gameweek fixtures published
10. ✅ `prediction-reminder` - Reminder 5 hours before deadline
11. ✅ `member-join` - Member joined a mini-league

## Integration Points

The embedded catalog is used by:

1. **`netlify/functions/lib/notifications/dispatch.ts`**
   - Gets catalog entry via `getCatalogEntry(notification_key)`
   - Uses metadata for policy checks, formatting, etc.

2. **`netlify/functions/lib/notifications/onesignal.ts`**
   - Uses `formatCollapseId()`, `formatThreadId()` from catalog
   - Gets `android_group_format` from catalog

3. **`netlify/functions/lib/notifications/policy.ts`**
   - Uses `preference_key` from catalog
   - Uses `cooldown.per_user_seconds` from catalog
   - Uses `quiet_hours` from catalog

4. **Notification Functions:**
   - `notifyLeagueMessageV2.ts`
   - `sendScoreNotificationsWebhookV2.ts`
   - `notifyFinalSubmission.ts`
   - `notifyLeagueMemberJoin.ts`
   - etc.

## Best Practices

1. **Always update markdown first** - It's the source of truth
2. **Run build script** - Catches validation errors early
3. **Update embedded catalog** - Required for backend to use changes
4. **Test locally** - Verify TypeScript compiles and functions work
5. **Document changes** - Update the markdown body content if behavior changes

## Troubleshooting

### Build script fails with validation errors

- Check that all required fields are present in frontmatter
- Verify field types match expected types (strings, numbers, booleans, arrays)
- Check nested objects are properly formatted

### Backend uses old catalog data

- Make sure you updated `catalog.ts` (not just the JSON file)
- Rebuild TypeScript: `npm run check`
- Restart local dev server if running

### Documentation site shows old data

- Rebuild the Astro site: `cd notification_catalog/site && npm run build`
- The documentation site is separate from the embedded catalog

## Future Improvements

Consider automating Step 3 (updating embedded catalog) by:
- Extending the build script to also update `catalog.ts`
- Using a code generation approach
- Or keeping JSON and loading it at runtime (requires build-time dependency)

For now, the manual update ensures the embedded catalog stays in sync with the JSON.



