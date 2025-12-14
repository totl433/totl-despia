# Root Cause Analysis

## The Problem
- **Web interface shows correct picks** (DB sees Sunderland=H, Forest=D)
- **Database shows wrong picks** (Sunderland=D, Forest=H in both `picks` and `app_picks`)
- **54 users missing blue edges** (should have blue edge but don't)
- **Only 15 users have blue edges** (should be ~69)

## Key Findings

### 1. Web Interface Reads From `picks` Table
- `Predictions.tsx` line 215: Reads from `picks` table
- `Predictions.tsx` line 309: Saves to `picks` table
- If web shows correct picks but database has wrong picks, something is wrong

### 2. Blue Edge Logic Has Two Bugs

**Bug #1: Filtering by League Members** (`Home.tsx` line 1039)
```javascript
const webUserIds = new Set(
  Array.from(webPicksUserIds).filter(
    (id: string) => allMemberIdsSet.has(id) && !appTestUserIds.has(id)
  )
);
```
- Filters to ONLY include league members
- Users not in leagues won't get blue edge even if they have picks

**Bug #2: Missing Picks in `picks` Table**
- Only 16 users have picks in `picks` table
- 44 users have picks in `app_picks` table  
- 32 users are missing from `picks` table
- Blue edge requires picks in `picks` table

### 3. CSV Scripts Delete and Reinsert Picks
Scripts like `FINAL-complete-update.mjs`:
1. Delete picks for users in CSV
2. Insert picks from CSV

**Problem**: If a user is NOT in the CSV, their picks might get deleted but never reinserted.

### 4. Picks Inserted Out of Order
- Picks were NOT inserted in fixture_index order
- Fixture 9 inserted before fixtures 7 and 8
- This shouldn't affect mirror trigger (uses fixture_index as key), but could indicate a problem

## The Mystery: Why Does Web Show Correct Picks?

If web reads from `picks` table (line 215), but database has wrong picks, then either:
1. **Web is reading from a different database/environment**
2. **Web is showing cached/localStorage data** (but no localStorage found in Predictions.tsx)
3. **Picks were changed AFTER DB submitted** (web shows old correct data, database has new wrong data)
4. **There's a view or function transforming the data** (no views found)

## Most Likely Scenario

1. DB submitted picks: Sunderland=H, Forest=D
2. Picks saved to `picks` table correctly
3. Mirror trigger copied to `app_picks` correctly
4. **Later, a script overwrote picks in `picks` table** with wrong data
5. Mirror trigger copied wrong data to `app_picks` (or app_picks was updated directly)
6. Web interface still shows correct picks (maybe from different query or cached)
7. App reads from `app_picks` and shows wrong picks

## Next Steps to Find Bug

1. Check if web reads from a different table/view
2. Check if there are multiple Supabase projects/environments
3. Check if picks were updated AFTER submission timestamp
4. Check if mirror trigger has a bug with fixture_index ordering
5. Check if scripts updated picks after DB submitted
