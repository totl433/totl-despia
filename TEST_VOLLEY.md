# Testing Volley Chat Messages

## How to Test

### 1. Test Congratulations for Latest Completed Gameweek

You can trigger Volley congratulations messages for the latest completed gameweek in three ways:

#### Option A: Using the Test Script (Easiest)

```bash
# Make sure your .env file has VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
# For local dev (with npm run dev running):
NETLIFY_FUNCTION_URL=http://localhost:8888 node scripts/test-volley-congrats.mjs

# For a specific gameweek:
NETLIFY_FUNCTION_URL=http://localhost:8888 node scripts/test-volley-congrats.mjs 20

# On Netlify (replace with your URL):
NETLIFY_FUNCTION_URL=https://your-site.netlify.app node scripts/test-volley-congrats.mjs
```

#### Option B: Using the Test Function via curl

**In Local Development:**
```bash
# Start your dev server first
npm run dev

# Then in another terminal, trigger the test function:
curl http://localhost:8888/.netlify/functions/testVolleyCongratulations
```

**On Netlify (Production/Staging):**
```bash
# Replace YOUR_SITE_URL with your actual Netlify URL
curl https://YOUR_SITE_URL.netlify.app/.netlify/functions/testVolleyCongratulations
```

#### Option C: Direct API Call

```bash
# For a specific gameweek:
curl -X POST https://YOUR_SITE_URL.netlify.app/.netlify/functions/sendVolleyGwCongratulations \
  -H "Content-Type: application/json" \
  -d '{"gameweek": 20}'

# Or use the test function which auto-detects latest:
curl https://YOUR_SITE_URL.netlify.app/.netlify/functions/testVolleyCongratulations
```

### 2. Test Gameweek Ready Messages

When you publish a new gameweek in API Admin, Volley will automatically send "ready" messages to all leagues. To test manually:

```bash
curl -X POST https://YOUR_SITE_URL.netlify.app/.netlify/functions/sendVolleyGwReady \
  -H "Content-Type: application/json" \
  -d '{"gameweek": 21}'
```

### 3. Check the Results

After triggering, check:
1. **League chat** - Open any mini-league and go to the chat tab
2. **Look for Volley** - You should see:
   - Volley's avatar (Volley-Leaning-With-Ball.png in a circle)
   - Name: "Volley"
   - One of the randomized messages

### 4. What Messages You'll See

**Gameweek Ready (when publishing):**
- "Gameweek X is ready to go. Hit the banner up top when you're ready to move on."
- "Next up: Gameweek X. Tap the banner to jump in."

**Congratulations (when gameweek completes):**
- "🎉 We have a winner! Congrats to [Name] — top of the table this round."
- "🏆 Round complete. Take a bow, [Name]."
- "👏 And the winner is… [Name]! Nicely done."
- "🥇 That one belongs to [Name]. Strong week."

### 5. Notes

- Messages are **idempotent** - won't send duplicates if triggered multiple times
- Only sends to leagues with 2+ members
- Only sends congratulations for single winners (skips ties)
- Volley messages are read-only (users can react and reply, but can't edit/delete)
- **Volley messages do NOT trigger push notifications or badges** - they appear silently in chat

### 6. Troubleshooting

If messages don't appear:
1. Check the function logs in Netlify dashboard
2. Verify the gameweek has results in `app_gw_results`
3. Verify the gameweek has picks in `app_picks` or `gw_picks`
4. Check that leagues have at least 2 members
5. Check browser console for any errors

