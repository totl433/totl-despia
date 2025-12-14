# How to Restore Sim's GW16 Picks from Supabase Backup

## Problem
Sim's GW16 picks were accidentally deleted when we ran `fix-app-picks-from-web-picks.mjs`. The script deleted ALL app_picks for GW16 and only restored web users' picks. Sim is an app-only user, so his picks were lost.

## Solution: Restore from Supabase Backup

### Step 1: Access Supabase Backups

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Database** → **Backups** (or **Database** → **Point-in-Time Recovery**)

### Step 2: Find the Right Backup

Look for a backup from **BEFORE** we ran the fix script:
- **Date**: December 12, 2025
- **Time**: Before ~11:30 UTC (when we ran `fix-app-picks-from-web-picks.mjs`)
- Sim submitted his picks at `2025-12-12T11:22:40.025+00:00`, so any backup after that time but before our script ran should have his picks

### Step 3: Query Sim's Picks from Backup

You can either:

**Option A: Use Point-in-Time Recovery (Recommended)**
1. Click on the backup or use Point-in-Time Recovery
2. Open SQL Editor
3. Run this query:

```sql
SELECT 
  user_id,
  gw,
  fixture_index,
  pick,
  created_at,
  updated_at
FROM app_picks
WHERE user_id = 'c94f9804-ba11-4cd2-8892-49657aa6412c'
  AND gw = 16
ORDER BY fixture_index;
```

**Option B: Export app_picks Table**
1. Export the entire `app_picks` table from the backup
2. Filter for Sim's picks (user_id = `c94f9804-ba11-4cd2-8892-49657aa6412c`, gw = 16)

### Step 4: Save Backup Data

Save the query results as JSON in: `scripts/sim-gw16-picks-backup.json`

**Format:**
```json
[
  {
    "user_id": "c94f9804-ba11-4cd2-8892-49657aa6412c",
    "gw": 16,
    "fixture_index": 0,
    "pick": "H"
  },
  {
    "user_id": "c94f9804-ba11-4cd2-8892-49657aa6412c",
    "gw": 16,
    "fixture_index": 1,
    "pick": "A"
  },
  ...
]
```

**Important**: Only include the fields: `user_id`, `gw`, `fixture_index`, `pick`

### Step 5: Run Restoration Script

Once you have the backup file, run:

```bash
node scripts/restore-sim-picks-from-backup.mjs
```

The script will:
1. Read the backup file
2. Validate the data
3. Show you what will be restored
4. Restore Sim's picks to `app_picks` table
5. Verify the restoration

### Alternative: Manual SQL Restoration

If you prefer to restore directly via SQL:

1. Get Sim's picks from backup (as JSON or CSV)
2. Run this SQL in Supabase SQL Editor:

```sql
-- Insert Sim's picks (replace with actual values from backup)
INSERT INTO app_picks (user_id, gw, fixture_index, pick)
VALUES
  ('c94f9804-ba11-4cd2-8892-49657aa6412c', 16, 0, 'H'),
  ('c94f9804-ba11-4cd2-8892-49657aa6412c', 16, 1, 'A'),
  -- ... add all 10 picks
ON CONFLICT (user_id, gw, fixture_index)
DO UPDATE SET pick = EXCLUDED.pick;
```

## Verification

After restoration, verify Sim's picks are back:

```bash
node scripts/check-sim-gw16-picks.mjs
```

Sim should now have 10 picks for GW16 in `app_picks` table.

## Notes

- Sim's user ID: `c94f9804-ba11-4cd2-8892-49657aa6412c`
- Sim submitted GW16 at: `2025-12-12T11:22:40.025+00:00`
- GW16 has 10 fixtures (indices 0-9)
- Sim is an app-only user (not in `picks` table, only in `app_picks`)
