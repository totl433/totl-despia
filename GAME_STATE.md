# Game State System

## Overview

The game state system is a centralized way to determine what phase a gameweek is in. This ensures consistent behavior across the entire application and prevents inconsistent UI updates.

**Key Principles:**
- **GW is LIVE**: Between first kickoff and last FT (last game by kickoff time must reach FT)
- **Game is LIVE**: Between kickoff and FT (status IN_PLAY or PAUSED in `live_scores`)

## Game States

There are **4 game states** that a gameweek can be in:

### 1. `GW_OPEN`
**When:** New gameweek published, before first kickoff, and user hasn't submitted predictions yet.

**Characteristics:**
- Fixtures exist for the gameweek
- First kickoff hasn't happened yet
- User hasn't submitted predictions (if checking user-specific state)

**What should happen:**
- Show "Make your predictions" banner
- Show upcoming fixtures with kickoff times
- Show previous GW results in leaderboards
- Show previous GW stats
- Predictions icon in bottom nav is shiny (until user submits)

### 2. `GW_PREDICTED`
**When:** User has submitted predictions, but first kickoff hasn't happened yet.

**Characteristics:**
- Fixtures exist for the gameweek
- First kickoff hasn't happened yet
- User HAS submitted predictions (user-specific state only)

**What should happen:**
- Hide "Make your predictions" banner
- Show upcoming fixtures with kickoff times
- Show previous GW results in leaderboards
- Show previous GW stats
- Predictions icon in bottom nav is NOT shiny (user has submitted)

### 3. `LIVE`
**When:** First kickoff has happened AND last game hasn't finished (FT).

**Characteristics:**
- First kickoff has occurred
- Last game (by kickoff time) has NOT reached FT (status !== 'FINISHED' in `live_scores`)
- May have some games finished, but as long as the last game hasn't reached FT, GW is still LIVE

**What should happen:**
- Hide "Make your predictions" banner
- Show live scores and updates
- Show active live leaderboards (Last GW, Season Rank)
- Show static stats (no updates during LIVE)
- Show live indicators (red pulsing dots) on relevant sections
- Use "Active Live" mode for some sections (points update in real-time as if final, then lock at FT)

### 4. `RESULTS_PRE_GW`
**When:** Gameweek has finished (last game has reached FT AND no active games).

**Characteristics:**
- Last game (by kickoff time) has reached FT (status === 'FINISHED' in `live_scores`)
- No active games in `live_scores` (no `IN_PLAY` or `PAUSED` status)

**What should happen:**
- Show final results (completed fixtures)
- Show shiny winner chips in Mini Leagues
- Show final GW results in all leaderboards
- Show updated stats for completed GW (update once when it finishes)
- Show "GW Coming soon" banner if next GW not published
- Show "GW ready" banner if next GW published but user hasn't transitioned yet

## User-Specific vs Global State

### Global State (`getGameweekState`)
- Used when you don't need to know if a specific user has submitted
- Returns: `GW_OPEN`, `LIVE`, or `RESULTS_PRE_GW`
- Never returns `GW_PREDICTED` (that's user-specific)

### User-Specific State (`getUserGameweekState`)
- Used when you need to know if a specific user has submitted predictions
- Returns: `GW_OPEN`, `GW_PREDICTED`, `LIVE`, or `RESULTS_PRE_GW`
- Returns `GW_PREDICTED` if user has submitted but first kickoff hasn't happened

## Implementation

### Using the Hook

```typescript
import { useGameweekState } from '../hooks/useGameweekState';

// Global state (no userId)
const { state, loading, error } = useGameweekState(currentGw);

// User-specific state (with userId)
const { state, loading, error } = useGameweekState(currentGw, user?.id);
```

### Using the Utility Functions

```typescript
import { getGameweekState, getUserGameweekState } from '../lib/gameweekState';

// Global state
const state = await getGameweekState(gw);

// User-specific state
const state = await getUserGameweekState(gw, userId);
```

## Real-Time Updates

The `useGameweekState` hook automatically subscribes to:
- `app_gw_results` - When results are published
- `live_scores` - When game status changes
- `app_fixtures` - When kickoff times change
- `app_gw_submissions` - When user submits predictions (if userId provided)

The state will automatically update when any of these change.

## Component Behavior by State

### Home Page

**Mini League Cards:**
- `GW_OPEN` / `GW_PREDICTED`: Green/grey chips for who's submitted
- `LIVE`: Green/grey chips for who's submitted
- `RESULTS_PRE_GW`: Shiny winner chips

**Games Section:**
- `GW_OPEN` / `GW_PREDICTED`: Upcoming fixtures with kickoff times
- `LIVE`: Live scores/updates
- `RESULTS_PRE_GW`: Final results

**Leaderboards Section:**
- `GW_OPEN` / `GW_PREDICTED`: Previous GW score
- `LIVE`: Last GW and Season Rank show active live; 5-WEEK and 10-WEEK show previous GW
- `RESULTS_PRE_GW`: All show results from the GW

### Predictions Page
- `LIVE`: Shows live scores
- `RESULTS_PRE_GW`: Shows completed fixtures

### League Page - Table Tab
- Same chip behavior as Mini Leagues on Home Page

### Global Leaderboard Page
- `GW_OPEN` / `GW_PREDICTED`: Show last GW results
- `LIVE`: GW and GLOBAL are active live
- `RESULTS_PRE_GW`: Show results from completed GW

### Predictions Banner (Top Banner)
- `GW_OPEN`: Show "Make your predictions"
- `GW_PREDICTED`: Show nothing
- `LIVE`: Show nothing
- `RESULTS_PRE_GW`: Either "GW Coming soon" (if next GW not published) OR "GW ready" banner (if new GW published, user clicks to transition)

### Bottom Navigation
- Predictions icon is shiny until user submits their picks (after they've clicked to move to next GW)

### STATS Page
- `GW_OPEN` / `GW_PREDICTED`: Show previous GW stats
- `LIVE`: Show static stats (no live updates)
- `RESULTS_PRE_GW`: Show updated stats for completed GW (updated once when it finishes)

## GW Transition System

When a new gameweek is published while the user is still viewing results:

1. **User stays in `RESULTS_PRE_GW`** for the previous GW
2. **Banner appears**: "Gameweek X is ready for you. Play now?"
3. **User clicks banner**: 
   - `current_viewing_gw` is updated in `user_notification_preferences`
   - Shimmer animation plays
   - Page refreshes
   - User transitions to `GW_OPEN` for the new GW

This allows users to review results before moving on to the next gameweek.

## Individual Game LIVE Status

**Key Principle:** A game is LIVE between kickoff and FT.

A game is considered LIVE when:
- `status === 'IN_PLAY'` in `live_scores` (game is actively playing)
- `status === 'PAUSED'` in `live_scores` (half-time, still between kickoff and FT)

A game is NOT LIVE when:
- `status === 'FINISHED'` in `live_scores` (game has reached FT)
- No entry in `live_scores` and current time is before kickoff (game hasn't started)

This is separate from GW LIVE state - a GW can be LIVE even if some individual games have finished, as long as the last game hasn't reached FT.

## Data Sources

### For Determining State:
- `app_fixtures` - Fixture details and kickoff times
- `app_gw_results` - Official H/D/A results of finished games
- `live_scores` - Real-time match status (IN_PLAY, PAUSED, FINISHED)
- `app_gw_submissions` - User prediction submission status

### For Displaying Content:
- `live_scores` - For live scores, goals, red cards, current match status
- `app_gw_results` - For official results of finished games
- `app_v_gw_points` - For gameweek points calculations
- `app_v_ocp_overall` - For overall leaderboard calculations

## Best Practices

1. **Always use `useGameweekState` hook** in components that need to know the current state
2. **Pass `userId`** when you need user-specific behavior (e.g., showing/hiding prediction banners)
3. **Don't create custom state logic** - use the centralized system
4. **Check state before rendering** - wait for `loading === false` before using state
5. **Handle all states** - make sure your component behaves correctly in all 4 states
6. **Use real-time subscriptions** - the hook handles this automatically, but be aware of the subscriptions

## Common Patterns

### Checking if user should see prediction banner:
```typescript
const { state } = useGameweekState(currentGw, user?.id);
const showBanner = state === 'GW_OPEN';
```

### Checking if showing live data:
```typescript
const { state } = useGameweekState(currentGw);
const isLive = state === 'LIVE';
```

### Checking if showing results:
```typescript
const { state } = useGameweekState(currentGw);
const showResults = state === 'RESULTS_PRE_GW';
```

### Checking if user has submitted:
```typescript
const { state } = useGameweekState(currentGw, user?.id);
const hasSubmitted = state === 'GW_PREDICTED' || state === 'LIVE' || state === 'RESULTS_PRE_GW';
```

## Migration Notes

If you're updating an existing component:
1. Import `useGameweekState` hook
2. Replace any custom state logic with the hook
3. Update conditional rendering to use the state values
4. Test in all 4 states to ensure correct behavior
5. Remove any old state-checking code

