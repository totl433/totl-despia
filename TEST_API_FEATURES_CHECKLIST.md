# Test API Features & Buttons Checklist

This checklist covers all buttons, features, and interactions in the Test API system before going live.

## Test API Admin Page (`/test-admin-api`)

### ✅ Buttons & Features:

1. **Competition Dropdown**
   - Should show: PL, BSA, BL1, SA, FL1, PD, CL
   - Default: Premier League (PL)
   - Action: Changes competition filter for matches

2. **"Refresh Matches" Button** (Purple)
   - Location: Below competition dropdown
   - Action: Fetches upcoming matches from API for next 7 days
   - States: Enabled / "Refreshing..." (disabled)
   - Should show loading state

3. **Match Selection**
   - Checkbox on each available match
   - Click match row to toggle selection
   - Selected matches show purple background
   - Shows: Team names, kickoff time (TODAY/TOMORROW/date), status, matchday

4. **"Clear All" Button** (Red, small)
   - Location: Top right of "Selected Fixtures" section
   - Action: Clears all selected fixtures (requires confirm)
   - Should only show when fixtures are selected

5. **"Clear All Picks" Button** (Orange)
   - Location: Top right of Test GW Info section
   - Action: Deletes all picks and submissions for Test GW 1 (requires confirm)
   - States: Enabled / "Clearing..." (disabled)
   - Should show success message when done

6. **"Save Test Gameweek 1" Button** (Purple, large)
   - Location: Bottom of "Selected Fixtures" section
   - Action: Saves fixtures, clears all existing picks/submissions, updates meta
   - States: Enabled / "Saving..." (disabled)
   - Shows fixture count in button text
   - Should show success message when done

### ✅ Error/Success Messages:

- **Error Banner** (Red): Shows database/API errors
- **Success Banner** (Green): Shows confirmation of actions
- **API Error Banner** (Amber): Shows API fetch errors, rate limits, etc.

### ✅ Display Elements:

- Test GW indicator (always shows "1")
- Selected fixtures count
- Available matches count
- Match list with scroll (max-height: 384px)
- Selected fixtures list with scroll (max-height: 256px)

---

## Test API Predictions Page (`/test-api-predictions`)

### ✅ Swipe/Card View (Default):

1. **Close Button** (X, top left)
   - Action: Navigates to home page (`/`)

2. **"List View" Button** (Green gradient, top right)
   - Action: Switches to Review Mode
   - Should only show when picks exist or can be made

3. **Card Swipe Gestures**
   - Swipe left: Home Win (H)
   - Swipe right: Away Win (A)
   - Swipe down: Draw (D)
   - Visual feedback arrows appear during swipe

4. **Bottom Action Buttons** (3 buttons, fixed bottom)
   - **"Home Win"** (left)
   - **"Draw"** (center)
   - **"Away Win"** (right)
   - All buttons: Disabled if past deadline or already submitted
   - Button background changes color based on card drag state

5. **Progress Indicators**
   - Dots showing fixture progress (top center)
   - Current fixture highlighted

6. **Card Display**
   - Shows: Team badges, team names, kickoff date/time
   - Color gradient background (home/away team colors)
   - Swipe instruction icon (top right of card)

### ✅ Review Mode (When picks made but not submitted):

1. **"Back" Button** (top left)
   - Action: Returns to swipe view (first fixture)

2. **"Confirm" Button** (top right, green)
   - States:
     - Active (green): All picks made, not submitted
     - Disabled (gray): Incomplete picks
     - "✓ Submitted" (green text): Already submitted
   - Action: Submits predictions

3. **Individual Fixture Cards**
   - Each fixture shows: Teams, badges, kickoff time
   - Three buttons per fixture: Home Win / Draw / Away Win
   - Selected pick highlighted in purple/green
   - Can change picks by clicking different button
   - Buttons disabled if past deadline or submitted

4. **Deadline Display** (bottom section)
   - Shows deadline time (75 mins before first kickoff)
   - Only shows if fixtures exist

5. **Action Buttons** (bottom section):
   - **"Start Over"** (Gray)
     - Action: Clears all picks and submissions, returns to swipe view
     - Disabled if past deadline or submitted
   
   - **"Confirm Predictions (TEST)"** (Green, large)
     - States:
       - Active (green): All picks made
       - Disabled (gray): "Complete All Predictions First"
     - Action: Submits all predictions
   
   - **"Cancel"** (Text link)
     - Action: Navigates to home page

6. **Info Banner** (blue)
   - Shows: "Need to tweak something? Tap a prediction to adjust it..."
   - Or: "Your predictions are locked in..." (if submitted)

### ✅ Confirmed Predictions View (After submission):

1. **"Back" Button** (top left)
   - Action: Navigates to home page

2. **Fixture List** (read-only)
   - Shows all fixtures with confirmed picks
   - Live scores displayed if available (first 3 fixtures)
   - Buttons show:
     - Correct pick: Shiny gradient (yellow/orange/pink/purple) when game finished
     - Correct pick (live): Pulsing emerald when game live
     - Wrong pick: Gray with red flashing border + strikethrough when finished
     - Wrong pick (live): Gray with red flashing border (no strikethrough)
     - Unpicked correct outcome: Gray with thick green border when finished

3. **Live Score Indicator** (top right of first fixture group)
   - Shows: "Live X/3" or "Score X/3" (if all finished)
   - Red pulsing dot if games live
   - Only shows for first 3 fixtures

4. **LIVE/FT Badges**
   - "LIVE" (red pulsing dot) for live games
   - "FT" (gray text) for finished games

5. **Score Display** (bottom section)
   - Shows: "✅ Predictions Submitted! (TEST)"
   - Shows score: "X/Y" if games have finished

### ✅ Edge Cases & States:

1. **No Fixtures Loaded**
   - Shows: "No Test Fixtures Found"
   - Button: "Go to Test API Admin"

2. **Loading State**
   - Shows: "Loading test fixtures..."

3. **Past Deadline**
   - All pick buttons disabled
   - Shows "⚠️ Deadline Passed" message
   - "Confirm" button disabled

4. **Already Submitted**
   - Shows confirmed predictions view
   - All buttons disabled for changing picks

5. **Live Scores** (first 3 fixtures only)
   - Polls every minute for live scores
   - Shows scores, status, minute
   - Updates results map based on live scores

---

## Integration Points (Home & League Pages):

### Home Page:
- Should show Test API fixtures if user is in "API Test" league
- "Make your TEST predictions" button if not submitted
- Score display if submitted and games have results
- Uses `test_api_fixtures`, `test_api_picks`, `test_api_submissions` tables

### League Page:
- Should show Test API predictions in "GW1 Predictions" tab
- "Who's submitted" view if not all members submitted
- Only shows predictions when all members have submitted
- Filters out old/invalid picks (checks timestamp + fixture match)

---

## Data Flow:

1. **Admin creates fixtures** → `test_api_fixtures` table
2. **User makes picks** → `test_api_picks` table (saves immediately on swipe/click)
3. **User submits** → `test_api_submissions` table (adds `submitted_at` timestamp)
4. **Live scores update** → `live_scores` table (via scheduled Netlify function)
5. **Results calculated** → From `live_scores` table (first 3 fixtures)

---

## Testing Checklist:

### Admin Page:
- [ ] Can select competition
- [ ] Can fetch matches from API
- [ ] Can select/deselect matches
- [ ] Can clear selected fixtures
- [ ] Can clear all picks/submissions
- [ ] Can save test gameweek
- [ ] Error messages display correctly
- [ ] Success messages display correctly

### Predictions Page:
- [ ] Swipe gestures work (left/right/down)
- [ ] Bottom buttons work (Home/Draw/Away)
- [ ] Can switch to list/review view
- [ ] Can change picks in review mode
- [ ] Can start over
- [ ] Can confirm predictions
- [ ] Past deadline disables buttons
- [ ] Already submitted shows confirmed view
- [ ] Live scores update correctly (first 3 fixtures)
- [ ] Score calculation correct
- [ ] Button states/styling correct for live/finished games
- [ ] Progress indicators update
- [ ] Navigation works (back, close, cancel)

### Integration:
- [ ] Home page shows Test API section correctly
- [ ] League page shows Test API predictions correctly
- [ ] "Who's submitted" view works
- [ ] Only shows predictions when all submitted
- [ ] Filters out old/invalid picks correctly

---

## Known Features:

✅ **Works:**
- Swipe card interface
- Button-based picking
- Review mode
- Submission with timestamp
- Live score polling (first 3 fixtures)
- Score calculation from live scores
- Visual feedback (correct/wrong picks)
- Deadline checking (75 mins before first kickoff)

✅ **Separation:**
- Test API uses separate tables (`test_api_*`)
- Test API always uses GW/matchday 1
- Main game uses `fixtures`, `picks`, `gw_submissions`
- No data crossover between test and main game

---

## Notes for Going Live:

1. Ensure Netlify function `fetchFootballData` is deployed
2. Ensure scheduled function for live scores is running
3. Ensure all test users are in "API Test" league
4. Test deadline calculation (75 mins before first kickoff)
5. Verify live score polling works correctly
6. Check that old test picks are properly filtered out
7. Ensure submission validation works (all picks required)

