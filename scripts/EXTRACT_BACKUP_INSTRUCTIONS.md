# How to Extract Sim's Picks from Backup File

You have a `.backup` file: `db_cluster-14-12-2025@04-33-06.backup`

## Option 1: Using pg_restore (Recommended)

### Step 1: Install PostgreSQL tools (if needed)

**macOS:**
```bash
brew install postgresql
```

**Linux:**
```bash
sudo apt-get install postgresql-client
# or
sudo yum install postgresql
```

### Step 2: Extract app_picks table from backup

```bash
# Extract just the app_picks table data
pg_restore -t app_picks -f app_picks.sql db_cluster-14-12-2025@04-33-06.backup
```

### Step 3: Query for Sim's picks

Open `app_picks.sql` and look for rows with:
- `user_id = 'c94f9804-ba11-4cd2-8892-49657aa6412c'`
- `gw = 16`

Or use grep:
```bash
grep "c94f9804-ba11-4cd2-8892-49657aa6412c" app_picks.sql | grep "\t16\t"
```

### Step 4: Save as JSON

Extract the picks and save as `scripts/sim-gw16-picks-backup.json`:

```json
[
  { "user_id": "c94f9804-ba11-4cd2-8892-49657aa6412c", "gw": 16, "fixture_index": 0, "pick": "H" },
  { "user_id": "c94f9804-ba11-4cd2-8892-49657aa6412c", "gw": 16, "fixture_index": 1, "pick": "A" },
  ...
]
```

## Option 2: Restore to Temporary Database

### Step 1: Create temporary database

```bash
createdb temp_restore_db
```

### Step 2: Restore backup

```bash
pg_restore -d temp_restore_db db_cluster-14-12-2025@04-33-06.backup
```

### Step 3: Query Sim's picks

```bash
psql temp_restore_db -c "SELECT user_id, gw, fixture_index, pick FROM app_picks WHERE user_id = 'c94f9804-ba11-4cd2-8892-49657aa6412c' AND gw = 16 ORDER BY fixture_index;"
```

### Step 4: Export as JSON

```bash
psql temp_restore_db -t -A -F"," -c "SELECT user_id, gw, fixture_index, pick FROM app_picks WHERE user_id = 'c94f9804-ba11-4cd2-8892-49657aa6412c' AND gw = 16 ORDER BY fixture_index;" | \
  awk -F',' '{print "  { \"user_id\": \"" $1 "\", \"gw\": " $2 ", \"fixture_index\": " $3 ", \"pick\": \"" $4 "\" },"}' > sim-picks.json
```

### Step 5: Cleanup

```bash
dropdb temp_restore_db
```

## Option 3: Use Docker (if PostgreSQL not installed)

```bash
# Extract app_picks table
docker run --rm -v "$PWD":/backup postgres:15 \
  pg_restore -t app_picks -f /backup/app_picks.sql /backup/db_cluster-14-12-2025@04-33-06.backup

# Then follow Step 3-4 from Option 1
```

## Option 4: Use the Automated Script

I've created a script that tries to automate this:

```bash
# Place backup file in scripts/ directory
cp db_cluster-14-12-2025@04-33-06.backup scripts/

# Run extraction script
node scripts/extract-sim-picks-from-backup.mjs scripts/db_cluster-14-12-2025@04-33-06.backup
```

## After Extraction

Once you have `sim-gw16-picks-backup.json`, run:

```bash
node scripts/restore-sim-picks-from-backup.mjs
```

## Sim's Details

- User ID: `c94f9804-ba11-4cd2-8892-49657aa6412c`
- Gameweek: `16`
- Should have: 10 picks (indices 0-9)
