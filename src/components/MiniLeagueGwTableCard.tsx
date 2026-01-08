import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useGameweekState } from '../hooks/useGameweekState';
import { useDisplayGameweek } from '../hooks/useDisplayGameweek';
import { useLiveScores } from '../hooks/useLiveScores';
import { useSharedGwData } from '../hooks/useSharedGwData';
import { getLeagueAvatarUrl, getDefaultMlAvatar } from '../lib/leagueAvatars';
import { getCached, setCached, CACHE_TTL } from '../lib/cache';
import type { Fixture } from './FixtureCard';
import UserAvatar from './UserAvatar';

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
  mockData,
}: MiniLeagueGwTableCardProps) {
  // Track component mount/unmount
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:mount',message:'Component MOUNTED',data:{leagueId,leagueName,membersLength:members?.length,currentGw,stackTrace:new Error().stack?.split('\n').slice(0,5).join('|')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'LIFECYCLE'})}).catch(()=>{});
    // #endregion
    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:unmount',message:'Component UNMOUNTED',data:{leagueId,leagueName,membersLength:members?.length,currentGw,stackTrace:new Error().stack?.split('\n').slice(0,5).join('|')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'LIFECYCLE'})}).catch(()=>{});
      // #endregion
    };
  }, []);
  
  // Track when members prop changes
  const prevMembersRef = useRef(members);
  useEffect(() => {
    if (prevMembersRef.current !== members) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:membersChange',message:'Members prop CHANGED',data:{leagueId,prevLength:prevMembersRef.current?.length,newLength:members?.length,prevMembers:prevMembersRef.current?.map(m=>m.id).slice(0,3),newMembers:members?.map(m=>m.id).slice(0,3),stackTrace:new Error().stack?.split('\n').slice(0,5).join('|')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'MEMBERS'})}).catch(()=>{});
      // #endregion
      prevMembersRef.current = members;
    }
  }, [members, leagueId]);
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:80',message:'Component render',data:{leagueId,leagueName,membersLength:members?.length,currentGw,hasMockData:!!mockData,memberIds:members?.map(m=>m.id).slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  // CRITICAL FIX: Use useDisplayGameweek hook directly to get correct GW even when prop is null
  // This ensures we always have the correct GW even if HomePage hasn't loaded it yet
  const { displayGw: hookDisplayGw, currentGw: hookCurrentGw, loading: hookLoading } = useDisplayGameweek();
  
  // Use hook value if prop is null or suspicious, otherwise use prop (for backwards compatibility)
  const effectiveCurrentGw = currentGw && currentGw >= 10 ? currentGw : (hookCurrentGw ?? null);
  
  // Initialize displayGw - prefer hook value, fallback to prop if hook not ready
  const [displayGw, setDisplayGw] = useState<number | null>(() => {
    // If hook has a value, use it (most reliable)
    if (hookDisplayGw && hookDisplayGw >= 10) {
      return hookDisplayGw;
    }
    // If prop is valid and hook isn't ready, use prop
    if (currentGw && currentGw >= 10) {
      return currentGw;
    }
    // Otherwise wait for hook
    return null;
  });
  
  // Load league-specific data (picks/submissions) from cache IMMEDIATELY on mount if available
  // Note: Fixtures/results are now handled by shared data hook
  const loadInitialDataFromCache = (gwToCheck: number | null, leagueIdToCheck: string) => {
    if (!gwToCheck || !leagueIdToCheck) {
      return { picks: [], submissions: new Set<string>(), found: false };
    }
    
    try {
      const cacheKey = `ml_live_table:${leagueIdToCheck}:${gwToCheck}`;
      const cached = getCached<{
        picks: PickRow[];
        submissions: string[];
      }>(cacheKey);
      
      if (cached && cached.picks) {
        return {
          picks: cached.picks ?? [],
          submissions: new Set<string>(cached.submissions ?? []),
          found: true
        };
      }
    } catch {
      // Cache error
    }
    
    return { picks: [], submissions: new Set<string>(), found: false };
  };

  // Use shared data hook for fixtures and results (automatically deduplicates requests)
  const { fixtures: sharedFixtures, results: sharedResults, loading: sharedLoading, error: sharedError } = useSharedGwData(displayGw);
  
  // Initialize picks/submissions from cache IMMEDIATELY (league-specific data)
  const initialCacheData = loadInitialDataFromCache(displayGw, leagueId);
  const [picks, setPicks] = useState<PickRow[]>(initialCacheData.picks);
  const [submittedUserIds, setSubmittedUserIds] = useState<Set<string>>(initialCacheData.submissions);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [allFixturesFinished, setAllFixturesFinished] = useState(false);
  
  // Use fixtures/results from shared hook
  const fixtures = sharedFixtures;
  const results = sharedResults;
  
  // Loading state: true if shared data is loading OR if we're fetching picks/submissions
  const [picksLoading, setPicksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Combined loading state
  const loading = sharedLoading || picksLoading;
  
  // Track which GW we've already warned about to prevent duplicate warnings
  const warnedAboutGwRef = useRef<number | null>(null);

  // Determine which GW to display based on game state
  // Use effectiveCurrentGw (from hook or prop) for game state determination
  const validatedCurrentGw = effectiveCurrentGw && effectiveCurrentGw >= 1 ? effectiveCurrentGw : null;
  const { state: currentGwState } = useGameweekState(validatedCurrentGw);
  
  // Debug logging
  useEffect(() => {
    if (effectiveCurrentGw !== displayGw) {
      console.log(`[MiniLeagueGwTableCard] GW mismatch - effectiveCurrentGw: ${effectiveCurrentGw}, displayGw: ${displayGw}, validatedCurrentGw: ${validatedCurrentGw}, state: ${currentGwState}`);
    }
    if (displayGw && fixtures.length === 0 && !loading) {
      console.warn(`[MiniLeagueGwTableCard] No fixtures loaded for displayGw ${displayGw} - this might cause "No results" message`);
    }
    // Log shared data errors
    if (sharedError) {
      console.error(`[MiniLeagueGwTableCard] Shared data error for GW ${displayGw}:`, sharedError);
      setError(sharedError);
    }
  }, [effectiveCurrentGw, displayGw, currentGwState, validatedCurrentGw, fixtures.length, loading, sharedError]);
  
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

  // CRITICAL FIX: Sync displayGw with hook value when it becomes available
  useEffect(() => {
    if (hookDisplayGw && hookDisplayGw >= 10 && displayGw !== hookDisplayGw) {
      console.log(`[MiniLeagueGwTableCard] Syncing displayGw from hook: ${displayGw} -> ${hookDisplayGw}`);
      setDisplayGw(hookDisplayGw);
    }
  }, [hookDisplayGw, displayGw]);

  // Determine display GW: current if LIVE/RESULTS_PRE_GW, last completed if GW_OPEN/GW_PREDICTED
  useEffect(() => {
    if (mockData) {
      setDisplayGw(mockData.displayGw);
      // Note: Fixtures/results come from shared hook, but mockData overrides them
      // We'll handle mockData in the rows calculation effect instead
      setPicks(mockData.picks);
      setPicksLoading(false);
      return;
    }

    // CRITICAL FIX: Use effectiveCurrentGw instead of currentGw prop
    if (!effectiveCurrentGw) {
      // If hook is still loading, wait for it
      if (hookLoading) {
        return;
      }
      // If hook loaded but no GW, set to null
      setDisplayGw(null);
      return;
    }

    let alive = true;

    async function determineDisplayGw() {
      // DEFENSIVE CHECK: Validate effectiveCurrentGw is reasonable
      if (!effectiveCurrentGw || effectiveCurrentGw < 1) {
        console.error(`[MiniLeagueGwTableCard] Invalid effectiveCurrentGw: ${effectiveCurrentGw}, cannot determine display GW`);
        setDisplayGw(null);
        return;
      }
      
      // CRITICAL FIX: Check state using the validated effectiveCurrentGw
      console.log(`[MiniLeagueGwTableCard] Determining display GW - effectiveCurrentGw: ${effectiveCurrentGw}, validatedCurrentGw: ${validatedCurrentGw}, state: ${currentGwState}`);
      
      if (currentGwState === 'LIVE' || currentGwState === 'RESULTS_PRE_GW') {
        // DEFENSIVE CHECK: Even for LIVE/RESULTS_PRE_GW, validate effectiveCurrentGw is reasonable
        if (validatedCurrentGw && validatedCurrentGw >= 1) {
          console.log(`[MiniLeagueGwTableCard] Using validatedCurrentGw (${validatedCurrentGw}) for LIVE/RESULTS_PRE_GW state`);
          setDisplayGw(validatedCurrentGw);
        } else if (effectiveCurrentGw >= 1) {
          // Fallback to effectiveCurrentGw if validatedCurrentGw is null but effectiveCurrentGw is valid
          console.log(`[MiniLeagueGwTableCard] Using effectiveCurrentGw (${effectiveCurrentGw}) as fallback for LIVE/RESULTS_PRE_GW state`);
          setDisplayGw(effectiveCurrentGw);
        } else {
          console.error(`[MiniLeagueGwTableCard] Invalid effectiveCurrentGw for LIVE state: ${effectiveCurrentGw}`);
          setDisplayGw(null);
        }
        return;
      }

      // For GW_OPEN or GW_PREDICTED, use last completed GW from cache first
      let lastCompletedGw: number | null = null;
      try {
        const cachedLastGw = getCached<number>(LAST_COMPLETED_GW_CACHE_KEY);
        if (cachedLastGw && cachedLastGw >= 1) {
          // DEFENSIVE CHECK: Validate cached GW is reasonable
          // If cached GW is much lower than effectiveCurrentGw, it might be stale
          if (cachedLastGw < effectiveCurrentGw - 2) {
            console.warn(`[MiniLeagueGwTableCard] Cached last GW (${cachedLastGw}) is much lower than effectiveCurrentGw (${effectiveCurrentGw}), validating...`);
            // Don't use cached value, fetch fresh
          } else {
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
              
              // Update cache if different and reasonable
              if (dbLastGw && dbLastGw !== lastCompletedGw && dbLastGw >= 1) {
                // Cache update handled by initial data loader, just update local state if needed
                // We're already in a block where currentGwState is not LIVE or RESULTS_PRE_GW
                if (currentGwState) {
                  setDisplayGw(dbLastGw);
                }
              }
            })();
            
            return;
          }
        }
      } catch {
        // Cache error - continue to DB query
      }

      // No cache or cache invalid - fetch from DB
      const { data: resultsData } = await supabase
        .from('app_gw_results')
        .select('gw')
        .order('gw', { ascending: false })
        .limit(1);

      if (!alive) return;

      lastCompletedGw = resultsData && resultsData.length > 0 
        ? (resultsData[0] as any).gw 
        : null;

      // DEFENSIVE CHECK: Validate lastCompletedGw before using
      if (lastCompletedGw && lastCompletedGw >= 1) {
        setDisplayGw(lastCompletedGw);
      } else if (effectiveCurrentGw >= 1) {
        // Fallback to effectiveCurrentGw if it's valid
        console.warn(`[MiniLeagueGwTableCard] No valid last completed GW found, using effectiveCurrentGw: ${effectiveCurrentGw}`);
        setDisplayGw(effectiveCurrentGw);
      } else {
        console.error(`[MiniLeagueGwTableCard] Cannot determine display GW - lastCompletedGw: ${lastCompletedGw}, effectiveCurrentGw: ${effectiveCurrentGw}`);
        setDisplayGw(null);
      }
    }

    determineDisplayGw();

    return () => {
      alive = false;
    };
  }, [effectiveCurrentGw, currentGwState, mockData, validatedCurrentGw, hookLoading]);

  // Track previous displayGw to detect changes
  const prevDisplayGwRef = useRef<number | null>(null);
  
  // Update data when displayGw changes (and re-check cache)
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:309',message:'useEffect entry',data:{leagueId,displayGw,membersLength:members?.length,hasMockData:!!mockData,prevDisplayGw:prevDisplayGwRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (mockData) {
      return;
    }

    if (!displayGw || !leagueId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:315',message:'Early return: missing displayGw or leagueId',data:{displayGw,leagueId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // If displayGw is null, we're waiting for it - shared hook handles loading state
      // Picks loading is separate
      setPicksLoading(false);
      return;
    }

    // CRITICAL: Clear stale data when displayGw changes to a different GW
    // This prevents showing wrong GW data while loading correct GW data
    // Note: Fixtures/results are handled by shared hook, only clear picks/submissions
    if (prevDisplayGwRef.current !== null && prevDisplayGwRef.current !== displayGw) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:321',message:'displayGw changed - clearing stale data',data:{prevDisplayGw:prevDisplayGwRef.current,newDisplayGw:displayGw,leagueId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.log(`[MiniLeagueGwTableCard] displayGw changed from ${prevDisplayGwRef.current} to ${displayGw}, clearing stale picks/submissions`);
      // Clear picks/submissions that might be from wrong GW (fixtures/results handled by shared hook)
      setPicks([]);
      setSubmittedUserIds(new Set());
    }
    prevDisplayGwRef.current = displayGw;

    // CRITICAL: Always re-check cache when displayGw changes, even if we already have data
    // This ensures we load the correct GW data when displayGw changes from wrong GW to correct GW
    console.log(`[MiniLeagueGwTableCard] Loading data for GW ${displayGw}...`);

    // If members is empty, we can still load fixtures/results from cache
    // Only picks require members, so we can show partial data
    // But if we have no cache and no members, we need to wait
    const hasMembers = members && members.length > 0;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:338',message:'Members check',data:{hasMembers,membersLength:members?.length,memberIds:members?.map(m=>m.id).slice(0,3),leagueId,displayGw},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    let alive = true;
    
    // Define fetchPicksFromDb - only fetches league-specific data (picks/submissions)
    // Fixtures/results are handled by shared data hook
    async function fetchPicksFromDb(setLoadingState: boolean = true) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:343',message:'fetchPicksFromDb entry',data:{setLoadingState,displayGw,leagueId,membersLength:members?.length,alive},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (setLoadingState) {
        setPicksLoading(true);
        setError(null);
      }
      
      try {
        // Only fetch picks if we have members
        const memberIds = members?.map(m => m.id) || [];
        let picksData: any[] = [];
        let submitted = new Set<string>();
        
        if (memberIds.length === 0) {
          if (setLoadingState) setPicksLoading(false);
          return;
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:373',message:'Before fetching picks/submissions',data:{memberIdsLength:memberIds.length,memberIds:memberIds.slice(0,3),displayGw,leagueId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Retry wrapper for picks query
        const fetchWithRetry = async (queryFn: () => Promise<any>, maxRetries = 3) => {
          let lastError: any = null;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              return await queryFn();
            } catch (error: any) {
              lastError = error;
              if (attempt === maxRetries || error?.code === 'PGRST116') {
                break;
              }
              const delay = 1000 * Math.pow(2, attempt);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          throw lastError;
        };
        
        // Fetch picks with retry
        const picksResult = await fetchWithRetry(async () => {
          const { data, error } = await supabase
            .from('app_picks')
            .select('user_id, gw, fixture_index, pick')
            .eq('gw', displayGw)
            .in('user_id', memberIds);
          if (error) throw error;
          return data;
        }, 3);
        
        if (!alive) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:385',message:'Early return: !alive after picks',data:{displayGw,leagueId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          return;
        }

        picksData = picksResult ?? [];
        setPicks(picksData as PickRow[]);

        // Fetch submissions with retry
        const submissionsResult = await fetchWithRetry(async () => {
          const { data, error } = await supabase
            .from('app_gw_submissions')
            .select('user_id')
            .eq('gw', displayGw)
            .in('user_id', memberIds)
            .not('submitted_at', 'is', null);
          if (error) throw error;
          return data;
        }, 3);

        if (!alive) return;

        // Create Set of user IDs who submitted
        if (submissionsResult) {
          submissionsResult.forEach((s: any) => {
            submitted.add(s.user_id);
          });
        }

        // Simple fallback: If no submissions but picks exist, derive from picks
        if (submitted.size === 0 && picksData.length > 0) {
          const picksForGw = picksData.filter(p => p.gw === displayGw);
          picksForGw.forEach(p => {
            if (memberIds.includes(p.user_id)) {
              submitted.add(p.user_id);
            }
          });
        }

        if (alive) {
          setSubmittedUserIds(submitted);
        }

        if (setLoadingState) setPicksLoading(false);
        
        // Cache only league-specific data (picks/submissions)
        // Fixtures/results are cached by shared data service
        const cacheKey = `ml_live_table:${leagueId}:${displayGw}`;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:416',message:'Caching fetched picks/submissions',data:{cacheKey,picksCount:picksData.length,submissionsCount:submitted.size,displayGw,leagueId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        setCached(cacheKey, {
          picks: picksData,
          submissions: Array.from(submitted),
        }, CACHE_TTL.HOME);

      } catch (err: any) {
        console.error('[MiniLeagueGwTableCard] Error fetching picks/submissions from DB:', err);
        if (alive && setLoadingState) {
          // Provide more helpful error messages for common issues
          let errorMessage = 'Failed to load picks data';
          if (err?.message?.includes('502') || err?.message?.includes('Bad Gateway')) {
            errorMessage = 'Supabase is temporarily unavailable. Please try again in a moment.';
          } else if (err?.message?.includes('CORS') || err?.code === 'ERR_NETWORK') {
            errorMessage = 'Network error. Please check your connection.';
          } else if (err?.message) {
            errorMessage = err.message;
          }
          setError(errorMessage);
          setPicksLoading(false);
        }
      }
    }
    
    // CRITICAL FIX: Always check cache for the CURRENT displayGw (not the initial one)
    // This ensures we load the correct GW data when displayGw changes
    // Note: Fixtures/results are handled by shared hook, only check cache for picks/submissions
    const cacheData = loadInitialDataFromCache(displayGw, leagueId);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:444',message:'Cache check result',data:{cacheFound:cacheData.found,picksCount:cacheData.picks.length,submissionsCount:cacheData.submissions.size,hasMembers,membersLength:members?.length,displayGw,leagueId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // If we have cached picks/submissions, use them
    if (cacheData.found && cacheData.picks.length > 0) {
      console.log(`[MiniLeagueGwTableCard] Found cache for GW ${displayGw} - ${cacheData.picks.length} picks, ${cacheData.submissions.size} submissions`);
      // Update state from cache (fixtures/results come from shared hook)
      setPicks(cacheData.picks);
      
      // Simple: Use cache submissions, or derive from picks if empty
      let submittedFromCache = cacheData.submissions;
      if (submittedFromCache.size === 0 && cacheData.picks.length > 0 && hasMembers) {
        // Derive from picks if cache has no submissions and we have members
        const picksForGw = cacheData.picks.filter(p => p.gw === displayGw);
        picksForGw.forEach(p => {
          if (members.some(m => m.id === p.user_id)) {
            submittedFromCache.add(p.user_id);
          }
        });
      }
      setSubmittedUserIds(submittedFromCache);
      
      // Picks loading is done (fixtures/results loading handled by shared hook)
      setPicksLoading(false);
      
      // If we have members, check if picks are complete and fetch if needed
      if (hasMembers) {
        // Check if we have picks for all members - if not, fetch picks from DB
        const memberIds = members.map(m => m.id);
        const cachedPickUserIds = new Set(cacheData.picks.map(p => p.user_id));
        const allMembersHavePicks = memberIds.every(id => cachedPickUserIds.has(id));
        
        if (!allMembersHavePicks || cacheData.picks.length === 0) {
          // Cache is incomplete - fetch picks from DB in background
          console.log(`[MiniLeagueGwTableCard] Cache incomplete - fetching picks for ${memberIds.length} members`);
          fetchPicksFromDb(false).catch(() => {
            // Silently fail - we already have cached picks displayed
          });
        } else {
          // Cache is complete - just background refresh
          fetchPicksFromDb(false).catch(() => {
            // Silently fail - we already have cached data displayed
          });
        }
      }
      // If no members, we'll retry when members arrive (useEffect will run again)
      
      return () => { alive = false; };
    } else {
      console.log(`[MiniLeagueGwTableCard] No cache found for GW ${displayGw} (found: ${cacheData.found}, picks: ${cacheData.picks.length})`);
    }
    
    // No cache - fetch picks from DB (only if we have members, otherwise wait)
    // Note: Fixtures/results are handled by shared hook, so we only need to fetch picks/submissions
    if (!hasMembers) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:483',message:'No members - waiting',data:{displayGw,leagueId,membersLength:members?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // No members yet - picks loading is false (fixtures/results loading handled by shared hook)
      setPicksLoading(false);
      return () => { alive = false; };
    }
    
    // No cache but we have members - fetch picks from DB
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:489',message:'No cache - fetching picks from DB',data:{displayGw,leagueId,membersLength:members?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    fetchPicksFromDb(true).catch((err: any) => {
      console.error('[MiniLeagueGwTableCard] Error fetching picks:', err);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:491',message:'Error fetching picks',data:{error:err?.message,displayGw,leagueId,alive},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      if (alive) {
        setError(err?.message || 'Failed to load picks data');
        setPicksLoading(false);
      }
    });
    
    return () => { alive = false; };
  }, [displayGw, leagueId, members, mockData, currentGw]);

  // Calculate rows from picks and results/live scores
  useEffect(() => {
    // Handle mockData - use mock fixtures/results if provided
    const effectiveFixtures = mockData?.fixtures ?? fixtures;
    const effectiveResults = mockData?.results ?? results;
    
    if (!displayGw) {
      setRows([]);
      return;
    }
    
    // Don't set empty rows if still loading - wait for data
    // This prevents empty tables from showing while data is being fetched
    if (effectiveFixtures.length === 0 && loading) {
      return; // Still loading, don't set empty rows yet
    }
    
    if (effectiveFixtures.length === 0) {
      setRows([]);
      return;
    }
    
    // Don't calculate rows if members haven't loaded yet
    if (!members || members.length === 0) {
      return;
    }

    // Wait for picks to load before calculating rows (if we have no submissions yet)
    // This prevents showing "No results" before data is loaded
    if (submittedUserIds.size === 0 && picks.length === 0 && loading) {
      return; // Still loading, wait for picks to arrive
    }

    // Simple fallback: If submissions are empty but picks exist, derive from picks
    // This handles cases where submissions query hasn't completed yet or returned empty
    let effectiveSubmittedUserIds = submittedUserIds;
    if (submittedUserIds.size === 0 && picks.length > 0) {
      const picksForGw = picks.filter(p => p.gw === displayGw);
      const derivedSubmittedIds = new Set<string>();
      picksForGw.forEach(p => {
        if (members.some(m => m.id === p.user_id)) {
          derivedSubmittedIds.add(p.user_id);
        }
      });
      if (derivedSubmittedIds.size > 0) {
        effectiveSubmittedUserIds = derivedSubmittedIds;
        // Update state so future renders use the derived value
        setSubmittedUserIds(derivedSubmittedIds);
      }
    }

    const outcomes = new Map<number, "H" | "D" | "A">();
    const fixturesForGw = effectiveFixtures.filter(f => f.gw === displayGw);

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
      effectiveResults.forEach((r) => {
        if (r.gw !== displayGw) return;
        const out = rowToOutcome(r);
        if (out) outcomes.set(r.fixture_index, out);
      });
    }

    // Only include members who have submitted for this GW (simple filter like LeaguePage)
    const calculatedRows: ResultRow[] = members
      .filter((m) => effectiveSubmittedUserIds.has(m.id))
      .map((m) => ({
        user_id: m.id,
        name: m.name,
        score: 0,
        unicorns: 0,
      }));
    
    // Debug logging for empty rows - more detailed
    // Only warn once per GW to avoid console spam from re-renders
    if (calculatedRows.length === 0 && displayGw && warnedAboutGwRef.current !== displayGw) {
      warnedAboutGwRef.current = displayGw;
      const memberIdsList = members.map(m => m.id).slice(0, 3); // First 3 for logging
      const submittedIdsList = Array.from(submittedUserIds).slice(0, 3);
      const picksForGw = picks.filter(p => p.gw === displayGw);
      const resultsForGw = results.filter(r => r.gw === displayGw);
      
      console.warn(`[MiniLeagueGwTableCard] No rows calculated for GW ${displayGw}:`, {
        displayGw,
        effectiveCurrentGw,
        fixturesCount: effectiveFixtures.length,
        fixturesForGwCount: fixturesForGw.length,
        picksCount: picks.length,
        picksForGwCount: picksForGw.length,
        resultsCount: effectiveResults.length,
        resultsForGwCount: resultsForGw.length,
        outcomesCount: outcomes.size,
        membersCount: members.length,
        submittedCount: submittedUserIds.size,
        memberIds: memberIdsList,
        submittedIds: submittedIdsList,
        hasLiveScores,
        isLiveState: displayGw === effectiveCurrentGw && hasLiveScores,
        leagueId: leagueId.slice(0, 8) // First 8 chars for privacy
      });
      
      // If we have fixtures but no submissions (even after deriving from picks), that's the issue
      if (effectiveFixtures.length > 0 && effectiveSubmittedUserIds.size === 0) {
        const picksForGw = picks.filter(p => p.gw === displayGw);
        if (picksForGw.length > 0) {
          console.warn(`[MiniLeagueGwTableCard] Have ${picksForGw.length} picks for GW ${displayGw} but couldn't derive submissions - members might not match`);
        } else {
          console.warn(`[MiniLeagueGwTableCard] Have ${effectiveFixtures.length} fixtures for GW ${displayGw} but no picks loaded yet - waiting for data`);
        }
      }
      
      // If we have no fixtures, that's a different issue
      if (effectiveFixtures.length === 0) {
        console.error(`[MiniLeagueGwTableCard] CRITICAL: No fixtures loaded for GW ${displayGw}!`);
      }
    }
    
    // Reset warning ref if we successfully calculated rows (for a different GW)
    if (calculatedRows.length > 0 && warnedAboutGwRef.current === displayGw) {
      warnedAboutGwRef.current = null;
    }

    const picksByFixture = new Map<number, Array<{ user_id: string; pick: "H" | "D" | "A" }>>();
    picks.forEach((p) => {
      if (p.gw !== displayGw) return;
      // Also filter picks to only include from users who submitted
      if (!effectiveSubmittedUserIds.has(p.user_id)) return;
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
      if (correctIds.length === 1 && effectiveSubmittedUserIds.size >= 3) {
        const r = calculatedRows.find((x) => x.user_id === correctIds[0]);
        if (r) r.unicorns += 1;
      }
    });

    calculatedRows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name));
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueGwTableCard.tsx:623',message:'Setting rows',data:{rowsCount:calculatedRows.length,submittedUserIdsSize:submittedUserIds.size,membersLength:members?.length,displayGw,leagueId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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
  }, [displayGw, fixtures, picks, results, members, liveScores, currentGw, submittedUserIds, loading, mockData]);

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
        .flash-user-row {
          animation: flash 1.5s ease-in-out 3;
        }
      `}</style>
      {/* Compact Header */}
      <div className="px-4 py-3 bg-white dark:bg-slate-800 rounded-t-xl">
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
            <h3 className="text-base font-bold text-black dark:text-slate-100 truncate">
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
            <div className="text-xs text-slate-500 dark:text-slate-400">No gameweek available</div>
          </div>
        ) : (
          <>
            {/* Table */}
            {rows.length > 0 ? (
              <div className="overflow-visible flex-1 -mx-4">
                <div className="bg-white dark:bg-slate-800 px-4">
                  <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', backgroundColor: '#ffffff', width: '100%' }}>
                    <thead className="sticky top-0" style={{ 
                      position: 'sticky', 
                      top: 0, 
                      zIndex: 25, 
                      backgroundColor: '#ffffff', 
                      display: 'table-header-group'
                    } as any}>
                      <tr className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2 text-left font-semibold text-xs uppercase tracking-wide bg-white dark:bg-slate-800 w-6 pl-2 pr-1 text-[#1C8376]"></th>
                        <th className="py-2 text-left font-semibold text-xs text-slate-300 dark:text-slate-400 bg-white dark:bg-slate-800 pl-2 pr-2">
                          Player
                        </th>
                        <th className="py-2 text-center font-semibold text-xs text-slate-300 dark:text-slate-400 bg-white dark:bg-slate-800 w-10 pl-1 pr-1">
                          Score
                        </th>
                        {members.length >= 3 && <th className="py-2 text-center font-semibold text-xs bg-white dark:bg-slate-800 w-8 pl-1 pr-1 text-[#1C8376] text-base">🦄</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const isMe = r.user_id === currentUserId;
                        return (
                          <tr 
                            key={r.user_id} 
                            className={`bg-white dark:bg-slate-800 ${isMe ? 'flash-user-row' : ''}`}
                            style={{
                              position: 'relative',
                              backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
                              ...(i < rows.length - 1 ? { borderBottom: document.documentElement.classList.contains('dark') ? '1px solid #334155' : '1px solid #e2e8f0' } : {})
                            }}
                          >
                            <td className="py-2 text-left tabular-nums whitespace-nowrap bg-white dark:bg-slate-800 w-6 pl-2 pr-1 text-xs text-slate-900 dark:text-slate-100">
                              {i + 1}
                            </td>
                            <td className="py-2 truncate whitespace-nowrap bg-white dark:bg-slate-800 pl-2 pr-2 text-xs text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2">
                                <UserAvatar
                                  userId={r.user_id}
                                  name={r.name}
                                  size={20}
                                  className="border-0 flex-shrink-0"
                                  fallbackToInitials={true}
                                />
                                <span className="truncate">{r.name}</span>
                              </div>
                            </td>
                            <td className="py-2 text-center tabular-nums font-bold text-[#1C8376] text-xs bg-white dark:bg-slate-800 w-10 pl-1 pr-1">{r.score}</td>
                            {members.length >= 3 && <td className="py-2 text-center tabular-nums text-xs bg-white dark:bg-slate-800 w-8 pl-1 pr-1 text-slate-900 dark:text-slate-100">{r.unicorns}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 flex-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">
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
      className="w-[320px] flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden block no-underline relative"
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

