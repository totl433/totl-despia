import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useGameweekState } from '../hooks/useGameweekState';
import { useLiveScores } from '../hooks/useLiveScores';
import { getLeagueAvatarUrl, getDefaultMlAvatar } from '../lib/leagueAvatars';
import { getCached, setCached, CACHE_TTL } from '../lib/cache';
import type { Fixture } from './FixtureCard';

// Cache key for last completed GW (to avoid DB query)
const LAST_COMPLETED_GW_CACHE_KEY = 'app:lastCompletedGw';

export interface MiniLeagueGwTableCardProps {
  leagueId: string;
  leagueCode: string;
  leagueName: string;
  members: Array<{ id: string; name: string }>;
  currentUserId?: string;
  currentGw: number | null;
  maxMemberCount?: number; // Max members across all leagues for consistent height
  avatar?: string | null; // League avatar
  unread?: number; // Unread message count
  // SIMPLIFIED: Pass fixtures/results from parent to avoid duplicate fetching
  sharedFixtures?: Fixture[];
  sharedGwResults?: Record<number, "H" | "D" | "A">;
  // Optional mock data for Storybook/testing
  mockData?: {
    fixtures: Fixture[];
    picks: PickRow[];
    results: Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>;
    displayGw: number;
    isLive?: boolean;
  };
}

type ResultRow = {
  user_id: string;
  name: string;
  score: number;
  unicorns: number;
};

type PickRow = {
  user_id: string;
  gw: number;
  fixture_index: number;
  pick: "H" | "D" | "A";
};

function rowToOutcome(r: { result?: "H" | "D" | "A" | null }): "H" | "D" | "A" | null {
  return r.result === "H" || r.result === "D" || r.result === "A" ? r.result : null;
}

/**
 * Calculate minimum height needed for a card based on member count
 * Header: ~60px, Table header: ~32px, Each row: ~32px, Padding: ~24px
 */
function calculateCardHeight(maxMembers: number): number {
  const headerHeight = 60;
  const tableHeaderHeight = 32;
  const rowHeight = 32;
  const padding = 24;
  
  return headerHeight + tableHeaderHeight + (maxMembers * rowHeight) + padding;
}

/**
 * MiniLeagueGwTableCard - Compact card version of the GW table for horizontal scrolling
 * Shows league name, GW number, and results table in a fixed-width card (320px)
 * Clickable to navigate to the league page
 */
export default function MiniLeagueGwTableCard({
  leagueId,
  leagueCode,
  leagueName,
  members,
  currentUserId,
  currentGw,
  maxMemberCount: _maxMemberCount,
  avatar,
  unread = 0,
  sharedFixtures = [],
  sharedGwResults = {},
  mockData,
}: MiniLeagueGwTableCardProps) {
  // Initialize displayGw immediately from cache (optimistic - assume currentGw, will adjust if needed)
  const [displayGw, setDisplayGw] = useState<number | null>(() => {
    if (!currentGw) return null;
    // For now, default to currentGw - will be adjusted based on game state
    return currentGw;
  });
  
  // Load data from cache IMMEDIATELY on mount if available
  // Note: Can load fixtures/results even without members (members only needed for picks)
  const loadInitialDataFromCache = (gwToCheck: number | null, leagueIdToCheck: string) => {
    if (!gwToCheck || !leagueIdToCheck) {
      return { fixtures: [], picks: [], results: [], submissions: new Set<string>(), found: false };
    }
    
    try {
      const cacheKey = `ml_live_table:${leagueIdToCheck}:${gwToCheck}`;
      const cached = getCached<{
        fixtures: Fixture[];
        picks: PickRow[];
        submissions: string[];
        results: Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>;
      }>(cacheKey);
      
      if (cached && cached.fixtures && cached.fixtures.length > 0) {
        return {
          fixtures: cached.fixtures,
          picks: cached.picks ?? [],
          results: cached.results ?? [],
          submissions: new Set<string>(cached.submissions ?? []),
          found: true
        };
      }
    } catch {
      // Cache error
    }
    
    return { fixtures: [], picks: [], results: [], submissions: new Set<string>(), found: false };
  };

  // Initialize state from cache IMMEDIATELY
  const initialCacheData = loadInitialDataFromCache(displayGw, leagueId);
  const [fixtures, setFixtures] = useState<Fixture[]>(initialCacheData.fixtures);
  const [picks, setPicks] = useState<PickRow[]>(initialCacheData.picks);
  const [results, setResults] = useState<Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>>(initialCacheData.results);
  const [submittedUserIds, setSubmittedUserIds] = useState<Set<string>>(initialCacheData.submissions);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [allFixturesFinished, setAllFixturesFinished] = useState(false);
  
  // Start with loading false if we have cache data, true otherwise
  const [loading, setLoading] = useState(!initialCacheData.found);
  const [error, setError] = useState<string | null>(null);

  // Determine which GW to display based on game state
  const { state: currentGwState } = useGameweekState(currentGw);
  
  // Get live scores for the display GW
  const { liveScores: liveScoresMap } = useLiveScores(displayGw ?? undefined, undefined);

  // Convert liveScoresMap to a Record keyed by fixture_index
  const liveScores = useMemo(() => {
    const result: Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }> = {};
    if (!fixtures || fixtures.length === 0) return result;
    fixtures.forEach(fixture => {
      const apiMatchId = fixture.api_match_id;
      if (apiMatchId) {
        const liveScore = liveScoresMap.get(apiMatchId);
        if (liveScore) {
          result[fixture.fixture_index] = {
            homeScore: liveScore.home_score ?? 0,
            awayScore: liveScore.away_score ?? 0,
            status: liveScore.status || 'SCHEDULED',
            minute: liveScore.minute ?? null
          };
        }
      }
    });
    return result;
  }, [liveScoresMap, fixtures]);

  // Determine display GW: current if LIVE/RESULTS_PRE_GW, last completed if GW_OPEN/GW_PREDICTED
  useEffect(() => {
    if (mockData) {
      setDisplayGw(mockData.displayGw);
      setFixtures(mockData.fixtures);
      setPicks(mockData.picks);
      setResults(mockData.results);
      setLoading(false);
      return;
    }

    if (!currentGw) {
      setDisplayGw(null);
      return;
    }

    let alive = true;

    async function determineDisplayGw() {
      if (currentGwState === 'LIVE' || currentGwState === 'RESULTS_PRE_GW') {
        setDisplayGw(currentGw);
        return;
      }

      // For GW_OPEN or GW_PREDICTED, use last completed GW from cache first
      let lastCompletedGw: number | null = null;
      try {
        const cachedLastGw = getCached<number>(LAST_COMPLETED_GW_CACHE_KEY);
        if (cachedLastGw) {
          lastCompletedGw = cachedLastGw;
          setDisplayGw(lastCompletedGw);
          
          // Verify in background (non-blocking)
          (async () => {
            const { data: resultsData } = await supabase
              .from('app_gw_results')
              .select('gw')
              .order('gw', { ascending: false })
              .limit(1);
            
            if (!alive) return;
            
            const dbLastGw = resultsData && resultsData.length > 0 
              ? (resultsData[0] as any).gw 
              : null;
            
            // Update cache if different
            if (dbLastGw !== lastCompletedGw) {
              // Cache update handled by initial data loader, just update local state if needed
              // We're already in a block where currentGwState is not LIVE or RESULTS_PRE_GW
              if (dbLastGw && currentGwState) {
                setDisplayGw(dbLastGw);
              }
            }
          })();
          
          return;
        }
      } catch {
        // Cache error - continue to DB query
      }

      // No cache - fetch from DB
      const { data: resultsData } = await supabase
        .from('app_gw_results')
        .select('gw')
        .order('gw', { ascending: false })
        .limit(1);

      if (!alive) return;

      lastCompletedGw = resultsData && resultsData.length > 0 
        ? (resultsData[0] as any).gw 
        : null;

      setDisplayGw(lastCompletedGw || currentGw);
    }

    determineDisplayGw();

    return () => {
      alive = false;
    };
  }, [currentGw, currentGwState, mockData]);

  // SIMPLIFIED: Convert sharedGwResults to array format and use shared fixtures
  const sharedResultsArray = useMemo(() => {
    if (!displayGw || Object.keys(sharedGwResults).length === 0) return [];
    return Object.entries(sharedGwResults).map(([fixtureIndex, result]) => ({
      gw: displayGw,
      fixture_index: Number(fixtureIndex),
      result: result as "H" | "D" | "A" | null,
    }));
  }, [displayGw, sharedGwResults]);

  // Update data when displayGw changes (and re-check cache)
  useEffect(() => {
    if (mockData) {
      return;
    }

    if (!displayGw || !leagueId) {
      setLoading(false);
      return;
    }

    // CRITICAL: Always check preloader cache FIRST (for picks/submissions)
    // The preloader caches everything under ml_live_table:${leagueId}:${gw}
    const cacheKey = `ml_live_table:${leagueId}:${displayGw}`;
    const cachedData = getCached<{
      fixtures: Fixture[];
      picks: PickRow[];
      submissions: string[];
      results: Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>;
    }>(cacheKey);
    
    if (cachedData && cachedData.fixtures && cachedData.fixtures.length > 0) {
      // Use cached data immediately - no need to fetch!
      setFixtures(cachedData.fixtures);
      setPicks(cachedData.picks ?? []);
      setResults(cachedData.results ?? []);
      setSubmittedUserIds(new Set<string>(cachedData.submissions ?? []));
      setLoading(false);
      return;
    }

    // SIMPLIFIED: If we have shared data from parent, use it directly (no fetching fixtures/results)
    const hasSharedFixtures = sharedFixtures.length > 0;
    if (hasSharedFixtures) {
      // Use shared data immediately
      setFixtures(sharedFixtures);
      setResults(sharedResultsArray);
      
      // Still need to fetch picks/submissions (league-specific)
      const hasMembers = members && members.length > 0;
      if (!hasMembers) {
        // No members yet - show empty table, not loading spinner
        // This prevents infinite loading when members haven't loaded yet
        setPicks([]);
        setSubmittedUserIds(new Set<string>());
        setLoading(false);
        return;
      }
      
      // Track this specific fetch to prevent race conditions
      const fetchGw = displayGw;
      const fetchLeagueId = leagueId;
      
      (async () => {
        try {
          const memberIds = members.map(m => m.id);
          
          // Fetch picks and submissions in parallel
          const [picksResult, submissionsResult] = await Promise.all([
            supabase
              .from('app_picks')
              .select('user_id, gw, fixture_index, pick')
              .eq('gw', fetchGw)
              .in('user_id', memberIds),
            supabase
              .from('app_gw_submissions')
              .select('user_id')
              .eq('gw', fetchGw)
              .in('user_id', memberIds)
              .not('submitted_at', 'is', null)
          ]);
          
          if (picksResult.error) throw picksResult.error;
          
          const fetchedPicks = (picksResult.data ?? []) as PickRow[];
          const submitted = new Set<string>();
          if (submissionsResult.data) {
            submissionsResult.data.forEach((s: any) => submitted.add(s.user_id));
          }
          
          // Always update state - don't discard valid data due to displayGw changing
          // The key insight: if displayGw changed, this effect will run again anyway
          setPicks(fetchedPicks);
          setSubmittedUserIds(submitted);
          setLoading(false);
          
          // Cache the data for future use
          const newCacheKey = `ml_live_table:${fetchLeagueId}:${fetchGw}`;
          setCached(newCacheKey, {
            fixtures: sharedFixtures,
            picks: fetchedPicks,
            submissions: Array.from(submitted),
            results: sharedResultsArray,
          }, CACHE_TTL.HOME);
          
        } catch (err: any) {
          console.error('[MiniLeagueGwTableCard] Error fetching picks:', err);
          setError(err?.message || 'Failed to load data');
          setLoading(false);
        }
      })();
      
      return;
    }

    // FALLBACK: No shared data - fetch everything (for League page standalone use)
    // If members is empty, we can still load fixtures/results from cache
    // Only picks require members, so we can show partial data
    // But if we have no cache and no members, we need to wait
    const hasMembers = members && members.length > 0;

    let alive = true;
    
    // CRITICAL: Capture displayGw at the start of the fetch to prevent race conditions
    // If displayGw changes during fetch, we'll ignore the results
    const fetchDisplayGw = displayGw;
    
    // Define fetchDataFromDb first so it can be called
    async function fetchDataFromDb(setLoadingState: boolean = true) {
      if (setLoadingState) {
        setLoading(true);
        setError(null);
      }
      
      try {
        const { data: fixturesData, error: fixturesError } = await supabase
          .from('app_fixtures')
          .select('id, gw, fixture_index, home_name, away_name, home_team, away_team, home_code, away_code, kickoff_time, api_match_id')
          .eq('gw', fetchDisplayGw)
          .order('fixture_index', { ascending: true });

        if (fixturesError) {
          console.error(`[MiniLeagueGwTableCard] Error fetching fixtures for GW ${fetchDisplayGw}:`, fixturesError);
          throw fixturesError;
        }
        if (!alive) return;
        
        // CRITICAL: Check if displayGw changed during fetch - if so, ignore results
        if (fetchDisplayGw !== displayGw) {
          console.log(`[MiniLeagueGwTableCard] displayGw changed from ${fetchDisplayGw} to ${displayGw} during fetch, ignoring results`);
          return;
        }

        const fixturesArray = (fixturesData as Fixture[]) ?? [];
        
        // Log if fixtures are empty to help diagnose the issue
        if (fixturesArray.length === 0) {
          console.warn(`[MiniLeagueGwTableCard] No fixtures found for GW ${fetchDisplayGw} (leagueId: ${leagueId}, currentGw: ${currentGw}, currentGwState: ${currentGwState})`);
        }
        
        // Double-check displayGw hasn't changed before setting state
        if (fetchDisplayGw === displayGw && alive) {
          setFixtures(fixturesArray);
        }

        // Fetch results first (doesn't require members)
        const { data: resultsData, error: resultsError } = await supabase
          .from('app_gw_results')
          .select('gw, fixture_index, result')
          .eq('gw', fetchDisplayGw);

        if (resultsError) throw resultsError;
        if (!alive || fetchDisplayGw !== displayGw) return;

        // Double-check displayGw hasn't changed before setting state
        if (fetchDisplayGw === displayGw && alive) {
          setResults((resultsData ?? []) as Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>);
        }

        // Only fetch picks if we have members
        const memberIds = members?.map(m => m.id) || [];
        let picksData: any[] = [];
        let submitted = new Set<string>();
        
        if (memberIds.length > 0) {
          const { data: picksDataResult, error: picksError } = await supabase
            .from('app_picks')
            .select('user_id, gw, fixture_index, pick')
            .eq('gw', fetchDisplayGw)
            .in('user_id', memberIds);

          if (picksError) throw picksError;
          if (!alive || fetchDisplayGw !== displayGw) return;

          picksData = picksDataResult ?? [];
          
          // Double-check displayGw hasn't changed before setting state
          if (fetchDisplayGw === displayGw && alive) {
            setPicks(picksData as PickRow[]);
          }

          // Fetch submissions to filter out members who didn't submit
          const { data: submissionsData, error: submissionsError } = await supabase
            .from('app_gw_submissions')
            .select('user_id')
            .eq('gw', fetchDisplayGw)
            .in('user_id', memberIds)
            .not('submitted_at', 'is', null);

          if (submissionsError) {
            console.error('[MiniLeagueGwTableCard] Error fetching submissions:', submissionsError);
          }
          if (!alive || fetchDisplayGw !== displayGw) return;

          // Create Set of user IDs who submitted
          if (submissionsData) {
            submissionsData.forEach((s: any) => {
              submitted.add(s.user_id);
            });
          }
          
          // Double-check displayGw hasn't changed before setting state
          if (fetchDisplayGw === displayGw && alive) {
            setSubmittedUserIds(submitted);
          }
        }

        // Only update loading and cache if displayGw hasn't changed
        if (fetchDisplayGw === displayGw && alive) {
          if (setLoadingState) setLoading(false);
          
          // Cache the fetched data
          const cacheKey = `ml_live_table:${leagueId}:${fetchDisplayGw}`;
          setCached(cacheKey, {
            fixtures: fixturesData,
            picks: picksData,
            submissions: Array.from(submitted),
            results: resultsData ?? [],
          }, CACHE_TTL.HOME);
        }

      } catch (err: any) {
        console.error('[MiniLeagueGwTableCard] Error fetching data from DB:', err);
        if (alive && setLoadingState) {
          setError(err?.message || 'Failed to load data');
          setLoading(false);
        }
      }
    }
    
    // Check cache immediately for current displayGw (synchronous)
    // Can load fixtures/results even without members
    const cacheData = loadInitialDataFromCache(displayGw, leagueId);
    if (cacheData.found) {
      // Update state from cache (already loaded on mount, but update if displayGw changed)
      setFixtures(cacheData.fixtures);
      setPicks(cacheData.picks);
      setResults(cacheData.results);
      setSubmittedUserIds(cacheData.submissions);
      setLoading(false);
      
      // Background refresh (non-blocking, silent on error) - only if we have members
      if (hasMembers) {
        fetchDataFromDb(false).catch(() => {
          // Silently fail - we already have cached data displayed
        });
      }
      
      return () => { alive = false; };
    }
    
    // No cache - fetch from DB (only if we have members, otherwise wait)
    if (!hasMembers) {
      // No members yet - keep loading state, will retry when members arrive
      // Don't set error - members might arrive soon
      // CRITICAL: Keep loading true so we don't show "No results" prematurely
      setLoading(true);
      return () => { alive = false; };
    }
    
    // No cache but we have members - fetch from DB
    fetchDataFromDb(true).catch((err: any) => {
      console.error('[MiniLeagueGwTableCard] Error fetching data:', err);
      if (alive) {
        setError(err?.message || 'Failed to load data');
        setLoading(false);
      }
    });
    
    return () => { alive = false; };
  }, [displayGw, leagueId, members, mockData, currentGw, sharedFixtures, sharedResultsArray]);

  // Calculate rows from picks and results/live scores
  useEffect(() => {
    if (!displayGw) {
      setRows([]);
      return;
    }
    
    // CRITICAL FIX: Don't set empty rows if fixtures are empty but we're still loading
    // Only set empty rows if we've finished loading AND fixtures are still empty
    if (fixtures.length === 0) {
      // If still loading, don't set empty rows yet - wait for data
      if (loading) {
        return;
      }
      // Loading finished but no fixtures - set empty rows
      setRows([]);
      return;
    }

    const outcomes = new Map<number, "H" | "D" | "A">();
    const fixturesForGw = fixtures.filter(f => f.gw === displayGw);

    const hasLiveScores = fixturesForGw.some((f) => {
      const liveScore = liveScores[f.fixture_index];
      return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
    });

    if (hasLiveScores && displayGw === currentGw) {
      fixturesForGw.forEach((f) => {
        const liveScore = liveScores[f.fixture_index];
        if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
          if (liveScore.homeScore > liveScore.awayScore) {
            outcomes.set(f.fixture_index, 'H');
          } else if (liveScore.awayScore > liveScore.homeScore) {
            outcomes.set(f.fixture_index, 'A');
          } else {
            outcomes.set(f.fixture_index, 'D');
          }
        }
      });
    } else {
      results.forEach((r) => {
        if (r.gw !== displayGw) return;
        const out = rowToOutcome(r);
        if (out) outcomes.set(r.fixture_index, out);
      });
    }

    // CRITICAL: Only include members who have submitted for this GW
    // Filter out members who didn't submit (like Steve in the user's example)
    const calculatedRows: ResultRow[] = members
      .filter((m) => submittedUserIds.has(m.id))
      .map((m) => ({
        user_id: m.id,
        name: m.name,
        score: 0,
        unicorns: 0,
      }));

    const picksByFixture = new Map<number, Array<{ user_id: string; pick: "H" | "D" | "A" }>>();
    picks.forEach((p) => {
      if (p.gw !== displayGw) return;
      // Also filter picks to only include from users who submitted
      if (!submittedUserIds.has(p.user_id)) return;
      const arr = picksByFixture.get(p.fixture_index) ?? [];
      arr.push({ user_id: p.user_id, pick: p.pick });
      picksByFixture.set(p.fixture_index, arr);
    });

    Array.from(outcomes.entries()).forEach(([idx, out]) => {
      const these = picksByFixture.get(idx) ?? [];
      const correctIds = these.filter((p) => p.pick === out).map((p) => p.user_id);

      correctIds.forEach((uid) => {
        const r = calculatedRows.find((x) => x.user_id === uid);
        if (r) r.score += 1;
      });

      // Unicorns: only one person got it right AND at least 3 members submitted
      if (correctIds.length === 1 && submittedUserIds.size >= 3) {
        const r = calculatedRows.find((x) => x.user_id === correctIds[0]);
        if (r) r.unicorns += 1;
      }
    });

    calculatedRows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name));
    setRows(calculatedRows);

    // Check if all fixtures are finished
    const allFinished = fixturesForGw.every((f) => {
      if (hasLiveScores && displayGw === currentGw) {
        const liveScore = liveScores[f.fixture_index];
        return liveScore?.status === 'FINISHED';
      }
      return outcomes.has(f.fixture_index);
    });
    setAllFixturesFinished(allFinished);
  }, [displayGw, fixtures, picks, results, members, liveScores, currentGw, submittedUserIds]);

  // Determine if GW is live - show LIVE badge for entire duration of LIVE state
  // (from when games start until GW ends, not just when fixtures are currently IN_PLAY)
  const isLive = mockData?.isLive ?? (currentGwState === 'LIVE' && displayGw === currentGw);
  
  // Determine if gameweek is finished and if there's a draw
  const isFinished = allFixturesFinished;
  const isDraw = rows.length > 1 && rows[0]?.score === rows[1]?.score && rows[0]?.unicorns === rows[1]?.unicorns;
  
  // Calculate fixed height based on actual submitted members for this league
  // CRITICAL: Use actual rows.length (submitted members) to ensure all rows are visible
  // Don't use maxMemberCount as it might be from a different league and could make this card too small
  const memberCountForHeight = rows.length > 0 
    ? rows.length // Use actual submitted count for this league
    : (members.length); // Fallback to total members if rows not calculated yet
  const cardHeight = calculateCardHeight(memberCountForHeight);
  
  // maxMemberCount is passed but not used - we use actual rows.length instead for accurate height

  const badge = unread > 0 ? Math.min(unread, 99) : 0;

  const cardContent = (
    <>
      <style>{`
        @keyframes flash {
          0%, 100% {
            background-color: rgb(209, 250, 229);
          }
          25% {
            background-color: rgb(167, 243, 208);
          }
          50% {
            background-color: rgb(209, 250, 229);
          }
          75% {
            background-color: rgb(167, 243, 208);
          }
        }
        @keyframes pulse-score {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
        .flash-user-row {
          animation: flash 1.5s ease-in-out 3;
        }
        .pulse-live-score {
          animation: pulse-score 2s ease-in-out infinite;
        }
      `}</style>
      {/* Compact Header */}
      <div className="px-4 py-3 bg-white rounded-t-xl">
        <div className="flex items-start gap-2">
          <img
            src={getLeagueAvatarUrl({ id: leagueId, avatar })}
            alt={`${leagueName} avatar`}
            className="w-[47px] h-[47px] rounded-full flex-shrink-0 object-cover shadow-sm"
            onError={(e) => {
              // Fallback to default ML avatar if custom avatar fails
              const target = e.target as HTMLImageElement;
              const defaultAvatar = getDefaultMlAvatar(leagueId);
              const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
              if (target.src !== fallbackSrc) {
                target.src = fallbackSrc;
              }
            }}
          />
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <h3 className="text-base font-bold text-black truncate">
              {leagueName}
            </h3>
            {/* Small winner indicator - only show for completed GWs, not live ones */}
            {rows.length > 0 && isFinished && !isLive && (() => {
              const winnerText = isDraw ? 'Draw!' : (() => {
                const winnerName = rows[0].name;
                const maxLength = 15;
                if (winnerName.length > maxLength) {
                  return `${winnerName.substring(0, maxLength)}... Wins!`;
                }
                return `${winnerName} Wins!`;
              })();
              return (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 text-white shadow-sm flex-shrink-0 w-fit">
                  <span className="text-[10px] font-semibold">{winnerText}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-2 pb-4 flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8 flex-1">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1C8376]"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 flex-1">
            <div className="text-xs text-red-500">{error}</div>
          </div>
        ) : !displayGw ? (
          <div className="text-center py-8 flex-1">
            <div className="text-xs text-slate-500">No gameweek available</div>
          </div>
        ) : (
          <>
            {/* Table */}
            {rows.length > 0 ? (
              <div className="overflow-visible flex-1 -mx-4">
                <div className="bg-white px-4">
                  <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', backgroundColor: '#ffffff', width: '100%' }}>
                    <thead className="sticky top-0" style={{ 
                      position: 'sticky', 
                      top: 0, 
                      zIndex: 25, 
                      backgroundColor: '#ffffff', 
                      display: 'table-header-group'
                    } as any}>
                      <tr className="bg-white border-b border-slate-200">
                        <th className="py-2 text-left font-semibold text-xs uppercase tracking-wide bg-white w-6 pl-2 pr-1 text-[#1C8376]"></th>
                        <th className="py-2 text-left font-semibold text-xs text-slate-300 bg-white pl-2 pr-2">
                          Player
                        </th>
                        <th className="py-2 text-center font-semibold text-xs text-slate-300 bg-white w-10 pl-1 pr-1">
                          Score
                        </th>
                        {members.length >= 3 && <th className="py-2 text-center font-semibold text-xs bg-white w-8 pl-1 pr-1 text-[#1C8376] text-base">🦄</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const isMe = r.user_id === currentUserId;
                        return (
                          <tr 
                            key={r.user_id} 
                            className={isMe ? 'flash-user-row' : ''}
                            style={{
                              position: 'relative',
                              backgroundColor: '#ffffff',
                              ...(i < rows.length - 1 ? { borderBottom: '1px solid #e2e8f0' } : {})
                            }}
                          >
                            <td className="py-2 text-left tabular-nums whitespace-nowrap bg-white w-6 pl-2 pr-1 text-xs">
                              {i + 1}
                            </td>
                            <td className="py-2 truncate whitespace-nowrap bg-white pl-2 pr-2 text-xs">
                              <span>{r.name}</span>
                            </td>
                            <td className={`py-2 text-center tabular-nums font-bold text-[#1C8376] text-xs bg-white w-10 pl-1 pr-1 ${isLive ? 'pulse-live-score' : ''}`}>{r.score}</td>
                            {members.length >= 3 && <td className={`py-2 text-center tabular-nums text-xs bg-white w-8 pl-1 pr-1 ${isLive ? 'pulse-live-score' : ''}`}>{r.unicorns}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 flex-1">
                <div className="text-xs text-slate-500">
                  No results for GW {displayGw}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <Link
      to={`/league/${leagueCode}`}
      className="w-[320px] flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden block no-underline relative"
      style={{ 
        minHeight: `${cardHeight}px`,
        height: 'auto', // Use auto to allow card to grow to fit all rows
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Chat Badge - Top Right of Card */}
      {badge > 0 && (
        <div className="absolute top-3 right-3 z-30">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#1C8376] text-white text-xs font-bold shadow-sm">
            {badge}
          </span>
        </div>
      )}
      {cardContent}
    </Link>
  );
}

