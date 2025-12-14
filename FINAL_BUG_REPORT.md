# Final Bug Report

## Summary
- **Web shows correct picks** (DB sees Sunderland=H, Forest=D)
- **Database shows wrong picks** (Sunderland=D, Forest=H)
- **54 users missing blue edges**
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
**Problem**: Filters to ONLY include league members. Users not in leagues won't get blue edge.

### Bug #2: Missing Picks in `picks` Table
- Only 16 users have picks in `picks` table
- 44 users have picks in `app_picks` table
- 32 users missing from `picks` table
- Blue edge requires picks in `picks` table

**Cause**: CSV-based scripts (`FINAL-complete-update.mjs`, `import-with-outcomes.mjs`, etc.) only update users in CSV files. Users not in CSV lose their picks.

### Bug #3: Mirror Trigger Issue
- Picks inserted out of order (fixture 9 before 7 and 8)
- Mirror trigger might be copying picks incorrectly
- Both tables have same wrong data (suggesting mirror worked, but copied wrong data)

## Where Web Gets Data

**Predictions Page** (`src/pages/Predictions.tsx`):
- Line 181: Reads fixtures from `fixtures` table
- Line 215: Reads picks from `picks` table  
- Line 236: Reads submissions from `gw_submissions` table
- Line 309: Saves picks to `picks` table

**Same Supabase database** - no different environment found.

## The Mystery

If web reads from `picks` table but database has wrong picks, yet web shows correct picks:
1. **Picks were changed AFTER DB submitted** (web shows old correct data from state)
2. **RLS is filtering results** (unlikely - would affect all queries)
3. **Different user context** (unlikely - same user)
4. **Picks are being transformed** (no transformation found)

## Most Likely Scenario

1. DB submitted: Sunderland=H, Forest=D
2. Saved to `picks` table correctly
3. Mirror trigger copied to `app_picks` correctly  
4. **Script overwrote `picks` table** with wrong data (Sunderland=D, Forest=H)
5. Mirror trigger copied wrong data to `app_picks` (or app_picks updated directly)
6. Web interface still shows correct picks in UI state (not refreshed from DB)
7. App reads from `app_picks` and shows wrong picks

## Fixes Needed

1. Remove league member filter from blue edge logic (line 1039)
2. Restore missing picks in `picks` table from `app_picks` (if app_picks has correct data)
3. Fix mirror trigger if it has bugs
4. Prevent scripts from overwriting user-submitted picks
