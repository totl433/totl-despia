# Blue Edge Bug Analysis

## Summary
- **Expected**: ALL users should have blue edge (except 4 test users: Jof, Carl, SP, ThomasJamesBird)
- **Actual**: Only 15 users have blue edge (Will Middleton, errorofways, Dans13, etc.)
- **Missing**: 54 users are missing blue edges

## Root Causes Found

### Bug #1: Filtering by League Members (CRITICAL)
**Location**: `src/pages/Home.tsx` line 1039

```javascript
const webUserIds = new Set(
  Array.from(webPicksUserIds).filter(
    (id: string) => allMemberIdsSet.has(id) && !appTestUserIds.has(id)
  )
);
```

**Problem**: The code filters `webUserIds` to ONLY include users who are in `allMemberIdsSet` (league members). This means:
- Users not in any league won't get blue edges, even if they have picks in `picks` table
- This is WRONG - blue edge should be based on having picks in `picks` table, not league membership

**Fix needed**: Remove `allMemberIdsSet.has(id)` filter. Should be:
```javascript
const webUserIds = new Set(
  Array.from(webPicksUserIds).filter(
    (id: string) => !appTestUserIds.has(id)
  )
);
```

### Bug #2: Massive Data Loss in `picks` Table
**Problem**: 
- Only **16 users** have picks in `picks` table
- **44 users** have picks in `app_picks` table
- **32 users** are missing from `picks` table

**Users missing from `picks` table include**:
- David Bird
- Ben New
- Phil Bolton
- gregory
- Matthew Bird
- Paul N
- And 26+ more...

**Possible causes**:
1. Script deleted picks from `picks` table (scripts like `FINAL-complete-update.mjs` delete and reinsert picks)
2. Picks were never in `picks` table (only mirrored to `app_picks`)
3. Mirror trigger failed, then picks were deleted
4. Script overwrote `picks` table with wrong data

## How Blue Edge Works

1. **Check `picks` table**: Get all users who have picks in `picks` table (line 995)
2. **Exclude test users**: Remove Jof, Carl, SP, ThomasJamesBird
3. **Filter by league members**: ❌ **BUG HERE** - Only include users in leagues
4. **Result**: Users get blue edge if they pass all filters

## Impact

- **54 users** are missing blue edges they should have
- **36 users** are in leagues but still missing blue edges (because they don't have picks in `picks` table)
- **18 users** are not in leagues AND missing picks (double whammy)

## Next Steps (DO NOT CHANGE TABLES YET)

1. ✅ **Found Bug #1**: Filtering by league members is wrong
2. ✅ **Found Bug #2**: Massive data loss in `picks` table
3. 🔍 **Need to find**: What deleted picks from `picks` table?
4. 🔍 **Need to check**: Are picks in `app_picks` correct, or were they also corrupted?
