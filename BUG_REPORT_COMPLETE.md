# Complete Bug Report: Wrong Picks & Missing Blue Edges

## Summary
- **Web interface shows correct picks** (DB sees Sunderland=H, Forest=D)
- **Database shows wrong picks** (Sunderland=D, Forest=H in both `picks` and `app_picks`)
- **54 users missing blue edges** (should have blue edge but don't)
- **Only 15 users have blue edges** (should be ~69)

## Root Causes Found

### Bug #1: Blue Edge Filtering by League Members
**File**: `src/pages/Home.tsx` line 1039
```javascript
const webUserIds = new Set(
  Array.from(webPicksUserIds).filter(
    (id: string) => allMemberIdsSet.has(id) && !appTestUserIds.has(id)
  )
);
```
**Problem**: Filters to ONLY include league members. Users not in leagues won't get blue edge even if they have picks in `picks` table.

**Fix**: Remove `allMemberIdsSet.has(id)` filter. Blue edge should be based solely on having picks in `picks` table.

### Bug #2: Missing Picks in `picks` Table
**Problem**:
- Only **16 users** have picks in `picks` table
- **44 users** have picks in `app_picks` table
- **32 users** are missing from `picks` table

**Cause**: CSV-based scripts (`FINAL-complete-update.mjs`, `import-with-outcomes.mjs`, etc.):
1. Delete picks for users in CSV
2. Insert picks from CSV

**Problem**: If a user is NOT in the CSV, their picks get deleted but never reinserted.

**Impact**: Users without picks in `picks` table won't get blue edge (Bug #1 also contributes).

### Bug #3: Mirror Trigger Issue
**Problem**: 
- Picks inserted out of order (fixture 9 before 7 and 8)
- Both `picks` and `app_picks` have same wrong data
- Suggests mirror trigger copied wrong data, or both tables were updated with wrong data

**Investigation Needed**: Check if mirror trigger has bugs with fixture_index ordering or if scripts updated both tables directly.

## Where Web Gets Data

**Predictions Page** (`src/pages/Predictions.tsx`):
- Line 181: Reads fixtures from `fixtures` table
- Line 215: Reads picks from `picks` table  
- Line 236: Reads submissions from `gw_submissions` table
- Line 309: Saves picks to `picks` table

**Same Supabase database** - no different environment found.

## The Mystery: Why Does Web Show Correct Picks?

If web reads from `picks` table (line 215), but database has wrong picks, yet web shows correct picks:

**Possible Explanations**:
1. **Picks were changed AFTER DB submitted** - Web shows old correct data from React state (not refreshed from DB)
2. **RLS filtering** - Unlikely, no RLS policies found on `picks` table
3. **Different user context** - Unlikely, same user
4. **Picks are being transformed** - No transformation found
5. **Web is reading from a different source** - No alternative source found in code

**Most Likely**: Picks were overwritten AFTER DB submitted. Web interface still shows correct picks in UI state (not refreshed from DB). App reads from `app_picks` and shows wrong picks.

## Data Flow

1. User submits picks on web → Saved to `picks` table
2. Mirror trigger (`mirror_picks_to_app`) copies to `app_picks`
3. **Script overwrites `picks` table** with wrong data (from CSV or other source)
4. Mirror trigger copies wrong data to `app_picks` (or app_picks updated directly)
5. Web interface still shows correct picks (from React state, not refreshed)
6. App reads from `app_picks` and shows wrong picks

## Fixes Needed

### Fix #1: Remove League Member Filter
**File**: `src/pages/Home.tsx` line 1039
```javascript
// BEFORE (WRONG):
const webUserIds = new Set(
  Array.from(webPicksUserIds).filter(
    (id: string) => allMemberIdsSet.has(id) && !appTestUserIds.has(id)
  )
);

// AFTER (CORRECT):
const webUserIds = new Set(
  Array.from(webPicksUserIds).filter(
    (id: string) => !appTestUserIds.has(id)
  )
);
```

### Fix #2: Restore Missing Picks
- Identify users missing from `picks` table
- Copy picks from `app_picks` to `picks` (if app_picks has correct data)
- Or restore from backup/CSV if available

### Fix #3: Prevent Scripts from Overwriting User Submissions
- Scripts should NOT delete picks for users not in CSV
- Only update picks for users explicitly in CSV
- Or check submission timestamp before overwriting

### Fix #4: Investigate Mirror Trigger
- Check if mirror trigger has bugs with fixture_index ordering
- Verify trigger logic is correct
- Check if picks are being swapped during mirror

## Next Steps

1. **Fix Bug #1** (remove league member filter) - This will restore blue edges for users with picks
2. **Investigate why web shows correct picks** - Check if React state is caching old data
3. **Restore missing picks** - Copy from `app_picks` or restore from backup
4. **Fix scripts** - Prevent overwriting user-submitted picks
5. **Test mirror trigger** - Verify it's working correctly
