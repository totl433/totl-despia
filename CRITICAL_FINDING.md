# CRITICAL FINDING

## The 16 Users in `picks` Table

1. cakehurst
2. gwebby
3. Miles_o
4. Geeitsme
5. Info
6. sotbjof
7. ZoeyP
8. will
9. Mazels
10. Ed
11. Dans13
12. errorofways
13. ThomasJamesBird
14. Gavino
15. Thomas Elliott
16. Will Middleton

## Critical Discovery

**David Bird is NOT in the `picks` table!**

This means:
- The web interface **CANNOT** be reading his picks from the `picks` table
- If the web shows his picks correctly, it must be:
  1. Reading from `app_picks` table (but code shows it reads from `picks`)
  2. Showing cached/localStorage data
  3. The deployed code is different from source code
  4. There's a fallback mechanism not visible in the code

## The Real Bug

The web code (`Predictions.tsx` line 215) reads from `picks` table:
```javascript
const { data: pk, error: pkErr } = await supabase
  .from("picks")
  .select("gw, fixture_index, pick")
  .eq("gw", gw)
  .eq("user_id", user?.id);
```

But if David Bird (and many other users) are NOT in `picks` table, then:
- The query returns empty array `[]`
- `choices` state would be empty `{}`
- Web should show NO picks, not correct picks

**Unless**: The web is actually reading from `app_picks` for users not in `picks` table, or there's cached data.

## Blue Edge Bug Explained

The blue edge logic in `Home.tsx` line 995-1039:
1. Fetches user_ids from `picks` table
2. Filters to only league members
3. Only those 16 users (who are in picks table) can get blue edges

But David Bird and many others are NOT in `picks` table, so they can't get blue edges even if they have picks in `app_picks`.

## The Real Problem

**The `picks` table is missing 28+ users!**

Only 16 users have picks in `picks` table, but many more users have picks in `app_picks` table. This means:
- Web users who submitted picks had them saved to `picks` table
- But then scripts deleted their picks from `picks` table
- Their picks only exist in `app_picks` table now
- Web interface can't read their picks (reads from `picks` table)
- App can read their picks (reads from `app_picks` table)
- Blue edges don't work (checks `picks` table)

## Solution

1. **Copy picks from `app_picks` to `picks`** for all users missing from `picks` table
2. **Fix blue edge logic** to check `app_picks` if user not in `picks` table
3. **OR**: Change web to read from `app_picks` table instead of `picks` table
