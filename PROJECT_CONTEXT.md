# TOTL Web - Current Project State

> **Last Updated**: 2025-01-XX (Performance optimization: Cache-first loading strategy implemented)
> 
> This is a living document. Update it when major features are added, architecture changes, or significant decisions are made.
> 
> **IMPORTANT**: See `PR.md` for execution rules. See `GAME_STATE.md` for game state system details.

## 🎯 What This App Does
TOTL is a Premier League predictions game where users:
1. Make predictions (Home/Draw/Away) before each gameweek
2. Compete in private mini-leagues (up to 8 members)
3. Track live scores and their prediction accuracy
4. Receive push notifications for goals and game events
5. View global and mini-league leaderboards

## 🏗️ Architecture Overview

### Frontend
- **Framework**: React 18.3 + TypeScript + Vite
- **Styling**: TailwindCSS
- **Routing**: React Router v7 with lazy loading
- **State**: React Context (AuthContext) + Supabase real-time
- **Game State**: Centralized `useGameweekState` hook (4 states: GW_OPEN, GW_PREDICTED, LIVE, RESULTS_PRE_GW)
  - **Key principle**: GW is LIVE between first kickoff and last FT. A game is LIVE between kickoff and FT (status IN_PLAY or PAUSED)
- **Key Libraries**: 
  - `@supabase/supabase-js` - Database & auth
  - `despia-native` - OneSignal push notifications (native app only)
  - `react-chat-elements` - Chat UI
  - `react-router-dom` - Routing
  - Platform detection utilities in `src/lib/platform.ts` (planned)

### Backend
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Functions**: Netlify Functions (TypeScript)
- **External APIs**: 
  - Football Data API (live scores)
  - OneSignal (push notifications)

### Data Flow
```
Football Data API
  ↓ (polled every 5min)
pollLiveScores (Netlify Function)
  ↓ (updates)
Supabase live_scores table
  ↓ (webhook trigger)
sendScoreNotificationsWebhook (Netlify Function)
  ↓ (sends)
OneSignal → User devices
```

### Caching & Performance
- **Cache Layer**: `src/lib/cache.ts` - localStorage-based caching with TTL
- **Pre-loading**: `src/services/initialDataLoader.ts` - Pre-warms cache on app init
- **Strategy**: Cache-first with background refresh
  - Synchronous cache checks for instant rendering
  - Background refresh for stale data (non-blocking)
  - All critical data pre-loaded during Volley loading screen

## 🌐 Platform Differentiation (Web vs Native App)

TOTL is served on two platforms:
- **Web Browser**: playtotl.com (public-facing website) - *planned for post-migration*
- **Native App**: Despia wrapper (iOS/Android via Despia platform)

### Platform Detection
- **Utility**: `src/lib/platform.ts` (planned)
  - `isNativeApp()` - Returns `true` if running in Despia native app
  - `isWebBrowser()` - Returns `true` if running in web browser
- **Detection Method**: Checks for `despia` object or `onesignalplayerid` global property
- **Current**: Uses `isDespiaAvailable()` from `src/lib/pushNotificationsV2.ts` (will be centralized)

### Platform-Specific Features

#### Web-Only Features (Planned)
- **Cookie Consent Banner**: Required for GDPR/CCPA compliance (Termly integration)
- **App Promotion Modal**: Shows on first visit/login to encourage app download

#### Native App-Only Features  
- **Push Notifications**: OneSignal integration via Despia (not available in web)
- **Notification Centre**: Full notification preferences UI (will be hidden on web)
- **WhatsApp Deep Links**: Uses `whatsapp://` protocol (web uses `https://wa.me/`)

#### Shared Features
- All game functionality (predictions, leaderboards, mini-leagues)
- Authentication and user profiles
- Live scores and results
- Legal pages (Privacy Policy, Terms, Cookie Policy)

### Implementation Pattern (Planned)
```typescript
import { isNativeApp, isWebBrowser } from '../lib/platform';

// Conditional rendering
{isNativeApp() && <NotificationCentreButton />}
{isWebBrowser() && <CookieConsent />}
```

### Implementation Status
- ⏳ **Planned**: See `PLATFORM_DIFFERENTIATION_PLAN.md` for full implementation plan
- **Ready for execution**: After migration to playtotl.com

### Related Documentation
- `PLATFORM_DIFFERENTIATION_PLAN.md` - Full implementation plan (planned for post-migration)

## 📁 Project Structure

```
src/
├── main.tsx              # App entry, routing, auth gate
├── App.tsx               # Alternative router (legacy?)
├── pages/                # 18 active page components (+ unused in _unused/)
│   ├── Home.tsx          # Main dashboard (eagerly loaded)
│   ├── Tables.tsx         # League tables (eagerly loaded)
│   ├── Global.tsx         # Global leaderboard (eagerly loaded)
│   ├── Predictions.tsx   # Predictions center (eagerly loaded)
│   ├── League.tsx         # Mini-league page (lazy)
│   ├── Admin.tsx         # Web admin (lazy)
│   ├── ApiAdmin.tsx      # App admin (lazy)
│   ├── Profile.tsx       # User profile (lazy)
│   ├── Stats.tsx         # User stats (lazy)
│   ├── NotificationCentre.tsx # Notification settings (lazy)
│   ├── EmailPreferences.tsx # Email preferences (lazy)
│   ├── CreateLeague.tsx  # Create league (lazy)
│   ├── HowToPlay.tsx     # How to play guide (lazy)
│   ├── CookiePolicy.tsx  # Cookie policy (lazy)
│   ├── SwipeCardPreview.tsx # Swipe card preview (lazy)
│   ├── AdminData.tsx     # Admin data view (lazy)
│   ├── TempGlobal.tsx    # Temp global view (lazy)
│   └── _unused/          # Unused/legacy pages (moved here)
├── components/           # 131 reusable components
│   ├── BottomNav.tsx    # Bottom navigation
│   ├── PredictionsBanner.tsx
│   ├── FloatingProfile.tsx
│   └── ...
├── features/
│   └── auth/            # Auth components (AuthGate, AuthFlow, SignInForm, etc.)
│       └── AuthGate.tsx # Main auth route handler (replaces old Auth.tsx page)
├── context/
│   └── AuthContext.tsx  # Auth state management
├── hooks/
│   └── useGameweekState.ts  # CRITICAL: Game state hook (always use this)
├── lib/
│   ├── supabase.ts      # Supabase client
│   ├── gameweekState.ts # Game state utility functions
│   └── ...
├── services/            # Data services
│   └── initialDataLoader.ts
└── ...

netlify/functions/      # 48 Netlify serverless functions
supabase/sql/           # 34 SQL migration files
scripts/                # 262 utility scripts (.mjs, .sql, .sh)
```

## 🔑 Key Features & Current State

### ✅ Working Features
- **Authentication**: Supabase Auth with protected routes
- **Live Scores**: Real-time updates from Football Data API
- **Predictions**: Users can submit predictions before deadline
- **Mini-Leagues**: Create/join leagues with codes (max 8 members)
- **Push Notifications**: OneSignal integration via Despia
- **Leaderboards**: Global and mini-league rankings
- **Onboarding**: Welcome flow for new users
- **Game State System**: Centralized 4-state system (GW_OPEN, GW_PREDICTED, LIVE, RESULTS_PRE_GW)

### ⚠️ Known Issues
- **Netlify Deployment**: Wrong repository connection (see `NETLIFY_DEPLOYMENT_BLOCKED.md`)
- **Vercel Integration**: Shows errors but not primary deployment

### 🚧 Recent Changes
- Push notification system migrated to webhook-based (v2)
- Live scores system uses `live_scores` table as single source of truth
- Auth flow with AuthGate component protecting routes (uses `src/features/auth/`, not `src/pages/Auth.tsx`)
- Game state system implemented with `useGameweekState` hook
- Gameweek transition system: users choose when to move to new GW (stored in `user_notification_preferences.current_viewing_gw`)
- All-submitted notifications now work for all mini-leagues (not just API Test)
- Unused pages moved to `src/pages/_unused/` folder

## 🗄️ Database Schema (Key Tables)

### Core Tables
- `users` - User profiles
- `app_fixtures` - Premier League fixtures (use for fixture details)
- `test_api_fixtures` - Test fixtures for development
- `live_scores` - Current scores (updated by pollLiveScores) - **USE FOR LIVE DATA**
- `app_gw_results` - Official H/D/A results of finished games - **USE FOR FINAL RESULTS**
- `predictions` / `app_gw_submissions` - User predictions
- `mini_leagues` - League data
- `push_subscriptions` - OneSignal player IDs
- `notification_state` - Tracks sent notifications (prevents duplicates)
- `meta` - App metadata (current_gw, etc.)
- `user_notification_preferences` - User preferences including `current_viewing_gw`

### Views (Single Source of Truth)
- `app_v_gw_points` - Gameweek points calculations
- `app_v_ocp_overall` - Overall leaderboard calculations

## 🎮 Game State System

The app uses a centralized 4-state system for gameweeks:

1. **GW_OPEN**: New GW published, user hasn't submitted predictions (before first kickoff)
2. **GW_PREDICTED**: User submitted, but first kickoff hasn't happened
3. **LIVE**: First kickoff happened AND last game hasn't finished (FT)
4. **RESULTS_PRE_GW**: GW has finished (last game has reached FT AND no active games)

**Key Principles:**
- **GW is LIVE**: Between first kickoff and last FT (last game by kickoff time must reach FT)
- **Game is LIVE**: Between kickoff and FT (status IN_PLAY or PAUSED in `live_scores`)

**CRITICAL**: Always use `useGameweekState` hook. Never create custom state logic. See `GAME_STATE.md` for full details.

## 🔧 Development Workflow

### Running Locally
```bash
npm run dev              # Start dev server + Tailwind watch
npm run build            # Production build
npm run check            # Type check + build
```

### Key Scripts
- `scripts/monitor-jof-notifications.mjs` - Check notification status
- `scripts/check-live-score.mjs` - Debug live scores
- `scripts/fix-finished-game.mjs` - Manually set game status

### Netlify Functions
- `pollLiveScores` - Scheduled (every 5min), polls Football Data API
- `sendScoreNotificationsWebhook` - Webhook-triggered, sends notifications
- `registerPlayer` - Registers OneSignal player IDs
- `sendPushAll` - Broadcast notifications

## 📚 Important Documentation

### Execution Rules (MUST READ)
- `PR.md` - Core execution rules (single source of truth, testing, debugging, game state)

### System Architecture
- `GAME_STATE.md` - Game state system (4 states, useGameweekState hook, component behavior)
- `API_SYSTEM_EXPLAINER.md` - Live scores system
- `NOTIFICATIONS_V2_MIGRATION_COMPLETE.md` - Notification architecture
- `DESPIA_DOCUMENTATION.md` - Despia/OneSignal setup
- `PLATFORM_DIFFERENTIATION_PLAN.md` - Platform differentiation implementation plan (web vs native app)

### Guides
- `JOF_SIMPLE_GUIDE.md` - Simple task guides
- `NOTIFICATION_DEBUG_GUIDE.md` - Debugging notifications

### Issues & Fixes
- `NETLIFY_DEPLOYMENT_BLOCKED.md` - Deployment issue
- `PUSH_NOTIFICATION_ISSUE.md` - Notification problems
- Many other issue-specific docs in root

## 🎨 Design Patterns

### Component Structure
- Pages in `src/pages/`
- Reusable components in `src/components/`
- Feature-specific code in `src/features/`
- Utilities in `src/lib/`

### Loading Strategy

#### Pre-loading & Caching (Performance Optimization)
- **Initial Data Loader** (`src/services/initialDataLoader.ts`): Pre-warms cache during app initialization
  - Blocks on critical data: fixtures, picks, league data, ML live tables, user submissions, game state, live scores
  - Pre-caches for instant page loads: Home, Predictions, Global, Tables pages
  - Cache TTL: HOME (5min), GLOBAL (10min), PREDICTIONS (5min)
  
- **Cache-First Strategy**: All pages check cache synchronously on mount
  - Instant render if cache is fresh (< TTL threshold)
  - Background refresh if cache is stale
  - Blocking fetch only if no cache exists
  - **Single source of truth**: Read cache once, pass data via props/state to avoid redundant reads
  
- **Synchronous State Initialization**: Components initialize state from cache immediately in `loadInitialStateFromCache()`
  - State initialized before first render (no loading spinners when cache exists)
  - Example: `liveScoresFromCache` state initialized from `initialState.liveScores`
  - Data appears instantly on page load
  - Background updates refresh data silently via hooks/subscriptions
  
- **Props-Based Data Flow**: Parent components calculate derived data from cache and pass as props
  - Avoids child components re-reading cache (e.g., LeaderboardsSection receives pre-calculated live scores)
  - Single cache read per data type, data flows down via props
  - Example: HomePage calculates `currentGwLiveScore` from cache and passes to LeaderboardsSection
  
- **Font Loading Optimization**: 
  - Font preloading via `<link rel="preload">` in `index.html`
  - `font-display: block` prevents layout shift during font loading
  - Ensures text renders with correct sizing immediately

#### Page Loading
- **Eagerly loaded**: Home, Tables, Global, Predictions (BottomNav pages)
- **Lazy loaded**: League, Admin, Profile, etc.
- Uses `Suspense` with `PageLoader` fallback for lazy routes
- All critical data pre-loaded before initial render

#### Cache Keys
- `home:basic:${userId}` - Basic home page data (GW, points, overall)
- `home:fixtures:${userId}:${gw}` - Fixtures with live scores and user picks
- `home:gwResults:${gw}` - GW results for fixture outcomes
- `home:leagueData:${userId}:${gw}` - Mini-league data
- `ml_live_table:${leagueId}:${gw}` - ML live table data (fixtures, picks, submissions, results)
- `gameState:${gw}` - Gameweek state (GW_OPEN, LIVE, etc.)
- `user:submissions:${userId}` - User submission status for all GWs
- `app:lastCompletedGw` - Last completed GW (avoids DB query)

### Game State Pattern
```typescript
import { useGameweekState } from '../hooks/useGameweekState';

// Global state (no userId)
const { state, loading, error } = useGameweekState(currentGw);

// User-specific state (with userId)
const { state, loading, error } = useGameweekState(currentGw, user?.id);

// Then use state: 'GW_OPEN' | 'GW_PREDICTED' | 'LIVE' | 'RESULTS_PRE_GW'
```

### Styling
- TailwindCSS utility classes
- Custom theme colors (see `tailwind.config.cjs`)
- "Old school" theme mode available

## 🚀 Deployment

### Primary: Netlify
- **Branch**: `staging`
- **Build**: `npm run build`
- **Publish**: `dist/`
- **Functions**: `netlify/functions/`
- **Config**: `netlify.toml`

### Secondary: Vercel
- Currently has connection issues (not critical)

## 💡 Common Tasks

### Adding a New Page
1. Create component in `src/pages/`
2. Add route in `src/main.tsx`
3. Use lazy loading if not critical path
4. Add to BottomNav if needed
5. **For performance**: Implement cache-first loading pattern (see `Home.tsx` example)
   - Initialize state from cache synchronously
   - Background refresh if cache is stale
   - Pre-load data in `initialDataLoader.ts` if page is critical

### Implementing Cache-First Loading (Best Practice)
When adding new pages or optimizing existing ones, follow this pattern to ensure instant loading:

1. **Create `loadInitialStateFromCache()` function**:
   - Load all required data from cache synchronously (before first render)
   - Return object with all initial state values
   - Return empty/fallback values if no cache exists

2. **Initialize state from cache**:
   ```typescript
   const initialState = loadInitialStateFromCache();
   const [data, setData] = useState(initialState.data);
   ```

3. **Merge with hook updates**:
   - Use `useMemo` to merge cached state with hook data
   - Prioritize cached data for instant display
   - Hook updates refresh silently in background

4. **Avoid redundant cache reads**:
   - Read cache once per data type in parent component
   - Pass pre-calculated data as props to children
   - Don't re-read the same cache key in child components

5. **Example pattern** (from HomePage):
   ```typescript
   // Load from cache synchronously (before render)
   const loadInitialStateFromCache = () => {
     const cached = getCached<DataType>(`cache:key`);
     return { data: cached?.data || defaultData, hasCache: !!cached };
   };
   
   // Initialize state from cache
   const initialState = loadInitialStateFromCache();
   const [data, setData] = useState(initialState.data);
   
   // Merge with hook updates (background refresh)
   const mergedData = useMemo(() => {
     return { ...data, ...hookData };
   }, [data, hookData]);
   ```

### Adding a Netlify Function
1. Create `.ts` file in `netlify/functions/`
2. Export handler function
3. Configure in `netlify.toml` if scheduled

### Working with Game State
1. Import `useGameweekState` hook
2. Pass `currentGw` and optionally `userId`
3. Check `GAME_STATE.md` for component behavior rules
4. Use correct data source based on state:
   - LIVE: `live_scores` table
   - RESULTS: `app_gw_results` table
5. Test in all 4 states

### Debugging Notifications
1. Check `scripts/monitor-jof-notifications.mjs`
2. Review `push_subscriptions` table
3. Check `notification_state` for duplicates
4. See `NOTIFICATION_DEBUG_GUIDE.md`

## 🔄 Keeping This Updated

When you make significant changes:
1. Update the "Last Updated" date
2. Add new features to "Working Features"
3. Document architecture changes
4. Note any new patterns or conventions
5. Update "Recent Changes" section

---

**Note**: This file should be your first reference when starting work. Always check `PR.md` for execution rules and `GAME_STATE.md` for game state details.

