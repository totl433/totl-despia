# Stats page — handoff for Carl (~full session)

This branch (**`expo-ui-carl`**) includes roughly **a full day’s work** on the **mobile Profile → Stats** experience and the **BFF profile stats** API that powers it. Use this doc so you’re not reverse‑engineering git history.

**Primary consumer:** Expo app `apps/mobile` → `GET /v1/profile/stats` on **`apps/bff`**.

---

## What we were trying to achieve

- Ship a **proper Stats** screen (percentiles, streak, weekly vs field chart, trophies, team insights) fed by **typed BFF data**, not ad‑hoc Supabase in the screen.
- Keep behaviour aligned with **game reality**: only **completed** gameweeks count where “final score” matters; **Premier League only** for club‑level stats; **Round Up** flows consistent with Home/streak.

---

## User-visible fixes (the bugs people actually saw)

| Issue | What was wrong | Fix (where) |
|--------|----------------|-------------|
| **Streak showed GW36 / “36 gameweeks”** while GW wasn’t finished | Streak ladder extended through **`highlightGw` / `metaGw`**, and mobile merged **live** GW into streak rows | **BFF:** cap `gameweekStreak` loop at **`lastCompletedGw`**. **Mobile:** `streakFallbackFromWeeklyPar` uses **`lastCompletedGw`** only; **`mergeGameweekStreakWithLeaderboardGwPoints`** filters rows and won’t overlay live score past cap; **`capGameweekStreakRowsAtLastCompleted`** on final strip rows (`profileStreakRows.ts`, `ProfileStatsScreen.tsx`). |
| **“Scoresheet” vs “View Round Up” confusion** | Hero link labelled wrong vs streak strip | **Gameweek column** label **`View Round Up`**, action **`openManualResultsScoreSheetThenResults(lastCompletedGw)`** — same as streak chips. **Overall** column stays **`View Leaderboards`** → Global tab (not Round Up). (`StatsHeroVisual.tsx`, `ProfileStatsScreen.tsx`) |
| **Paris Saint‑Germain / PSV on “most correct/incorrect team”** | `app_fixtures` / joins could surface **non‑PL** rows by `gw:fixture_index`; some rows had PL-ish codes with wrong names; **`__NAME__:*`** aggregation let garbage through | **BFF `profile.ts`:** PL **TLA allowlist** + **non‑PL name markers** on fixture rows; **only bump stats by canonical PL codes**; **fixed display names** via `PREMIER_CODE_DISPLAY_NAME` (no trusting corrupted names). |
| **“Lowest single Gameweek: 0 on GW36”** | Averages / best / worst / weekly par used **every GW you’d submitted picks for**, including **current** GW → **0 pts** before finish | **BFF:** **`statsEligibleGwCap = lastCompletedGw`** — applies to **correct rate**, **field comparison**, **avg / best / lowest GW**, **`weeklyParData`**, **chaos**, **team pick loops**. |
| **Railway build broke** | Missing **`liveGwScores`** module / loose types | **`apps/bff/src/liveGwScores.ts`** added; **`profile.ts`** imports tightened (`13d911a` era). |
| **Stats loading empty / network errors** (simulator) | **`EXPO_PUBLIC_BFF_URL`** defaulting to localhost while BFF not running | **Operational:** point **`apps/mobile/env.local`** at deployed BFF **or** run `npm run bff:dev` + restart Metro. |

---

## Architecture (keep this mental model)

1. **Mobile** `ProfileStatsScreen` calls **`api.getProfileStats()`** → **`GET /v1/profile/stats`**.
2. **BFF** `getProfileStats` (`apps/bff/src/profile.ts`) merges **`app_picks`**, legacy **`picks`**, **`app_gw_results`**, **`live_scores`**, **`app_fixtures`**, **`app_v_gw_points`**, etc., and returns **`UserStatsData`** (Zod in **`packages/domain`**).
3. **Profile `/stats` route** uses **service-role Supabase** (`createSupabaseAdminClient`) so fixture joins aren’t silently empty under JWT RLS **`server.ts`**).
4. **Streak strip on Stats** can **override** BFF `gameweekStreak` with **`mergeGameweekStreakWithLeaderboardGwPoints`** (same pool as Global leaderboard) then **cap** — keeps chips aligned with live leaderboard when appropriate.

---

## Key files (check these first)

### BFF

| File | Role |
|------|------|
| **`apps/bff/src/profile.ts`** | All profile stats logic: picks merge, outcomes, percentiles, **`statsEligibleGwCap`**, streak slice cap, PL team stats, chaos, trophies, weekly par. |
| **`apps/bff/src/liveGwScores.ts`** | Shared live GW scoring (used from **`server.ts`** GW live route and profile/trophy paths). |
| **`apps/bff/src/server.ts`** | **`/v1/profile/stats`** wiring (admin client); **`/leaderboards/gw/:gw/live`** refactored to **`computeLiveGwScoresForGw`**. |

### Mobile

| File / area | Role |
|-------------|------|
| **`apps/mobile/src/screens/profile/ProfileStatsScreen.tsx`** | Stats screen: queries, hero, streak, par chart, team cards, trophies, refresh, **`openHeroRoundUp`**. |
| **`apps/mobile/src/components/profileStats/StatsHeroVisual.tsx`** | Two-column percentile hero; **GW → View Round Up**; **Overall → View Leaderboards**. |
| **`apps/mobile/src/components/profileStats/StatsGameweekStreakStrip.tsx`** | Streak UI + **View Round Up** per chip. |
| **`apps/mobile/src/components/profileStats/StatsParChart.tsx`** | Weekly performance vs field. |
| **`apps/mobile/src/components/profileStats/StatsTeamStatCard.tsx`** | Most correct / incorrect team rows. |
| **`apps/mobile/src/components/profileStats/StatsTrophyCabinet.tsx`** | Trophy counts + browse hooks. |
| **`apps/mobile/src/lib/profileStreakRows.ts`** | **`mergeGameweekStreakWithLeaderboardGwPoints`**, **`streakFallbackFromWeeklyPar`**, **`capGameweekStreakRowsAtLastCompleted`**, GW points paging helpers. |
| **`apps/mobile/src/lib/gameweekStreakCount.ts`** | **`countTrailingGameweekParticipationStreak`** (+ tests). |
| **`apps/mobile/src/hooks/useGameweekTrophyWinsFromLeaderboardApi.ts`** | Live trophy wins from leaderboard API. |
| **`apps/mobile/src/lib/trophyCabinetBrowse.ts`** | Browse GW/month winners from **`app_v_gw_points`** (+ tests). |
| **`apps/mobile/src/lib/predictionLeagueAverage.ts`** | League pick-accuracy fetch for copy under correct-rate card. |
| **`apps/mobile/src/lib/inferUserPlayedGwSequence.ts`** | Derive played GW list from paged points (+ tests). |
| **`apps/mobile/src/lib/gwLiveRank.ts`** | Small helper for live GW rank display context. |

### Shared types

| File | Role |
|------|------|
| **`packages/domain/src/index.ts`** (+ **`dist/`**) | **`UserStatsData`** fields used by Stats (`bestSingleGw`, `lowestSingleGw`, `gameweekStreak`, `mostCorrectTeam`, etc.). |

---

## Recent commits on `expo-ui-carl` (high signal)

```text
20cf28d docs: EXPO_UI_CARL_UPDATES handoff note for Carl
d61a0d8 fix(bff): count only completed gameweeks in profile stats
170ee56 fix(bff): Premier-only team stats and reliable profile/stats reads
13d911a fix(bff): add missing liveGwScores module + tighten profile.ts types for Railway build
cdf4ca2 fix(bff): profile stats team cards — merge picks reliably and join to app_fixtures
```

Earlier on the same branch you’ll also see **mini‑league / branded / popup** work (`16ac44c`, `819f675`, …) — **not Stats‑specific** but ships together.

---

## How Carl should verify (quick QA)

1. **Deploy / run BFF** (`apps/bff`, port **8787** or Railway URL).
2. **Mobile `env.local`**: **`EXPO_PUBLIC_BFF_URL`** must hit that BFF; restart Metro after edits.
3. Log in → **Profile → Stats**.
4. With **GW36 not finished** (`lastCompletedGw` e.g. **35**):
   - **Lowest / highest single GW** must **not** reference **GW36**.
   - **Streak** must **not** count GW36 in the big number or chips (range should end **≤ last completed**).
   - **Team accuracy** clubs must be **PL teams only**.
5. **Gameweek hero** → **View Round Up** opens **scoresheet then Results** for **`lastCompletedGw`**.
6. **Overall** column → **View Leaderboards** opens Global.

---

## Known operational gotchas

- **Stale React Query:** pull‑to‑refresh on Stats refetches **`profile-stats`**; if something looks old after deploy, force refresh.
- **Truth of `lastCompletedGw`:** driven by **`app_gw_results`** max GW in BFF. If that table is wrong upstream, caps will be wrong — fix data / ingestion, not only the app.
- **Web repo root `src/`** still has legacy **`userStats.ts`** — **Despia/mobile scope** is **`apps/mobile` + `apps/bff`** per **`AGENTS.md`**; don’t assume Netlify stats match BFF 1:1.

---

## If something still looks wrong

1. **`curl`/network** `GET /v1/profile/stats` with a user JWT — inspect **`lastCompletedGw`**, **`lowestSingleGw`**, **`gameweekStreak`**, **`mostCorrectTeam`** JSON.
2. Compare **`lastCompletedGw`** to **`highlightGw`** — UI percentile hero may reference **`highlightGw`** for labels but **completed-only logic** should follow **`lastCompletedGw`** for the fixes above.

---

_End of Stats session handoff — expand here if you land follow-up fixes so the next person inherits context._
