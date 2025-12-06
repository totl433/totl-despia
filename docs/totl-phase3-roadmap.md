# TOTL – Phase 3 Roadmap

> **Status**: Planning Only – No implementation yet  
> **Last Updated**: December 2024  
> **Depends On**: Phase 2 completion (leagues stabilized)

---

## Overview

Phase 3 extends the frontend stability patterns established in Phase 2 (leagues) to other data domains. The goal is consistent data flow, reduced competing fetches, and improved observability across the entire app.

**Guiding Principles**:
- Single source of truth per domain
- Hooks for UI consumption, API modules for data fetching
- Pre-warming for instant load, background refresh for freshness
- Centralized sorting logic per domain
- Comprehensive logging for debugging

---

## Candidate Domains for Phase 3

### 1. User Picks / Predictions

**Current State**:
- Picks are fetched in multiple places (Predictions page, Home page)
- No centralized hook or API module
- Submission status checked separately from picks

**Proposed Changes**:

1. **Canonical Types**: `src/types/picks.ts`
   ```typescript
   type Pick = {
     fixtureIndex: number;
     pick: 'H' | 'D' | 'A';
     gw: number;
   };
   
   type PicksForGw = {
     gw: number;
     picks: Pick[];
     submitted: boolean;
     submittedAt: string | null;
   };
   ```

2. **Centralized API**: `src/api/picks.ts`
   - `fetchUserPicks(userId, gw)` – single query definition
   - `fetchSubmissionStatus(userId, gw)` – check if submitted
   - `submitPicks(userId, gw, picks)` – submit with optimistic update
   - Cache keys: `picks:${userId}:${gw}`

3. **Shared Hook**: `src/hooks/usePicks.ts`
   - Returns `{ picks, submitted, loading, error, savePick, submitAll }`
   - Stale-while-revalidate pattern
   - Optimistic updates for better UX

4. **Page Refactoring**:
   - `TestApiPredictions.tsx` uses `usePicks`
   - Remove direct Supabase queries from page

---

### 2. Global & Mini-League Standings

**Current State**:
- Global page fetches its own leaderboard data
- Mini-league standings calculated in Tables/League pages
- No shared leaderboard logic

**Proposed Changes**:

1. **Canonical Types**: `src/types/standings.ts`
   ```typescript
   type StandingEntry = {
     userId: string;
     name: string;
     score: number;
     rank: number;
     isTied: boolean;
   };
   
   type Leaderboard = {
     entries: StandingEntry[];
     userRank: number | null;
     total: number;
   };
   ```

2. **Centralized API**: `src/api/standings.ts`
   - `fetchGlobalStandings()` – overall leaderboard
   - `fetchFormStandings(weeks: 5 | 10)` – form leaderboards
   - `fetchMiniLeagueStandings(leagueId)` – per-league
   - Cache keys: `standings:global`, `standings:form:${weeks}`, `standings:league:${leagueId}`

3. **Shared Hook**: `src/hooks/useStandings.ts`
   - Returns `{ standings, userRank, loading, error, refresh }`
   - Multiple variants: `useGlobalStandings`, `useFormStandings`, `useMiniLeagueStandings`

4. **Page Refactoring**:
   - `Global.tsx` uses `useGlobalStandings`
   - `League.tsx` uses `useMiniLeagueStandings`
   - Remove duplicated ranking calculations

---

### 3. Fixtures & Results

**Current State**:
- Fixtures fetched in Predictions, Home, League pages
- Results merged with fixtures in different ways
- Live scores have separate hook but not well integrated

**Proposed Changes**:

1. **Canonical Types**: `src/types/fixtures.ts`
   ```typescript
   type Fixture = {
     id: string;
     gw: number;
     fixtureIndex: number;
     homeTeam: string;
     awayTeam: string;
     kickoffTime: string;
     result?: 'H' | 'D' | 'A' | null;
     liveScore?: { home: number; away: number } | null;
   };
   
   type FixturesForGw = {
     gw: number;
     fixtures: Fixture[];
     allResultsIn: boolean;
   };
   ```

2. **Centralized API**: `src/api/fixtures.ts`
   - `fetchFixtures(gw)` – fixtures for a gameweek
   - `fetchResults(gw)` – results for a gameweek
   - `fetchFixturesWithResults(gw)` – merged data
   - Cache keys: `fixtures:${gw}`, `results:${gw}`

3. **Shared Hook**: `src/hooks/useFixtures.ts`
   - Returns `{ fixtures, loading, error, refresh }`
   - Integrates with `useLiveScores` for real-time updates

4. **Page Refactoring**:
   - All pages use `useFixtures(gw)`
   - Live scores overlay handled by the hook

---

## Implementation Order (Suggested)

| Priority | Domain | Complexity | Impact |
|----------|--------|------------|--------|
| 1 | Picks/Predictions | Medium | High – core feature |
| 2 | Fixtures/Results | Medium | Medium – multiple pages |
| 3 | Standings | Low | Low – mostly read-only |

---

## Pre-requisites

Before starting Phase 3:

- [ ] Phase 2 fully deployed and stable
- [ ] No regressions in league consistency
- [ ] Logging confirms cache hit rates are acceptable
- [ ] Team alignment on priorities

---

## Success Criteria

Phase 3 is complete when:

1. **Single Source of Truth**: Each domain has exactly one API module and one hook
2. **No Competing Fetches**: Pages don't query Supabase directly for these domains
3. **Consistent Sorting**: Any ranked data uses centralized sort helpers
4. **Observable**: Logging shows cache hits/misses and data sources for all domains
5. **Tested**: Manual testing confirms no regressions

---

## Constraints (Carry Forward from Phase 2)

- ✅ No Supabase schema changes
- ✅ No RLS / policy changes
- ✅ No stored procedures
- ✅ Frontend-only changes

---

## Notes

- This document is for planning purposes only
- No code changes should be made until Phase 2 is verified stable
- Priorities may shift based on user feedback and bug reports
- Each domain can be tackled independently once Phase 2 is complete

