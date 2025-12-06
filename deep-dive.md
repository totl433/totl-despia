TOTL Web Application Architecture Analysis Report

Part 1: Architecture Overview (Current State)
1.1 Entry Point and Application Bootstrap
The web application is a React Single Page Application (SPA) built with Vite. The main entry point is src/main.tsx, which:
Imports global styles (index.css, react-chat-elements.css)
Defines a hierarchy of providers and the routing structure
Renders into the DOM element with id root in index.html
The bootstrap sequence proceeds as follows:
ReactDOM.createRoot mounts the application
React.StrictMode wraps the entire tree
AuthProvider (from context/AuthContext.tsx) wraps the application, establishing authentication context
AppShell component renders, which in turn renders BrowserRouter and AppContent
AppContent manages the loading sequence, feature flags, and conditional rendering based on authentication and data loading states

1.2 Routing System
The application uses React Router DOM v7 with BrowserRouter for client-side routing. Routes are defined in src/main.tsx within the AppContent component.
Eagerly loaded pages (imported at module top-level):
HomePage (/)
TablesPage (/tables)
GlobalPage (/global)
PredictionsPage (/predictions)
Lazy loaded pages (using React.lazy):
LeaguePage (/league/:code)
ProfilePage (/profile)
AdminPage (/admin)
CreateLeaguePage (/create-league)
HowToPlayPage (/how-to-play)
Various test/debug pages
The eagerly loaded pages correspond to the bottom navigation tabs, intended to provide instant navigation for the primary user flows.

1.3 State Management Architecture
The application does not use a centralised state management library like Redux or Zustand. Instead, it relies on:
React Context API:
AuthContext – manages user session, authentication state, welcome message dismissal
No other major contexts identified
Local Component State (useState):
Each page manages its own data loading state
Heavy use of useState for leagues, fixtures, leaderboards, picks, submissions, and UI state
localStorage-based Caching:
src/lib/cache.ts – primary cache layer with TTL-based expiration (prefix: despia:cache:)
src/api/client.ts – secondary API client cache (prefix: api_cache_)
src/lib/nativeStorage.ts – abstraction layer that falls back to localStorage in web environments
Supabase Realtime Subscriptions:
useLiveScores hook subscribes to live_scores table changes
League chat uses realtime subscriptions for new messages

1.4 Despia Native Wrapper Integration
Despia is a platform that wraps the web application in a native iOS/Android shell. The integration works as follows:
URL Loading: Despia loads the deployed web application (hosted on Netlify) via its WebView. The production URL is served from Netlify at the deployment domain. The specific URL Despia loads is configured in the Despia dashboard, not in the codebase.
Native-to-Web Bridge: Despia exposes native functionality via a protocol handler system:
Commands are issued by setting window.despia = "feature://parameters"
Results are exposed as global properties (e.g., window.onesignalplayerid)
Detection Logic (from src/lib/pushNotifications.ts and documentation):
The app checks multiple locations for Despia: globalThis.despia, window.despia, globalThis.onesignalplayerid
Falls back to browser-mode gracefully when not in native context
Used Integrations:
OneSignal Player ID retrieval for push notifications
Push permission requests

1.5 Build and Deploy Flow
Build Process:
npm run tailwind:build – compiles Tailwind CSS
tsc -b – TypeScript compilation
vite build – bundles the application
Output:
dist/ folder containing index.html and hashed asset bundles
JavaScript chunks are named with content hashes (e.g., index-8pBbLkE_.js)
Lazy-loaded routes produce separate chunks
Hosting: Netlify
netlify.toml configures build command, publish directory, and redirects
SPA routing redirect: all non-asset paths serve index.html
Static assets served directly from /assets/*
Netlify Functions handle serverless operations
Cache Headers: Not explicitly configured in the codebase. Default Netlify behaviour applies, which typically sets long cache headers for hashed assets and short cache for HTML.
Version Control: Despia loads whatever URL is configured. There is no evidence of version pinning or explicit versioning strategy for the Despia build. The native app presumably always loads the latest deployed version from the production URL.

1.6 Layering Diagram (Text-Based)
┌─────────────────────────────────────────────────────────────────────┐│                        DESPIA NATIVE SHELL                          ││   (iOS/Android app with WebView, OneSignal SDK, protocol handlers)  │└───────────────────────────────┬─────────────────────────────────────┘                                │                                ▼ (loads URL from Netlify)┌─────────────────────────────────────────────────────────────────────┐│                         WEB ENTRY (index.html)                      ││                    ↓ loads /src/main.tsx bundle                     │└───────────────────────────────┬─────────────────────────────────────┘                                │                                ▼┌─────────────────────────────────────────────────────────────────────┐│                        REACT PROVIDERS                              ││  ┌──────────────────────────────────────────────────────────────┐  ││  │ React.StrictMode                                              │  ││  │  └─ AuthProvider (AuthContext)                               │  ││  │       └─ AppShell                                            │  ││  │            └─ BrowserRouter                                  │  ││  │                 └─ AppContent                                │  ││  └──────────────────────────────────────────────────────────────┘  │└───────────────────────────────┬─────────────────────────────────────┘                                │                                ▼┌─────────────────────────────────────────────────────────────────────┐│                     INITIAL LOAD SEQUENCE                           ││  ┌────────────────────────────────────────────────────────────────┐ ││  │ 1. Check feature flag: loadEverythingFirst (default: true)    │ ││  │ 2. If enabled: show LoadingScreen                             │ ││  │ 3. Call loadInitialData(userId) from initialDataLoader.ts     │ ││  │ 4. Populate cache with fetched data                           │ ││  │ 5. Set initialDataLoaded = true → render app                  │ ││  │ 6. Timeout fallbacks (10s, 15s) if loading hangs              │ ││  └────────────────────────────────────────────────────────────────┘ │└───────────────────────────────┬─────────────────────────────────────┘                                │                                ▼┌─────────────────────────────────────────────────────────────────────┐│                   ROUTER / NAVIGATION LAYER                         ││  ┌────────────────────────────────────────────────────────────────┐ ││  │ React Router v7 <Routes>                                       │ ││  │   /           → HomePage (eager)                              │ ││  │   /tables     → TablesPage (eager)                            │ ││  │   /global     → GlobalPage (eager)                            │ ││  │   /predictions → PredictionsPage (eager)                      │ ││  │   /league/:code → LeaguePage (lazy, Suspense)                 │ ││  │   /profile    → ProfilePage (lazy)                            │ ││  │   /auth       → SignIn (lazy)                                 │ ││  │   ...other routes...                                          │ ││  └────────────────────────────────────────────────────────────────┘ │└───────────────────────────────┬─────────────────────────────────────┘                                │                                ▼┌─────────────────────────────────────────────────────────────────────┐│                    GLOBAL STATE / STORES                            ││  ┌─────────────────────────────────────────────────────────────────┐││  │ AuthContext                                                     │││  │   - user, session, loading                                      │││  │   - signOut(), dismissWelcome()                                 │││  │   - Push notification registration                              │││  └─────────────────────────────────────────────────────────────────┘││  ┌─────────────────────────────────────────────────────────────────┐││  │ localStorage Cache Layers                                       │││  │   - despia:cache:* (cache.ts, TTL-based)                        │││  │   - api_cache_* (client.ts, TTL-based)                          │││  │   - totl:user (manual user storage fallback)                    │││  └─────────────────────────────────────────────────────────────────┘││  ┌─────────────────────────────────────────────────────────────────┐││  │ Feature Flags (localStorage)                                    │││  │   - feature:loadEverythingFirst (default: true)                 │││  └─────────────────────────────────────────────────────────────────┘│└───────────────────────────────┬─────────────────────────────────────┘                                │                                ▼┌─────────────────────────────────────────────────────────────────────┐│                    API / BACKEND SERVICES                           ││  ┌─────────────────────────────────────────────────────────────────┐││  │ Supabase Client (src/lib/supabase.ts)                           │││  │   - Auth (session, tokens)                                      │││  │   - Database queries (leagues, fixtures, picks, results, etc.)  │││  │   - Realtime subscriptions (live_scores, league_messages)       │││  └─────────────────────────────────────────────────────────────────┘││  ┌─────────────────────────────────────────────────────────────────┐││  │ Netlify Functions (/.netlify/functions/*)                       │││  │   - registerPlayer (push notification registration)             │││  │   - notifyLeagueMessage (send push notifications)               │││  │   - pollLiveScores (scheduled, every minute)                    │││  │   - sendScoreNotificationsWebhook (database webhook triggered)  │││  └─────────────────────────────────────────────────────────────────┘│└─────────────────────────────────────────────────────────────────────┘


Part 2: Data, State, and Navigation Flows

2.1 Mini Leagues Data Journey
Mini leagues are a central domain concept. Their data flows through multiple stages:
Backend Fetch Points:
initialDataLoader.ts (loadInitialData) – fetches user's leagues via league_members join to leagues table
Home.tsx – fetches leagues in its own useEffect, also reads from cache
Tables.tsx – independently fetches leagues, members, and related data
api/home.ts (fetchUserLeagues) – centralized API function with caching
Client State Storage:
Home.tsx: leagues state, leagueData state, sortedLeagues memoized value
Tables.tsx: rows state, leagueData state
Cache: home:basic:{userId}, tables:{userId}
Sorting Logic (Critical Observation):
Multiple locations apply sorting with slightly different logic:
initialDataLoader.ts (line ~314):
Sorts by unread messages first (leagues with unread > 0 come first)
Secondary sort not explicitly defined
Home.tsx (line ~1658):
Sorts by unread messages first
Falls back to a.name.localeCompare(b.name) for equal unread counts
Tables.tsx (line ~375):
Sorts by unread messages first
Falls back to a.name.localeCompare(b.name) for equal unread counts
Transformation Chain:
Raw Supabase query returns league_members with nested leagues
Data is mapped to extract league objects
"API Test" league is filtered out at various stages
Members are fetched separately and joined by league_id
League rankings are calculated from picks/results
Final sorted array is rendered
Potential Inconsistencies:
The same data is fetched from multiple places at different times
Sort order depends on unread counts which may differ between cached data and fresh fetches
If unread counts change between cache write and read, order can differ

2.2 Initial Data Loading
On First App Load (Cold Start):
AuthProvider initializes, attempts to retrieve session:
Checks localStorage for cached session
Calls supabase.auth.getSession() with 3-second timeout
Sets up onAuthStateChange listener
5-second total timeout as fallback
AppContent checks loadEverythingFirst feature flag (defaults to true)
If feature flag enabled and user exists:
Shows LoadingScreen component
Calls loadInitialData(userId) from initialDataLoader.ts
Sets 10-second timeout for initial data loading
Sets 15-second maximum timeout for entire load sequence
loadInitialData performs parallel fetches:
Current GW from app_meta
User's leagues from league_members
All GW points from app_v_gw_points
Overall standings from app_v_ocp_overall
Latest GW from app_gw_results
Web picks from picks table
Fixtures for current GW
User's picks for current GW
And more...
Results are cached under various keys:
home:basic:{userId}
home:fixtures:{userId}:{currentGw}
tables:{userId}
global:leaderboard
predictions:{userId}:{currentGw}
After loadInitialData completes or times out, app renders
On Navigation Between Views:
Each page (Home, Tables, League, etc.) has its own useEffect that:
Checks cache first for instant render
Fetches fresh data in background
Updates state with fresh data
Updates cache with fresh data
This is the stale-while-revalidate pattern.

2.3 Global vs Local State
Global State Containers:
AuthContext: user, session, loading, signOut, showWelcome
localStorage cache (pseudo-global, persisted)
Local Component State:
Home.tsx has approximately 20+ useState declarations:
leagues, leagueSubmissions, gw, latestGw, gwPoints, loading, leagueDataLoading, leaderboardDataLoading, lastGwRank, fiveGwRank, tenGwRank, seasonRank, allGwPoints, overall, unreadByLeague, leagueData, fixtures, fixturesLoading, isInApiTestLeague, userPicks, showLiveOnly
Tables.tsx has similar local state for its domain.
Multiple Sources of Truth Identified:
Leagues:
AuthContext does not store leagues
Home.tsx has its own leagues state
Tables.tsx has its own rows state (similar data)
Cache has home:basic:{userId}.leagues
Cache has tables:{userId}.rows
Current GW:
Fetched in loadInitialData
Fetched again in Home.tsx
Fetched again in Tables.tsx
Each page has its own gw or currentGw state
Unread Counts:
Calculated in loadInitialData
Re-calculated in Home.tsx
Re-calculated in Tables.tsx
Different timing can produce different values

2.4 Navigation and Screen Mounting
Layout System:
The application does not use a traditional layout system with nested outlets. Instead:
Always-mounted components (in AppContent):
FloatingProfile (conditionally on pathname /)
PredictionsBanner (conditionally, not on auth, league pages, or predictions)
BottomNav (conditionally, not on auth, league pages, or swipe predictions)
Route-mounted components:
Each route corresponds to a full page component
Suspense wraps all routes with PageLoader fallback
Lazy-loaded pages show spinner while chunk downloads
Lazy Loading and Dynamic Imports:
Lazy-loaded pages include: League, Profile, Admin, CreateLeague, HowToPlay, NewPredictionsCentre, TestApiPredictions, TestAdminApi, ApiAdmin, TestFixtures, TestDespia, SignIn
When navigating to a lazy-loaded route:
Suspense boundary shows PageLoader (spinner)
Chunk downloads from CDN/Netlify
Component renders
Component's useEffect hooks fire
Data is loaded (from cache or network)
UI updates
Conditional Rendering Patterns:
Many components use conditional rendering based on loading states:
{loading ? <Spinner /> : <ActualContent />}
This can cause:
Flashing between states
"Wrong content" appearing briefly before correct content
Order-dependent rendering if multiple loading states exist
Part 3: Loading Behaviour and Inconsistencies


3.1 Startup / "Big Load" Behaviour
Sequence from App Startup to First Meaningful Paint:
Despia WebView loads URL → HTTP request to Netlify
HTML received → index.html with script tag for main bundle
Main bundle downloads → index-8pBbLkE_.js (content-hashed)
React mounts → ReactDOM.createRoot(...).render(...)
AuthProvider initializes:
Immediately checks localStorage for cached session
If found, sets user and session synchronously-ish
Also starts async getSession() call to Supabase
AppContent renders:
Checks loadEverythingFirst flag (default: true)
If authLoading is true, shows LoadingScreen
Auth resolves (either from cache or network):
authLoading becomes false
initialDataLoading becomes true
loadInitialData called:
17 parallel Supabase queries start
Data is fetched from database
Data cached and state set:
initialDataLoaded becomes true
LoadingScreen unmounts
Routes render:
Home page (default) mounts
Home's useEffect fires
Checks cache (should hit, just populated)
May still fetch fresh data in background
What the "Big Load" Does:
loadInitialData (in initialDataLoader.ts) performs:
Parallel fetch of 15+ queries using Promise.all
Processes and transforms data
Calculates ranks (last GW, 5-week form, 10-week form, season)
Caches results under multiple keys
Starts background async operations for:
Tables page data
TestApiPredictions page data
Centralisation Assessment:
The "big load" is mostly centralised but:
Home.tsx still runs its own data loading in useEffect
Tables.tsx runs its own data loading
Each page independently validates and potentially refreshes data
This means that even after the big load:
Pages may re-fetch data if cache is stale or missing
Multiple sources can produce different values
Order of operations depends on timing
Timeout Protections:
Auth timeout: 5 seconds (in AuthContext)
Initial data timeout: 10 seconds (in main.tsx)
Maximum loading timeout: 15 seconds (in main.tsx)
If any timeout fires, the app shows anyway with potentially incomplete data.

3.2 Ordering and Sorting Issues (Mini Leagues)
Sorting Locations Identified:
initialDataLoader.ts line ~314: Sorts league rows by unread count
Home.tsx line ~1658: sortedLeagues memoized, sorts by unread then name
Tables.tsx line ~375: Sorts out array by unread count
Fields Used for Sorting:
Primary: Unread message count per league
Secondary: League name (alphabetical via localeCompare)
Potential Nondeterminism Sources:
Timing-dependent unread counts: If messages arrive between different fetch operations, counts differ
Cache staleness: Cached unread counts may not match fresh counts
Background refresh: After initial render, background fetch may produce different order
Different fetch timings: Home and Tables fetch independently, may see different database states
Evidence of Multiple Sort Passes:
The same leagues are sorted:
In loadInitialData (for caching)
In Home.tsx (for rendering)
In Tables.tsx (for rendering)
If the underlying unread counts differ between these passes (due to timing), order changes.

3.3 Versioning, Caching, and Staleness
Service Workers and PWA:
No service workers detected in the codebase. The application does not appear to have offline-first PWA capabilities beyond the localStorage cache.
Asset Caching:
Vite produces content-hashed bundles (e.g., index-8pBbLkE_.js)
Netlify typically serves hashed assets with long cache headers
index.html is served with short cache or no-cache
No explicit cache configuration in netlify.toml
Potential Stale Asset Issues:
Browser/WebView cache: Despia's WebView may cache responses. If index.html is cached, it may reference old bundle hashes that don't exist on server.
Partial bundle updates: If user has some bundles cached but index.html references new hashes, the app may fail to load lazy chunks.
No forced refresh mechanism: The app has no way to force a cache clear or update check.
Data Caching (Application-Level):
Cache TTLs range from 10 seconds (live scores) to 5 minutes (leagues, home, tables)
Cache keys include user ID and sometimes GW numbers
Cache is stored in localStorage with prefix despia:cache:
Potential Stale Data Issues:
TTL-based expiration: If user leaves app idle and returns, cache may be stale or expired
Background refresh timing: Fresh data may arrive and update UI after initial render
Cache key mismatch: If GW changes, old cache keys won't match new queries

3.4 Hydration and Mismatched States
Client vs Server Differences:
This is a pure SPA; there is no server-side rendering. However, analogous issues exist:
Timing-Dependent Logic:
Date.now() used in cache timestamp comparisons
Session token expiration checks
Live score status checks ("IN_PLAY", "FINISHED")
Environment-Specific Values:
localStorage.getItem() results may differ between runs
navigator.onLine status
Despia native APIs (present or absent)
Conditional Rendering That May Differ:
loadEverythingFirst feature flag read from localStorage
isNativeApp detection based on Despia presence
showWelcome state based on URL parameters and session history
Concentrated Areas:
AuthContext.tsx: Session retrieval and fallback logic
main.tsx: Feature flag checks, loading state management
pushNotifications.ts: Native app detection

Part 4: Hypotheses Explaining Current Behaviour
Hypothesis 1: "Multiple Data Load Paths with Race Conditions"
Mechanism:
The application has three distinct data loading paths that can execute concurrently:
loadInitialData in main.tsx (big load)
Individual page useEffect hooks (e.g., Home.tsx)
Background prefetch via useAppLifecycle
When the user launches the app:
Big load starts and populates cache
App renders, page mounts
Page's useEffect checks cache (may hit or miss depending on timing)
Page starts its own fetch
Big load completes, updates cache
Page's fetch completes, updates state
If the page's fetch uses different query parameters or timing than the big load, it may produce different results (different unread counts, different sort order).
How This Produces Wrong UI:
Initial render shows cached data from big load
Background fetch returns different data
UI updates to show different order
User perceives "wrong list until refresh"
Evidence:
Home.tsx has its own useEffect for data loading (lines ~400-650)
initialDataLoader.ts caches to home:basic:{userId}
Both fetch similar data but at different times

Hypothesis 2: "Stale Cache with Different Sort Criteria"
Mechanism:
Cache entries include computed values (unread counts, ranks, sorted orders). If the underlying data changes (new messages arrive, picks are submitted), the cache becomes stale. However:
Cache TTL is 5 minutes for leagues
Unread counts can change in seconds
User navigating away and back may see old order until refresh completes
How This Produces Wrong UI:
User opens app, sees cached mini leagues order
New messages arrived since last visit
Cached order doesn't reflect new unread counts
After background refresh, order changes
Or: user refreshes page, cache clears, fresh order appears
Evidence:
CACHE_TTL.LEAGUES = 5 * 60 * 1000 (5 minutes)
Mini leagues sorted by unread count
No real-time subscription for message counts (only for live scores and chat)
Hypothesis 3: "Despia WebView Caching Stale HTML"
Mechanism:
Despia's WebView may cache the index.html file. If cached HTML references bundle hashes that no longer exist (after deployment), the app may:
Fail to load entirely (404 on old bundle)
Load successfully but with outdated code
Additionally, if Despia caches API responses at the network level (which is less likely but possible), data could be stale.
How This Produces Wrong UI:
User opens app
WebView serves cached index.html with old bundle hashes
Old JavaScript runs with old UI/logic
Or: partial load where main bundle works but lazy chunks fail
User force-closes and reopens, gets fresh HTML, sees different UI
Evidence:
No cache-busting headers configured in netlify.toml
Bundle filenames are hashed but HTML references them
User reports suggest "refresh fixes it" which would involve fresh network request
Hypothesis 4: "Timeout Bypass Showing Incomplete Data"
Mechanism:
The loading sequence has multiple timeout protections:
Auth: 5 seconds
Initial data: 10 seconds
Maximum: 15 seconds
If network is slow:
Auth times out → proceeds with no session or cached session
Initial data times out → app shows with incomplete data
User sees partial or wrong UI
Later, data loads in background and UI updates
How This Produces Wrong UI:
Slow network causes timeout
App renders with fallback/cached/incomplete data
User sees wrong leagues or missing data
Background eventually loads correct data
UI shifts noticeably
Evidence:
Timeout handlers set initialDataLoaded = true regardless of actual completion
Console warnings ([Pre-loading] Initial data loading timed out...) indicate this happens
Hypothesis 5: "localStorage Synchronous Read During Render"
Mechanism:
Pages like Home.tsx and Tables.tsx call loadInitialStateFromCache() during initial state construction (useState(() => loadInitialStateFromCache())). This reads from localStorage synchronously.
However:
loadInitialData writes to cache asynchronously
There's a potential race between async cache write and sync cache read
Different browser tabs or app instances may have different cache states
How This Produces Wrong UI:
First render uses potentially stale/empty cache
loadInitialData completes, updates cache
First render already happened with old data
User sees old data, then it updates
Evidence:
Home.tsx line ~55-196: loadInitialStateFromCache() called in useState initializer
This runs synchronously before the component mounts
If cache was just written by another process, it may not be immediately visible
Interplay Between Hypotheses
The most likely explanation combines multiple hypotheses:
User launches app in Despia
WebView serves HTML (possibly cached from previous session)
Auth initializes with cached session
loadInitialData starts
Meanwhile, Home.tsx mounts and reads from potentially stale cache
loadInitialData completes, writes new data to cache
Home.tsx background refresh fetches data, sees different unread counts
UI updates, order changes
User perceives "wrong leagues first, then correct after moment"
Additionally, if network is slow:
Timeout fires, incomplete data shown
User sees partial state
Full data arrives later, UI shifts
Part 5: Risks, Unknowns, and Future Diagnostics (Conceptual)

5.1 Key Risk Areas

1. Cache Coherence Layer (src/lib/cache.ts, src/api/client.ts)
Why Risky: Two different caching mechanisms with different key schemes, TTLs, and no coordination
Hidden Coupling: Pages assume cache structure matches their expectations; any change breaks assumptions
User-Visible Issues: Stale data, inconsistent states between pages, data that "resets" when navigating

2. Multiple Data Loading Paths (initialDataLoader.ts, Home.tsx, Tables.tsx)
Why Risky: Same data fetched and processed in multiple places with slight variations
Hidden Coupling: Sort logic duplicated across files; changes must be synchronized manually
User-Visible Issues: Different sort orders, data appearing to "jump" after load, inconsistent counts

3. AuthContext Session Management (context/AuthContext.tsx)
Why Risky: Complex fallback logic with multiple timeouts and localStorage checks
Hidden Coupling: Push notification registration depends on session being valid; feature flags depend on auth state
User-Visible Issues: Authentication failures, missing push notifications, app hanging on load

4. Despia Integration Points (lib/pushNotifications.ts, lib/nativeStorage.ts)
Why Risky: Relies on global variables being set by native code with unknown timing
Hidden Coupling: Detection logic spread across multiple files; no central Despia state
User-Visible Issues: Push notifications not registering, app behaving differently in native vs web

5. Real-time Subscriptions (useLiveScores.ts, chat subscriptions in League.tsx)
Why Risky: Supabase realtime has failure modes (channel errors, timeouts) with polling fallback
Hidden Coupling: Live scores used by multiple components; subscription cleanup is critical
User-Visible Issues: Stale live scores, duplicate subscriptions, memory leaks

5.2 Unknowns and Assumptions
Unknown 1: Despia WebView Caching Behaviour
Assumption: Despia's WebView respects standard HTTP cache headers
Why It Matters: If WebView caches aggressively, users may see old code after deployments
To Verify: Need Despia documentation or testing on actual device after deployment
Unknown 2: Netlify Cache Headers for index.html
Assumption: Netlify serves index.html without long-term caching
Why It Matters: If index.html is cached, bundle hash references become stale
To Verify: Check Netlify deployment logs or response headers
Unknown 3: Despia Protocol Handler Timing
Assumption: getonesignalplayerid:// command result is available within 500ms
Why It Matters: If slower, push notification registration may fail or retry excessively
To Verify: Test on actual device with logging
Unknown 4: localStorage Size Limits in Despia WebView
Assumption: WebView localStorage has same 5MB limit as desktop browsers
Why It Matters: If limit is lower, cache may silently fail
To Verify: Check cache write success rates on device
Unknown 5: Network Conditions in Despia vs Browser
Assumption: Network requests behave similarly in WebView and browser
Why It Matters: Timeouts may be more common in native environment
To Verify: Logging and monitoring on production

5.3 Future Diagnostics (Conceptual)
Diagnostic Category 1: Load Sequence Visibility
Information needed: Timestamps for each loading stage (auth, initial data, page mount, cache read, background fetch)
Purpose: Identify where delays occur and which paths execute
What to observe: Order of events, time between events, which path "wins" for initial render
Diagnostic Category 2: Cache Hit/Miss Tracking
Information needed: Which cache keys are read, whether they hit or miss, TTL status at read time
Purpose: Understand cache effectiveness and staleness patterns
What to observe: Cache hit rate, age of cached data when served, frequency of stale-while-revalidate scenarios
Diagnostic Category 3: Sort Order Stability
Information needed: League order at each stage (initial cache read, background fetch complete, user interaction)
Purpose: Confirm or reject hypothesis about order changes
What to observe: Whether order changes between render passes, which field(s) cause reordering
Diagnostic Category 4: Despia Environment Detection
Information needed: Which Despia detection path succeeds, timing of OneSignal player ID availability
Purpose: Understand native integration reliability
What to observe: Success rate of native detection, time to player ID availability
Diagnostic Category 5: Timeout Frequency
Information needed: How often auth/data/maximum timeouts fire in production
Purpose: Understand if timeouts are rare fallbacks or common occurrences
What to observe: Timeout event frequency, user actions after timeout (refresh?)
Diagnostic Category 6: Version Mismatch Detection
Information needed: Expected bundle version vs actually loaded bundle version
Purpose: Detect if WebView caching causes version skew
What to observe: Build timestamp or version embedded in code vs deployment time
End of Report