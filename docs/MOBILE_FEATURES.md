# Mobile features and product behavior

Verified against `mobile/shared-release-base` commit `a01d2a07`. “Production,”
“prototype,” and “unknown” describe code state, not store rollout or product
approval.

## Product and audience

Top of the League is a Premier League prediction game for football fans who
want a quick weekly competition with friends, the wider player base, or a
branded community. A user predicts home/draw/away for every fixture, then
follows live outcomes, points, ranks, league chat, and season progress.

Core value:

- low-friction predictions rather than fantasy-team management
- live social competition inside mini leagues
- global, monthly, form, and branded leaderboard contexts
- shareable gameweek results and lightweight daily football games

## Main user journey

1. Sign up or sign in with email/password.
2. Confirm email and choose a unique display name if required.
3. Review the current gameweek on Home.
4. Make H/D/A predictions before the deadline and submit them.
5. Follow live fixtures, points, rank changes, and mini-league performance.
6. Join/create mini leagues and chat with members.
7. Compare global or branded leaderboard positions.
8. Review/share results, stats, trophies, and notification preferences.

## Authentication and onboarding

**Status:** production.

Relevant files:

- `apps/mobile/src/AppRoot.tsx`
- `apps/mobile/src/screens/AuthScreen.tsx`
- `apps/mobile/src/screens/ChooseUsernameScreen.tsx`
- `apps/mobile/src/lib/authCallback.ts`
- `apps/mobile/src/lib/authCallbackUrl.ts`
- `apps/mobile/src/lib/authEmail.ts`
- `apps/mobile/src/lib/userProfile.ts`

The app supports sign-up, sign-in, email confirmation, forgotten password,
and password replacement. Display names are normalized, length-validated,
and checked for availability. After session restore, profile resolution sends
incomplete accounts to the username screen.

Important behavior:

- Auth callbacks are handled manually because Supabase URL detection is off.
- Timeouts prevent session/profile bootstrap from leaving a blank screen.
- Password reset links use the public web origin and return through universal
  links/custom scheme.
- The app shows a retryable profile error rather than silently signing out.

Known limitations:

- Email/password is the only verified auth provider in this snapshot.
- Availability checking still crosses a Netlify function boundary.

## Home and gameweek lifecycle

**Status:** production.

Relevant files:

- `apps/mobile/src/screens/HomeScreen.tsx`
- `apps/mobile/src/hooks/useHomeData.ts`
- `apps/mobile/src/lib/gameweekState.ts`
- `apps/mobile/src/hooks/useLiveScores.ts`
- `apps/mobile/src/components/home/`
- `apps/mobile/src/components/transitions/GameweekAdvanceTransition.tsx`
- `apps/mobile/src/components/popupCards/`

Home is the first bottom tab. It combines the BFF home snapshot with realtime
live scores, ranks, user picks, fixture outcomes, team form/position, mini
leagues, unread state, and results popup cards.

Business rules:

- The prediction deadline is the earliest fixture kickoff minus 75 minutes.
- Gameweek states progress through open, predicted, deadline passed, live,
  and results/pre-next-GW states.
- Home may show compact or expanded fixtures and can expand one or all cards.
- Pick percentages are loaded only after the deadline.
- Live mini-league cards/tables remain on the active live gameweek rather than
  advancing early.
- Pull-to-refresh refetches home, leagues, and ranks with timeout guards.

UX details:

- Header live-score summaries and ticker events appear across major tabs.
- Cards animate between layouts; selected transitions are disabled on Android
  for stability.
- Popup cards orchestrate results roundups, score sheets, manual recall, and
  sharing.

Known debt:

- `HomeScreen.tsx` is very large and mixes orchestration with presentation.
- Some fallback calculations query Supabase directly in addition to BFF data.

## Predictions

**Status:** production. A separate admin test mode also exists.

Relevant files:

- `apps/mobile/src/screens/PredictionsScreen.tsx`
- `apps/mobile/src/components/FixtureCard.tsx`
- `apps/mobile/src/components/predictions/`
- `apps/mobile/src/lib/matchPreviewStats.ts`
- `packages/api-client/src/index.ts`
- `apps/bff/src/server.ts`

Users can predict through a swipe deck or list view. Cards represent H/D/A;
eligible cards flip to show form, table position, season statistics, and
head-to-head data.

Business rules:

- Drafts are saved locally per user and gameweek.
- Picks are written through the BFF.
- Submission locks normal-mode predictions; the deadline also forces a
  locked list/review state.
- Stats depend on published/cached team-form, result, and H2H data. The UI
  must tolerate missing stats.
- Tutorial and review tips have persisted dismissal state.

Admin **Predictions Test** uses the same screen but does not lock at deadline
or submission and does not persist the final picks. Keep test-mode conditions
isolated from production rules.

Verification priorities:

- draft restoration and user switching
- deadline boundary
- save/submit mutation and cache invalidation
- swipe thresholds, draw gesture, flip, and list parity
- compact devices and keyboard-free landscape assumptions (app is portrait)

## Match Center

**Status:** implemented experimental/admin surface, not a primary production
tab.

Relevant files:

- `apps/mobile/src/screens/MatchCenterScreen.tsx`
- `apps/mobile/src/features/matchCenter/feed.ts`
- `apps/mobile/src/features/matchCenter/EmojiGlyph.tsx`
- `apps/mobile/src/hooks/useLeagueChatReactions.ts`
- `apps/mobile/src/navigation/HomeNavigator.tsx`

Match Center creates a chronological live football feed: lineups, kickoff,
goals/cards, score updates, prediction splits, rank/league changes, chat
snippets, and roundups. It has live, sample, and scripted playback modes and
supports emoji reactions.

It is reachable from Admin and `/match-center` deep links. A recent fix makes
exit return to Home, and `b85e2616` added emoji reactions. The screen is over
two thousand lines and combines data construction, playback, and rendering;
extract new feed cards or state machines instead of expanding it further.

Do not describe sample/playback data as live production behavior.

## Mini leagues

**Status:** production.

Relevant files:

- `apps/mobile/src/screens/LeaguesScreen.tsx`
- `apps/mobile/src/screens/CreateLeagueScreen.tsx`
- `apps/mobile/src/screens/JoinMiniLeagueScreen.tsx`
- `apps/mobile/src/screens/LeagueDetailScreen.tsx`
- `apps/mobile/src/services/leagues.ts`
- `apps/mobile/src/components/miniLeagues/`
- `apps/mobile/src/components/league/`
- `apps/mobile/src/lib/leagueStart.ts`
- `apps/mobile/src/lib/leagueSeasonPile.ts`

Users create or join with a code, browse leagues sorted partly by unread chat,
and open a detail view with gameweek, predictions, and season sections.

Business rules:

- A league with fewer than two members is dormant and shows limited state.
- League start gameweek derives from activation/member join timing.
- League calculations switch between legacy and season-specific table sets.
- Unicorn scoring is meaningful only when there are enough competitors.
- Ties use competition ranking and display tied ranks consistently.
- Admin/host actions include badge, invite/code sharing, rules, management,
  leave, and chat entry.
- League public URLs carry a code; the app resolves membership via the BFF
  before navigating, otherwise it opens the join flow.

Known debt:

- Some season/GW tables and rank calculations still occur client-side through
  direct Supabase queries.
- `LeagueDetailScreen.tsx` and `LeaguesScreen.tsx` are large.
- A fake development league remains available for visual testing.

## League chat and inbox

**Status:** Chat2 is the primary production path; legacy chat remains in the
navigation tree.

Relevant files:

- `apps/mobile/src/navigation/Chat2Navigator.tsx`
- `apps/mobile/src/screens/Chat2InboxScreen.tsx`
- `apps/mobile/src/screens/Chat2ThreadScreen.tsx`
- `apps/mobile/src/components/chat/LeagueChatTabV2.tsx`
- `apps/mobile/src/hooks/useLeagueChat.ts`
- `apps/mobile/src/hooks/useLeagueChatPresence.ts`
- `apps/mobile/src/hooks/useLeagueChatReactions.ts`
- `apps/mobile/src/hooks/useLeagueChatReadReceipts.ts`
- `apps/mobile/src/context/LeagueUnreadCountsContext.tsx`

Chat supports paginated history, realtime inserts, optimistic sending,
replies, reactions, read receipts, presence, unread counts, reports, and push
notification fan-out.

Important behavior:

- Message writes and realtime reads use Supabase.
- The client calls the Netlify V2 chat notification function after send,
  retries once, and records diagnostics.
- Notifications are skipped when the BFF URL identifies local development.
- Inbox and league lists optimistically update unread/last-message caches.
- Keyboard behavior has platform-specific offsets and must be tested on real
  iOS and Android devices.

Do not remove the Gifted Chat patch or legacy routes until all inbound links
and navigation paths have been verified against Chat2.

## Global leaderboards

**Status:** production.

Relevant files:

- `apps/mobile/src/screens/GlobalScreen.tsx`
- `apps/mobile/src/components/leaderboards/`
- `apps/mobile/src/lib/leaderboardMonths.ts`
- `apps/mobile/src/lib/leaderboardVisibility.ts`
- `apps/mobile/src/lib/competitionRanks.ts`

Users can compare current gameweek, monthly, overall/season, and recent-form
performance, optionally scoped to known competitors. Player rows can reveal
their picks after allowed visibility boundaries.

Important rules:

- Hidden users are filtered before display.
- Non-submitters sort after scored users.
- Ties use competition ranks.
- Legacy and current-season data piles must never be mixed where gameweek
  numbers overlap.
- Monthly availability depends on completed/active gameweeks.

Confirmed outstanding work:

- Month-to-gameweek allocations are hard-coded in
  `leaderboardMonths.ts`; the file contains a TODO for admin/server-driven
  configuration.

## Branded leaderboards and paid access

**Status:** production implementation; external store/RevenueCat setup must be
verified for each release.

Relevant files:

- `apps/mobile/src/screens/brandedLeaderboards/`
- `apps/mobile/src/components/brandedLeaderboards/`
- `apps/mobile/src/hooks/useLeaderboardAccess.ts`
- `apps/mobile/src/hooks/usePurchases.ts`
- `apps/mobile/src/lib/brandedLeaderboardAccess.ts`
- `apps/mobile/src/lib/brandedLeaderboardActivation.ts`
- `apps/mobile/src/lib/purchases.ts`
- `apps/bff/src/brandedLeaderboards.ts`

Users discover/join boards by code. A board may be free or require a
RevenueCat purchase. Access states are not joined, paywall required, free
access, or full access.

Business rules:

- Paid access is a consumable one-time purchase for a specific season/board.
- Approved product tiers are `totl_access_099` and `totl_access_199`;
  server/admin configuration may select an offering.
- After purchase, BFF activation verifies the RevenueCat state and retries
  briefly while receipts propagate.
- There is no restore-purchases UI because the products are consumables.
- Paid users may see standings behind/around a paywall presentation according
  to access state.
- Boards support GW/month/season views and a mini-league-friends filter.
- Authorized members/hosts can access Broadcast messages, reactions, and
  read receipts.
- If a user has exactly one joined board, the tab embeds it directly.

Platform difference: iOS and Android use separate RevenueCat public SDK keys
and separate store products mapped to the same logical tiers. Always test both
physical platforms.

## Profile, stats, settings, and account

**Status:** production.

Relevant files:

- `apps/mobile/src/navigation/ProfileNavigator.tsx`
- `apps/mobile/src/screens/profile/`
- `apps/mobile/src/components/profileStats/`
- `apps/mobile/src/lib/signOut.ts`
- `apps/mobile/src/lib/userProfile.ts`

Profile contains avatar editing, performance stats, trophy/streak views,
notification centre, email preferences, how-to-play, support, legal pages,
account deletion, sign-out, and an admin area when authorized.

Avatar and some profile data use direct Supabase storage/tables; summaries and
account deletion use the BFF. Preserve the distinction and RLS assumptions.

Admin currently exposes tools such as Predictions Test, HP Simulator, Match
Center, push diagnostics, and The Players. “API Admin” is visibly coming soon
and is confirmed incomplete.

## Results, popup cards, and social sharing

**Status:** production, device-dependent.

Relevant files:

- `apps/mobile/src/screens/GameweekResultsModalScreen.tsx`
- `apps/mobile/src/components/results/ShareResultsTray.tsx`
- `apps/mobile/src/components/share/`
- `apps/mobile/src/components/popupCards/`
- `apps/mobile/src/lib/shareToSocial.ts`
- `apps/mobile/modules/totl-social-share/`

The app renders result/fixture score sheets, captures them as images, and
shares through Instagram, WhatsApp, or the system sheet. Popup-card storage
prevents unwanted repeated auto-opening while allowing manual recall.

iOS has explicit Instagram Stories/Photos behavior. Android relies on package
intents/system sharing and the system photo picker. Verify real-device
permissions and the final attachment—not just whether another app opens.

## Retro TOTL Daily: fixture game

**Status:** prototype/orphaned at this snapshot.

Relevant files:

- `apps/mobile/src/navigation/RetroTotlDailyNavigator.tsx`
- `apps/mobile/src/screens/retroDaily/`
- `apps/mobile/src/components/retroDaily/`
- `apps/mobile/src/lib/retroDaily/mockPuzzle.ts`

The game presents historical fixtures in a timed H/D/A swipe streak with
countdown, reveal, score, rules, pixel styling, haptics, and confetti.

Confirmed limitations:

- It uses a mock/random puzzle generator.
- Its scoreboard contains mock prototype rankings.
- The root flow remains registered, but no verified Admin launcher exists at
  `a01d2a07`.
- Rules mention a daily cadence that the prototype does not fully enforce.

Do not promote it as a live daily feature without replacing mock data/boards,
defining the daily seed and lock rules, and adding an intentional entry point.

## The Players daily game

**Status:** admin-access prototype with a real shared scoreboard data path.
Recent commits added the feature and then shared scores across users.

Relevant files:

- `apps/mobile/src/navigation/RetroTotlDailyPlayersNavigator.tsx`
- `apps/mobile/src/screens/retroPlayers/`
- `apps/mobile/src/components/retroPlayers/`
- `apps/mobile/src/lib/retroPlayers/buildPuzzle.ts`
- `apps/mobile/src/lib/retroPlayers/day.ts`
- `apps/mobile/src/lib/retroPlayers/loadPlayerClubApps.ts`
- `apps/mobile/src/lib/retroPlayers/scores.ts`
- `apps/mobile/src/lib/retroPlayers/verifiedApps.ts`

Players identify which club a historical player represented in a season by
swiping among three choices.

Business rules:

- The daily boundary is 15:00 Europe/London.
- The daily puzzle is deterministic; practice uses a random seed.
- Only the first completed daily run is saved for scoring.
- Local state provides fallback/played-today behavior.
- Scores upsert to `players_daily_scores`.
- Today, month, and overall boards read all users' first daily scores and
  resolve names/avatars from Supabase.
- A user who has played can continue in practice without overwriting the
  scored run.

Known limitations/risks:

- Main discovery is Admin or `/players` deep link, so it is not yet a
  mainstream tab feature.
- The player/appearance catalogue is a large static verified dataset.
- Direct Supabase table policies are essential to score integrity.
- Time-zone and first-finish rules need explicit tests around daylight-saving
  transitions and concurrent devices.

## Notifications

**Status:** production integration with shared-backend risk.

Relevant files:

- `apps/mobile/src/lib/push.ts`
- `apps/mobile/src/lib/pushDiagnostics.ts`
- `apps/mobile/src/screens/profile/NotificationCentreScreen.tsx`
- `apps/mobile/src/screens/profile/PushDiagnosticsScreen.tsx`
- `docs/EXPO_PUSH_DEEP_LINK_RISK_MEMO.md`
- `docs/NOTIFICATIONS_RUNBOOK.md`

Notifications cover score events, kickoff/final whistle, gameweek completion,
chat, final submissions, and new gameweeks. User and league preferences can
suppress categories.

OneSignal is the active native SDK. Registration and accurate tap behavior
require a physical device. Server senders still include mixed V1/V2 history
and shared Expo/Despia targeting, so backend payload changes require
cross-client regression testing.

## Confirmed outstanding work

- Replace/configure hard-coded leaderboard month allocations.
- Decide whether Match Center becomes a supported user feature and split its
  monolithic implementation.
- Finish or retire Retro TOTL Daily fixture prototype and mock scoreboard.
- Decide product entry/rollout for The Players; add integrity/time-zone tests.
- Complete or remove the Admin “API Admin” placeholder.
- Consolidate Chat2 and legacy chat only after link/navigation verification.
- Reduce large-screen orchestration and duplicated direct Supabase/BFF
  calculations.
- Establish a clean TypeScript baseline so new errors are distinguishable.

## Speculative improvements (not committed roadmap)

These are engineering recommendations, not confirmed product plans:

- add mobile E2E smoke automation for auth, predictions, and league chat
- add a global error boundary and connectivity/stale-data indicator
- move more ranking calculations behind versioned BFF/domain contracts
- centralize inline design values into feature tokens
- document/automate store metadata bumps and release provenance
- decide whether to adopt `expo-updates`; none is currently verified
