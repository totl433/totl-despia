// src/pages/Global.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { getCached, setCached, removeCached, getCacheTimestamp, CACHE_TTL } from "../lib/cache";
import { useLiveScores } from "../hooks/useLiveScores";
import { useGameweekState } from "../hooks/useGameweekState";
import { useCurrentGameweek } from "../hooks/useCurrentGameweek";
import { PageHeader } from "../components/PageHeader";
import { isDespiaAvailable } from "../lib/platform";
import SegmentedToggle from "../components/SegmentedToggle";
import UserPicksModal from "../components/UserPicksModal";
import FirstVisitInfoBanner from "../components/FirstVisitInfoBanner";
import UserAvatar from "../components/UserAvatar";
import { filterHiddenLeaderboardRows, isHiddenFromLeaderboards } from "../lib/leaderboardVisibility";
import { fetchAllGwPoints, type GwPointsRow } from "../lib/fetchAllGwPoints";
import { getActiveSeasonCtx } from "../lib/activeSeasonCtx";
import { getSeasonTables, withSeasonId } from "../lib/seasonStack";
import { useSeasonStack } from "../hooks/useSeasonStack";
import {
  getEffectiveCurrentMonthKey,
  getMonthAllocations,
  isMonthAvailable,
  resolveLeaderboardSeasonKey,
} from "../lib/leaderboardMonths";

type OverallRow = {
  user_id: string;
  name: string | null;
  ocp: number;
};

type MonthlyRow = {
  user_id: string;
  name: string;
  monthPoints: number;
  gwPoints: Array<number | null>;
  rank: number;
};

type LeaderboardTab = "overall" | "monthly" | "lastgw";

const NAME_LOOKUP_CHUNK = 100;

async function fetchProfileNamesById(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  for (let i = 0; i < unique.length; i += NAME_LOOKUP_CHUNK) {
    const chunk = unique.slice(i, i + NAME_LOOKUP_CHUNK);
    const { data, error } = await supabase.from("users").select("id, name").in("id", chunk);
    if (error) {
      console.error("[Global] Error fetching user names:", error);
      break;
    }
    for (const row of (data ?? []) as Array<{ id: string; name: string | null }>) {
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (row.id && name) names.set(row.id, name);
    }
  }
  return names;
}

function leaderboardName(
  userId: string,
  overallName: string | null | undefined,
  profileNames: Map<string, string>
): string {
  const fromOverall = typeof overallName === "string" ? overallName.trim() : "";
  if (fromOverall) return fromOverall;
  const fromProfile = profileNames.get(userId)?.trim() ?? "";
  if (fromProfile) return fromProfile;
  return "User";
}

export default function GlobalLeaderboardPage() {
  const { user } = useAuth();
  const seasonStack = useSeasonStack();
  const isNativeApp = isDespiaAvailable();
  const [searchParams, setSearchParams] = useSearchParams();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const userRowRef = useRef<HTMLTableRowElement>(null);
  
  const tabParam = searchParams.get("tab");
  const validTab: LeaderboardTab =
    tabParam === "overall" || tabParam === "monthly" || tabParam === "lastgw"
      ? tabParam
      : tabParam === "form5" || tabParam === "form10"
        ? "monthly"
        : "lastgw";

  // Load initial state from cache synchronously to avoid loading spinner
  const loadInitialStateFromCache = () => {
    if (seasonStack.loading) {
      return {
        loading: true,
        latestGw: null as number | null,
        gwPoints: [] as GwPointsRow[],
        overall: [] as OverallRow[],
        prevOcp: {} as Record<string, number>,
        hasCache: false,
        isCacheStale: false,
      };
    }
    try {
      const seasonKey = seasonStack.useSeasonStack
        ? (seasonStack.seasonId ?? "stack")
        : "legacy";
      const cacheKey = `global:leaderboard:v2:${seasonKey}`;
      const cached = getCached<{
        latestGw: number;
        gwPoints: GwPointsRow[];
        overall: OverallRow[];
        prevOcp: Record<string, number>;
      }>(cacheKey);
      
      if (cached && cached.gwPoints && Array.isArray(cached.gwPoints) && cached.gwPoints.length > 0) {
        // Check cache freshness synchronously
        const cacheTimestamp = getCacheTimestamp(cacheKey);
        const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
        const isCacheStale = cacheAge > CACHE_TTL.GLOBAL;
        
        // If cache is fresh or stale, use it immediately (stale will refresh in background)
        return {
          loading: false,
          latestGw: cached.latestGw,
          gwPoints: filterHiddenLeaderboardRows(cached.gwPoints),
          overall: filterHiddenLeaderboardRows(cached.overall || []),
          prevOcp: cached.prevOcp || {},
          hasCache: true,
          isCacheStale,
        };
      }
    } catch (error) {
      // Error loading from cache (non-critical)
    }
    
    return {
      loading: true,
      latestGw: null as number | null,
      gwPoints: [] as GwPointsRow[],
      overall: [] as OverallRow[],
      prevOcp: {} as Record<string, number>,
      hasCache: false,
      isCacheStale: false,
    };
  };
  
  const initialState = loadInitialStateFromCache();
  
  const [loading, setLoading] = useState(initialState.loading);
  const [hasCache, setHasCache] = useState(initialState.hasCache);
  const [err, setErr] = useState<string>("");
  const [latestGw, setLatestGw] = useState<number | null>(initialState.latestGw);
  const [overall, setOverall] = useState<OverallRow[]>(initialState.overall);
  const [gwPoints, setGwPoints] = useState<GwPointsRow[]>(initialState.gwPoints);
  const [prevOcp, setPrevOcp] = useState<Record<string, number>>(initialState.prevOcp);
  const activeTab = validTab;
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  // Track gw_results changes to trigger leaderboard recalculation
  const [gwResultsVersion, setGwResultsVersion] = useState(0);
  
  // Toggle for filtering: Mini League Friends vs All Players
  const [showMiniLeagueFriendsOnly, setShowMiniLeagueFriendsOnly] = useState(false);
  const [miniLeagueFriendIds, setMiniLeagueFriendIds] = useState<Set<string>>(new Set());
  
  // Get current GW from app_meta for LIVE functionality
  const [currentGwFromMeta, setCurrentGwFromMeta] = useState<number | null>(null);

  // Modal state for user picks
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [selectedUserRank, setSelectedUserRank] = useState<number | undefined>(undefined);
  
  // Use centralized hook for current gameweek (single source of truth)
  const { currentGw } = useCurrentGameweek();
  
  // Update currentGwFromMeta when hook value changes
  useEffect(() => {
    if (currentGw !== null) {
      setCurrentGwFromMeta(currentGw);
    }
  }, [currentGw]);

  // Use centralized gameweek state logic
  const { state: currentGwState } = useGameweekState(currentGwFromMeta ?? null);
  // Check if deadline has passed using centralized game state
  // SAFE: Only show picks if we're CERTAIN deadline has passed (state is not null)
  const currentGwDeadlinePassed = currentGwState !== null && 
    (currentGwState === 'DEADLINE_PASSED' || currentGwState === 'LIVE' || currentGwState === 'RESULTS_PRE_GW');
  const isCurrentGwLive = currentGwState === 'LIVE';

  // Fetch all mini league friends (users in leagues with the current user)
  useEffect(() => {
    if (!user?.id) {
      setMiniLeagueFriendIds(new Set());
      return;
    }

    let alive = true;
    (async () => {
      try {
        // Get all leagues the user is in
        const { data: userLeagues, error: leaguesError } = await supabase
          .from("league_members")
          .select("league_id")
          .eq("user_id", user.id);

        if (leaguesError || !userLeagues || userLeagues.length === 0) {
          if (alive) setMiniLeagueFriendIds(new Set());
          return;
        }

        const leagueIds = userLeagues.map((l: any) => l.league_id);

        // Get all members from those leagues
        const { data: allMembers, error: membersError } = await supabase
          .from("league_members")
          .select("user_id")
          .in("league_id", leagueIds);

        if (membersError || !allMembers) {
          if (alive) setMiniLeagueFriendIds(new Set());
          return;
        }

        // Create Set of all user IDs (including the current user)
        const friendIds = new Set<string>(allMembers.map((m: any) => m.user_id));
        if (alive) setMiniLeagueFriendIds(friendIds);
      } catch (error) {
        console.error("[Global] Error fetching mini league friends:", error);
        if (alive) setMiniLeagueFriendIds(new Set());
      }
    })();

    return () => { alive = false; };
  }, [user?.id]);
  
  // For LIVE functionality, use current_gw from meta if it's LIVE state
  // Use current GW if it's LIVE, otherwise use latest GW (for lastgw tab)
  const liveGw = isCurrentGwLive && currentGwFromMeta ? currentGwFromMeta : null;
  
  // Subscribe to live scores for the live GW (only used for lastgw tab)
  const { liveScores: liveScoresMap } = useLiveScores(
    liveGw || undefined,
    undefined // Fetch all live scores for the GW
  );
  
  // Fetch picks and calculate live scores for current GW
  const [liveCurrentGwPoints, setLiveCurrentGwPoints] = useState<GwPointsRow[]>([]);
  const [profileNames, setProfileNames] = useState<Map<string, string>>(new Map());
  
  useEffect(() => {
    if (!liveGw || !isCurrentGwLive || liveScoresMap.size === 0) {
      setLiveCurrentGwPoints([]);
      return;
    }
    
    let alive = true;
    
    (async () => {
      // Convert live scores to outcomes (Active Live: derive H/D/A from current scores during games)
      // This works for IN_PLAY, PAUSED, and FINISHED games
      const outcomes = new Map<number, "H" | "D" | "A">();
      liveScoresMap.forEach((liveScore) => {
        if (liveScore.gw === liveGw) {
          // Process games that have started (IN_PLAY, PAUSED, or FINISHED)
          // For Active Live, we derive the result from current scores even during games
          if (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED') {
            const fixtureIndex = liveScore.fixture_index;
            if (liveScore.home_score !== null && liveScore.away_score !== null) {
              let outcome: "H" | "D" | "A";
              if (liveScore.home_score > liveScore.away_score) {
                outcome = "H";
              } else if (liveScore.home_score < liveScore.away_score) {
                outcome = "A";
              } else {
                outcome = "D";
              }
              outcomes.set(fixtureIndex, outcome);
            }
          }
        }
      });
      
      if (outcomes.size === 0) {
        if (alive) setLiveCurrentGwPoints([]);
        return;
      }
      
      // Fetch all picks for current GW (season stack uses app_season_picks)
      const seasonCtx = getActiveSeasonCtx() ?? {
        useSeasonStack: seasonStack.useSeasonStack,
        seasonId: seasonStack.seasonId,
        seasonLabel: seasonStack.seasonLabel,
        currentGw: seasonStack.currentGw,
        viewingGw: seasonStack.viewingGw,
      };
      const tables = getSeasonTables(seasonCtx);
      let picksQ = (supabase as any)
        .from(tables.picks)
        .select("user_id, fixture_index, pick")
        .eq("gw", liveGw);
      picksQ = withSeasonId(picksQ, seasonCtx);
      const { data: allPicksRaw } = await picksQ;
      
      if (!alive || !allPicksRaw) return;

      type LivePickRow = { user_id: string; fixture_index: number; pick: string };
      const allPicks = allPicksRaw as LivePickRow[];
      
      // Calculate points per user
      // First, initialize all users who have picks (to ensure we include users with 0 points)
      const userPoints = new Map<string, number>();
      const uniqueUserIds = new Set(allPicks.map((p) => p.user_id));
      uniqueUserIds.forEach((uid) => {
        userPoints.set(uid, 0);
      });
      
      // Then calculate points for correct predictions
      allPicks.forEach((pick) => {
        const outcome = outcomes.get(pick.fixture_index);
        if (outcome && pick.pick === outcome) {
          const current = userPoints.get(pick.user_id) || 0;
          userPoints.set(pick.user_id, current + 1);
        }
      });
      
      // Convert to GwPointsRow format
      const visibleUserIds = Array.from(uniqueUserIds).filter(
        (userId) => !isHiddenFromLeaderboards(userId)
      );
      const livePoints: GwPointsRow[] = visibleUserIds.map((user_id) => ({
        user_id,
        gw: liveGw,
        points: userPoints.get(user_id) || 0,
      }));

      // Live GW includes pickers who are not on last season's Overall roster yet.
      // Look up users.name so we don't label them "User".
      const fetchedNames = await fetchProfileNamesById(visibleUserIds);
      
      if (alive) {
        setLiveCurrentGwPoints(livePoints);
        setProfileNames((prev) => {
          const next = new Map(prev);
          fetchedNames.forEach((name, id) => next.set(id, name));
          return next;
        });
      }
    })();
    
    return () => { alive = false; };
  }, [liveGw, isCurrentGwLive, liveScoresMap]);

  // Normalize legacy or missing tab params. The URL is the single source of truth,
  // avoiding a one-render race between local tab state and search params.
  useEffect(() => {
    if (tabParam === "form5" || tabParam === "form10") {
      setSearchParams({ tab: "monthly" }, { replace: true });
    } else if (!tabParam) {
      setSearchParams({ tab: "lastgw" }, { replace: true });
    }
  }, [tabParam, setSearchParams]);

  // Update URL when tab changes
  const handleTabChange = (tab: LeaderboardTab) => {
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (activeTab === "monthly") {
      setShowMiniLeagueFriendsOnly(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (seasonStack.loading) return;

    let alive = true;
    const seasonKey = seasonStack.useSeasonStack ? (seasonStack.seasonId ?? 'stack') : 'legacy';
    const cacheKey = `global:leaderboard:v2:${seasonKey}`;
    
    // Check cache freshness synchronously
    const cacheTimestamp = getCacheTimestamp(cacheKey);
    const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
    const isCacheStale = cacheAge > CACHE_TTL.GLOBAL;
    
    // If we have cache and it's fresh, skip fetch entirely (already loaded from initialState)
    if (hasCache && !isCacheStale) {
      return;
    }
    
    // If we have cache but it's stale, render immediately and refresh in background
    // Otherwise, fetch fresh data (cache miss)
    (async () => {
      try {
        // Only set loading state if we didn't load from cache
        if (!hasCache) {
          setLoading(true);
        }
        setErr("");

        // 1) latest GW from results (season-aware)
        const seasonCtx = getActiveSeasonCtx() ?? {
          useSeasonStack: seasonStack.useSeasonStack,
          seasonId: seasonStack.seasonId,
          seasonLabel: seasonStack.seasonLabel,
          currentGw: seasonStack.currentGw,
          viewingGw: seasonStack.viewingGw,
        };
        const tables = getSeasonTables(seasonCtx);
        let latestQ = (supabase as any)
          .from(tables.results)
          .select("gw")
          .order("gw", { ascending: false })
          .limit(1);
        latestQ = withSeasonId(latestQ, seasonCtx);
        const { data: latest, error: lErr } = await latestQ.maybeSingle();
        if (lErr) throw lErr;
        // No results yet → 0 so lastgw/form empty until first finished GW
        const gw = latest?.gw ?? 0;
        if (alive) setLatestGw(gw);

        // 2) all GW points — season views when on Pile B (empty until results + picks scored)
        const gp = await fetchAllGwPoints("asc", {
          seasonId: seasonCtx.useSeasonStack ? seasonCtx.seasonId : null,
        });

        // 3) overall OCP — season-scoped on Pile B
        let ocp: OverallRow[] | null = null;
        let oErr: Error | null = null;
        try {
          if (seasonCtx.useSeasonStack && seasonCtx.seasonId) {
            let ocpQ = (supabase as any)
              .from(tables.ocpOverall)
              .select("user_id, name, ocp")
              .eq("season_id", seasonCtx.seasonId);
            const res = await ocpQ;
            ocp = res.data as OverallRow[] | null;
            oErr = res.error;
            if (!oErr && (ocp?.length ?? 0) === 0) {
              const rosterRes = await supabase
                .from("app_v_ocp_overall")
                .select("user_id, name");
              oErr = rosterRes.error;
              ocp = ((rosterRes.data ?? []) as Array<{
                user_id: string;
                name: string | null;
              }>).map((row) => ({ ...row, ocp: 0 }));
            }
          } else {
            const res = await supabase.from("app_v_ocp_overall").select("user_id, name, ocp");
            ocp = res.data as OverallRow[] | null;
            oErr = res.error;
          }
        } catch (e: any) {
          oErr = e;
        }
        if (oErr) throw oErr;

        if (!alive) return;
        const gwPointsFiltered = filterHiddenLeaderboardRows(gp ?? []);
        const overallFiltered = filterHiddenLeaderboardRows((ocp as OverallRow[]) ?? []);
        setGwPoints(gwPointsFiltered);
        setOverall(overallFiltered);

        // 4) previous OCP totals (up to gw-1) to compute rank movement
        let prevOcpData: Record<string, number> = {};
        if (gw && gw > 1) {
          // Use the already fetched gwPoints data instead of making another query
          const prevList = gwPointsFiltered.filter(r => r.gw < gw);
          
          const totals: Record<string, number> = {};
          prevList.forEach((r) => {
            totals[r.user_id] = (totals[r.user_id] ?? 0) + (r.points ?? 0);
          });
          prevOcpData = totals;
          if (alive) setPrevOcp(totals);
        } else {
          if (alive) setPrevOcp({});
        }
        
        // Cache the processed data for next time
        try {
          setCached(cacheKey, {
            latestGw: gw,
            gwPoints: gwPointsFiltered,
            overall: overallFiltered,
            prevOcp: prevOcpData,
          }, CACHE_TTL.GLOBAL);
          setHasCache(true);
        } catch (cacheError) {
          // Failed to cache data (non-critical)
        }
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to load leaderboard.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [
    gwResultsVersion,
    hasCache,
    seasonStack.loading,
    seasonStack.useSeasonStack,
    seasonStack.seasonId,
  ]);

  /* ---------- Subscribe to results changes for real-time leaderboard updates ---------- */
  useEffect(() => {
    const seasonCtx = getActiveSeasonCtx() ?? {
      useSeasonStack: seasonStack.useSeasonStack,
      seasonId: seasonStack.seasonId,
      seasonLabel: seasonStack.seasonLabel,
      currentGw: seasonStack.currentGw,
      viewingGw: seasonStack.viewingGw,
    };
    const tables = getSeasonTables(seasonCtx);
    const channel = supabase
      .channel(`global-gw-results-changes-${tables.results}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tables.results,
        },
        () => {
          // Clear cache to force fresh fetch
          const seasonKey = seasonStack.useSeasonStack ? (seasonStack.seasonId ?? 'stack') : 'legacy';
          const cacheKey = `global:leaderboard:v2:${seasonKey}`;
          try {
            removeCached(cacheKey);
          } catch (e) {
            // Cache clear failed, non-critical
          }
          // Increment version to trigger recalculation
          setGwResultsVersion(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [seasonStack.useSeasonStack, seasonStack.seasonId]);

  function ranksFromScores(scores: Record<string, number>): Record<string, number> {
    const ids = Object.keys(scores);
    ids.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a.localeCompare(b));
    const out: Record<string, number> = {};
    ids.forEach((id, i) => (out[id] = i + 1));
    return out;
  }

  const currRanks = useMemo(() => {
    const scores: Record<string, number> = {};
    overall.forEach((o) => {
      scores[o.user_id] = (o.ocp ?? 0);
    });
    // include users who only have this GW points (first-week players)
    gwPoints.forEach((g) => {
      if (!(g.user_id in scores)) scores[g.user_id] = g.points ?? 0;
    });
    return ranksFromScores(scores);
  }, [overall, gwPoints]);

  const prevRanks = useMemo(() => ranksFromScores(prevOcp), [prevOcp]);

  // Helper function to filter rows by mini league friends
  const filterByMiniLeagueFriends = useMemo(() => {
    return <T extends { user_id: string }>(rows: T[]): T[] => {
      if (!showMiniLeagueFriendsOnly || miniLeagueFriendIds.size === 0) {
        return rows.filter((r) => !isHiddenFromLeaderboards(r.user_id));
      }
      return rows
        .filter(row => miniLeagueFriendIds.has(row.user_id))
        .filter((r) => !isHiddenFromLeaderboards(r.user_id));
    };
  }, [showMiniLeagueFriendsOnly, miniLeagueFriendIds]);

  const leaderboardSeasonKey = resolveLeaderboardSeasonKey({
    seasonLabel: seasonStack.seasonLabel,
    isNewSeasonFresh: seasonStack.isNewSeasonFresh,
    useSeasonStack: seasonStack.useSeasonStack,
  });
  const monthAnchorGw =
    seasonStack.currentGw || currentGwFromMeta || latestGw || null;
  const monthLiveState = useMemo(() => ({
    hasActiveLiveGames: isCurrentGwLive,
    isCurrentGwComplete: currentGwState === "RESULTS_PRE_GW",
    hasGwKickoffStarted:
      currentGwState === "DEADLINE_PASSED" ||
      currentGwState === "LIVE" ||
      currentGwState === "RESULTS_PRE_GW",
  }), [currentGwState, isCurrentGwLive]);
  const monthAvailabilityOptions = useMemo(
    () => ({ allowPreKickoffOpeningMonth: seasonStack.isNewSeasonFresh }),
    [seasonStack.isNewSeasonFresh]
  );
  const effectiveMonthKey = useMemo(
    () =>
      selectedMonthKey ??
      getEffectiveCurrentMonthKey(
        monthAnchorGw,
        monthLiveState,
        leaderboardSeasonKey,
        monthAvailabilityOptions
      ),
    [
      selectedMonthKey,
      monthAnchorGw,
      monthLiveState,
      leaderboardSeasonKey,
      monthAvailabilityOptions,
    ]
  );
  const selectedMonth = useMemo(
    () =>
      getMonthAllocations(leaderboardSeasonKey).find(
        (month) => month.monthKey === effectiveMonthKey
      ) ?? null,
    [effectiveMonthKey, leaderboardSeasonKey]
  );
  const selectableMonths = useMemo(
    () =>
      getMonthAllocations(leaderboardSeasonKey)
        .filter((month) =>
          isMonthAvailable(
            month,
            monthAnchorGw,
            monthLiveState,
            monthAvailabilityOptions
          )
        )
        .reverse(),
    [
      leaderboardSeasonKey,
      monthAnchorGw,
      monthLiveState,
      monthAvailabilityOptions,
    ]
  );

  useEffect(() => {
    if (
      selectedMonthKey &&
      !getMonthAllocations(leaderboardSeasonKey).some(
        (month) => month.monthKey === selectedMonthKey
      )
    ) {
      setSelectedMonthKey(null);
    }
  }, [leaderboardSeasonKey, selectedMonthKey]);

  const overallNameById = useMemo(
    () => new Map(overall.map((row) => [row.user_id, row.name])),
    [overall]
  );
  const nameFor = (userId: string) =>
    leaderboardName(userId, overallNameById.get(userId), profileNames);

  const monthlyRows = useMemo<MonthlyRow[]>(() => {
    if (!selectedMonth) return [];
    const gameweeks = Array.from(
      { length: selectedMonth.endGw - selectedMonth.startGw + 1 },
      (_, index) => selectedMonth.startGw + index
    );
    const users = new Map<
      string,
      { name: string; monthPoints: number; byGw: Map<number, number> }
    >();
    overall.forEach((row) => {
      users.set(row.user_id, {
        name: nameFor(row.user_id),
        monthPoints: 0,
        byGw: new Map(),
      });
    });

    const activeLiveGwInMonth =
      isCurrentGwLive &&
      liveGw !== null &&
      liveCurrentGwPoints.length > 0 &&
      liveGw >= selectedMonth.startGw &&
      liveGw <= selectedMonth.endGw;

    gwPoints.forEach((row) => {
      if (row.gw < selectedMonth.startGw || row.gw > selectedMonth.endGw) return;
      if (activeLiveGwInMonth && row.gw === liveGw) return;
      const entry = users.get(row.user_id) ?? {
        name: nameFor(row.user_id),
        monthPoints: 0,
        byGw: new Map<number, number>(),
      };
      entry.monthPoints += Number(row.points ?? 0);
      entry.byGw.set(row.gw, Number(row.points ?? 0));
      users.set(row.user_id, entry);
    });

    if (activeLiveGwInMonth && liveGw !== null) {
      liveCurrentGwPoints.forEach((row) => {
        const entry = users.get(row.user_id) ?? {
          name: nameFor(row.user_id),
          monthPoints: 0,
          byGw: new Map<number, number>(),
        };
        entry.monthPoints += Number(row.points ?? 0);
        entry.byGw.set(liveGw, Number(row.points ?? 0));
        users.set(row.user_id, entry);
      });
    }

    const playedThisMonth = new Set<string>();
    gwPoints.forEach((row) => {
      if (row.gw < selectedMonth.startGw || row.gw > selectedMonth.endGw) return;
      playedThisMonth.add(row.user_id);
    });
    if (activeLiveGwInMonth) {
      liveCurrentGwPoints.forEach((row) => playedThisMonth.add(row.user_id));
    }

    const sorted = Array.from(users.entries())
      .filter(([userId, entry]) => entry.monthPoints > 0 || playedThisMonth.has(userId))
      .map(([user_id, entry]) => ({
        user_id,
        name: entry.name,
        monthPoints: entry.monthPoints,
        gwPoints: gameweeks.map((gw) => entry.byGw.get(gw) ?? null),
      }))
      .sort(
        (a, b) =>
          b.monthPoints - a.monthPoints || a.name.localeCompare(b.name)
      );

    let rank = 1;
    return sorted.map((row, index) => {
      if (
        index > 0 &&
        sorted[index - 1].monthPoints !== row.monthPoints
      ) {
        rank = index + 1;
      }
      return { ...row, rank };
    });
  }, [
    gwPoints,
    isCurrentGwLive,
    liveCurrentGwPoints,
    liveGw,
    overall,
    selectedMonth,
    profileNames,
    overallNameById,
  ]);

  const monthlyWinnerIds = useMemo(() => {
    if (!selectedMonth || monthAnchorGw == null || monthlyRows.length === 0) {
      return new Set<string>();
    }
    const monthComplete =
      monthAnchorGw > selectedMonth.endGw ||
      (monthAnchorGw === selectedMonth.endGw &&
        currentGwState === "RESULTS_PRE_GW");
    const topPoints = monthlyRows[0]?.monthPoints ?? 0;
    if (!monthComplete || topPoints <= 0) return new Set<string>();
    return new Set(
      monthlyRows
        .filter((row) => row.monthPoints === topPoints)
        .map((row) => row.user_id)
    );
  }, [currentGwState, monthAnchorGw, monthlyRows, selectedMonth]);

  const monthProgress = useMemo(() => {
    if (!selectedMonth || monthAnchorGw == null) return null;
    const total = selectedMonth.endGw - selectedMonth.startGw + 1;
    let completed = 0;
    let currentFraction = 0;
    if (monthAnchorGw > selectedMonth.endGw) {
      completed = total;
    } else if (monthAnchorGw >= selectedMonth.startGw) {
      completed = monthAnchorGw - selectedMonth.startGw;
      if (currentGwState === "RESULTS_PRE_GW") {
        completed += 1;
      } else if (currentGwState === "LIVE" && liveScoresMap.size > 0) {
        const scores = Array.from(liveScoresMap.values()).filter(
          (score) => score.gw === monthAnchorGw
        );
        const finished = scores.filter(
          (score) => score.status === "FINISHED"
        ).length;
        currentFraction = scores.length > 0 ? finished / scores.length : 0;
      }
    }
    return {
      total,
      completed: Math.min(completed, total),
      currentFraction,
    };
  }, [
    currentGwState,
    liveScoresMap,
    monthAnchorGw,
    selectedMonth,
  ]);
  
  // Last GW leaderboard - only players who completed the last gameweek
  // Use live scores if current GW is live (single source of truth)
  const showOpeningGwAtZero =
    seasonStack.isNewSeasonFresh && latestGw === 0 && currentGwFromMeta !== null;
  const displayedGw =
    isCurrentGwLive && currentGwFromMeta
      ? currentGwFromMeta
      : showOpeningGwAtZero
        ? currentGwFromMeta
        : latestGw;
  const lastGwRowsUnfiltered = useMemo(() => {
    if (!displayedGw) return [];
    
    // Use live scores if current GW is live, otherwise use database view for latestGw
    // When current GW is live, show current GW with live scores (not latestGw from app_gw_results)
    const lastGwPoints = (isCurrentGwLive && liveCurrentGwPoints.length > 0 && liveGw)
      ? liveCurrentGwPoints
      : gwPoints.filter(gp => gp.gw === displayedGw);
    
    const sorted = (
      showOpeningGwAtZero && lastGwPoints.length === 0
        ? overall.map((row) => ({
            user_id: row.user_id,
            name: nameFor(row.user_id),
            points: 0,
          }))
        : lastGwPoints.map((gp) => ({
            user_id: gp.user_id,
            name: nameFor(gp.user_id),
            points: gp.points,
          }))
    )
      .sort((a, b) => (b.points - a.points) || a.name.localeCompare(b.name));
    
    // Add joint ranking
    let currentRank = 1;
    return sorted.map((player, index) => {
      if (index > 0 && sorted[index - 1].points !== player.points) {
        currentRank = index + 1;
      }
      return {
        ...player,
        rank: currentRank,
      };
    });
  }, [
    displayedGw,
    gwPoints,
    isCurrentGwLive,
    liveCurrentGwPoints,
    liveGw,
    overall,
    profileNames,
    overallNameById,
    showOpeningGwAtZero,
  ]);
  
  const lastGwRows = useMemo(() => filterByMiniLeagueFriends(lastGwRowsUnfiltered), [lastGwRowsUnfiltered, filterByMiniLeagueFriends]);

  const rows = useMemo(() => {
    // Get current GW points only for the Overall tab
    // Use live scores if current GW is live, otherwise use database views
    const currentGwPoints = (isCurrentGwLive && liveCurrentGwPoints.length > 0 && liveGw)
      ? liveCurrentGwPoints
      : gwPoints.filter(gp => gp.gw === latestGw);
    const byUserThisGw = new Map<string, number>();
    currentGwPoints.forEach((r) => byUserThisGw.set(r.user_id, r.points));

    // Optimize: use Set to track which users are already in merged
    const mergedUserIds = new Set<string>();
    
    // Calculate OCP using single source of truth: app_v_gw_points
    // If live: OCP = sum of all GW points up to (liveGw - 1) + live GW points
    // Otherwise: use OCP from app_v_ocp_overall view (single source of truth)
    let ocpByUser: Map<string, number>;
    if (isCurrentGwLive && liveGw) {
      // Calculate OCP from app_v_gw_points (single source of truth) up to previous GW
      const prevGwPoints = gwPoints.filter(gp => gp.gw < liveGw);
      ocpByUser = new Map<string, number>();
      prevGwPoints.forEach((r) => {
        ocpByUser.set(r.user_id, (ocpByUser.get(r.user_id) || 0) + (r.points || 0));
      });
      // Add live GW points
      currentGwPoints.forEach((r) => {
        ocpByUser.set(r.user_id, (ocpByUser.get(r.user_id) || 0) + (r.points || 0));
      });
    } else {
      // Use OCP from app_v_ocp_overall view (single source of truth)
      ocpByUser = new Map<string, number>();
      overall.forEach((o) => {
        ocpByUser.set(o.user_id, o.ocp || 0);
      });
    }
    
    const merged = overall.map((o) => {
      mergedUserIds.add(o.user_id);
      const liveGwPoints = byUserThisGw.get(o.user_id) ?? 0;
      const totalOcp = ocpByUser.get(o.user_id) || 0;
      return {
        user_id: o.user_id,
        name: nameFor(o.user_id),
        this_gw: liveGwPoints,
        ocp: totalOcp,
      };
    });

    // include users that have this GW points but not yet in overall
    currentGwPoints.forEach((g) => {
      if (!mergedUserIds.has(g.user_id)) {
        mergedUserIds.add(g.user_id);
        const totalOcp = ocpByUser.get(g.user_id) || g.points;
        merged.push({
          user_id: g.user_id,
          name: nameFor(g.user_id),
          this_gw: g.points,
          ocp: totalOcp,
        });
      }
    });

    // sort by OCP desc, then name
    merged.sort((a, b) => (b.ocp - a.ocp) || a.name.localeCompare(b.name));

    // Add joint ranking
    let currentRank = 1;
    return merged.map((player, index) => {
      if (index > 0 && merged[index - 1].ocp !== player.ocp) {
        currentRank = index + 1;
      }
      return {
        ...player,
        rank: currentRank,
      };
    });
  }, [overall, gwPoints, latestGw, isCurrentGwLive, liveCurrentGwPoints, liveGw, profileNames, overallNameById]);
  
  // Filter rows for Overall tab
  const rowsFiltered = useMemo(() => filterByMiniLeagueFriends(rows), [rows, filterByMiniLeagueFriends]);

  // Determine which gameweek to show in the modal based on active tab
  // After deadline has passed, show current GW picks (not latest GW)
  const modalGw = useMemo(() => {
    if (activeTab === "lastgw" || activeTab === "overall") {
      // If current GW exists and deadline has passed, use current GW
      // Otherwise, use liveGw (if LIVE) or latestGw
      if (currentGwFromMeta && currentGwDeadlinePassed) {
        return currentGwFromMeta;
      }
      return liveGw || latestGw || null;
    }
    // For form tabs, show the latest gameweek
    return latestGw || null;
  }, [activeTab, liveGw, latestGw, currentGwFromMeta, currentGwDeadlinePassed]);

  // Handle user click to open modal
  const handleUserClick = (userId: string, userName: string | null) => {
    // Get rank from non-live global ranking (overall array from app_v_ocp_overall)
    // Sort overall by OCP to calculate rank (same logic as rows calculation)
    const sortedOverall = [...overall].sort((a, b) => (b.ocp - a.ocp) || (a.name ?? '').localeCompare(b.name ?? ''));
    
    // Find user's position and calculate rank (handling ties)
    let userRank: number | undefined;
    let currentRank = 1;
    for (let i = 0; i < sortedOverall.length; i++) {
      if (i > 0 && sortedOverall[i - 1].ocp !== sortedOverall[i].ocp) {
        currentRank = i + 1;
      }
      if (sortedOverall[i].user_id === userId) {
        userRank = currentRank;
        break;
      }
    }
    
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setSelectedUserRank(userRank);
  };

  // Close modal
  const handleCloseModal = () => {
    setSelectedUserId(null);
    setSelectedUserName(null);
    setSelectedUserRank(undefined);
  };

  // Prevent body scrolling - lock the page
  useEffect(() => {
    // Lock body scroll when component mounts
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      // Restore body scroll when component unmounts
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Scroll to top when tab changes to ensure header is visible (no animation)
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.style.scrollBehavior = 'auto';
      tableContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Prevent scrolling past the header row
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    // Simple scroll correction - use passive for better performance
    const handleScroll = () => {
      if (container.scrollTop < 0) {
        container.scrollTop = 0;
      }
    };

    // Prevent wheel scrolling past top
    const handleWheel = (e: WheelEvent) => {
      if (container.scrollTop <= 0 && e.deltaY < 0) {
        e.preventDefault();
        container.scrollTop = 0;
      }
    };

    // Attach event listeners - minimal intervention
    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Scroll to user's row when data loads (if not in top 10)
  useEffect(() => {
    if (!loading && user?.id && tableContainerRef.current && userRowRef.current) {
      // Find user's rank in the current tab's data
      const currentRows =
        activeTab === "overall"
          ? rowsFiltered
          : activeTab === "monthly"
            ? monthlyRows
            : lastGwRows;
      const userIndex = currentRows.findIndex(r => r.user_id === user.id);
      const userRank = userIndex >= 0 ? (currentRows[userIndex] as any).rank || userIndex + 1 : null;
      
      // If user is in top 10, start at top (do nothing)
      if (userRank !== null && userRank <= 10) {
        return;
      }
      
      // Otherwise, scroll to center user's row
      requestAnimationFrame(() => {
        const container = tableContainerRef.current;
        const row = userRowRef.current;
        if (container && row) {
          container.style.scrollBehavior = 'auto';
          const rowTop = row.offsetTop;
          const containerHeight = container.clientHeight;
          const rowHeight = row.offsetHeight;
          container.scrollTop = rowTop - (containerHeight / 2) + (rowHeight / 2);
        }
      });
    }
  }, [loading, user?.id, activeTab, rowsFiltered, monthlyRows, lastGwRows]);

  return (
    <div
      className="fixed inset-0 bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col"
      style={isNativeApp ? { paddingTop: "var(--safe-area-top)" } : undefined}
    >
      <style>{`
        @keyframes sparkle {
          0%, 100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
          25% {
            opacity: 0.8;
            transform: scale(1.1) rotate(-5deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.15) rotate(5deg);
          }
          75% {
            opacity: 0.9;
            transform: scale(1.05) rotate(-3deg);
          }
        }
        .sparkle-trophy {
          animation: sparkle 2s ease-in-out infinite;
          filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6));
        }
        .sparkle-trophy svg {
          filter: drop-shadow(0 0 2px rgba(251, 191, 36, 0.8));
        }
        .full-width-header-border::after {
          content: '';
          position: absolute;
          left: -1rem;
          right: -1rem;
          bottom: 0;
          height: 1px;
          background-color: #cbd5e1;
          z-index: 1;
        }
        .dark .full-width-header-border::after {
          background-color: #475569;
        }
      `}</style>
      <div className="max-w-6xl lg:max-w-[1024px] mx-auto px-4 lg:px-6 pb-0 flex-1 flex flex-col overflow-hidden">
        {/* Fixed Header Section */}
        <div className="flex-shrink-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          {/* Title Row */}
          <div className="py-4">
            <div className="flex items-center gap-3">
              <PageHeader title="Leaderboard" as="h2" />
              {activeTab === "lastgw" && isCurrentGwLive && currentGwFromMeta && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  LIVE GW{currentGwFromMeta}
                </span>
              )}
              {activeTab === "overall" && isCurrentGwLive && currentGwFromMeta && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  LIVE GW{currentGwFromMeta}
                </span>
              )}
            </div>
          </div>

          {/* First Visit Info Banner */}
          <div className="px-4 pb-4">
            <FirstVisitInfoBanner
              storageKey="leaderboardFirstVisit"
              message="After the deadline, you can tap a player to view their predictions."
            />
          </div>

          {/* Tabs */}
          <div className="flex justify-center pb-4 lg:pt-4">
            <div className="flex rounded-full bg-slate-100 dark:bg-slate-800 p-1.5 border border-slate-200 dark:border-slate-700 shadow-sm w-full max-w-md">
              <button
                onClick={() => handleTabChange("lastgw")}
                className={`flex-1 py-2.5 rounded-full text-base font-semibold transition-all ${
                  activeTab === "lastgw"
                    ? "bg-[#1C8376] text-white shadow-md"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {displayedGw ? `GW${displayedGw}` : "GW"}
              </button>
              <button
                onClick={() => handleTabChange("monthly")}
                className={`flex-1 py-2.5 rounded-full text-base font-semibold transition-all ${
                  activeTab === "monthly"
                    ? "bg-[#1C8376] text-white shadow-md"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {selectedMonth?.label.split(" ")[0] ?? "Month"}
              </button>
              <button
                onClick={() => handleTabChange("overall")}
                className={`flex-1 py-2.5 rounded-full text-base font-semibold transition-all ${
                  activeTab === "overall"
                    ? "bg-[#1C8376] text-white shadow-md"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Overall
              </button>
            </div>
          </div>

          {/* Toggle for Mini League Friends */}
          {activeTab !== "monthly" && (
            <div className="flex justify-center pb-4">
              <SegmentedToggle
                value={showMiniLeagueFriendsOnly}
                onToggle={setShowMiniLeagueFriendsOnly}
                labels={{ left: "All Players", right: "Mini League Friends" }}
              />
            </div>
          )}

          {/* Tab Subtitles */}
          {activeTab === "overall" && (
            <div className="text-center pb-3">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                All Players since the start of the season
              </div>
            </div>
          )}
          
          {activeTab === "monthly" && selectedMonth && (
            <div className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-black text-slate-900 dark:text-white">
                    Player of the Month
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    GW{selectedMonth.startGw}–{selectedMonth.endGw}
                  </div>
                </div>
                <label className="relative flex-shrink-0">
                  <span className="sr-only">Select month</span>
                  <select
                    value={selectedMonth.monthKey}
                    onChange={(event) => setSelectedMonthKey(event.target.value)}
                    className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-[#1C8376] focus:ring-2 focus:ring-[#1C8376]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {selectableMonths.map((month) => (
                      <option key={month.monthKey} value={month.monthKey}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <svg
                    aria-hidden
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </label>
              </div>
              {monthProgress && monthProgress.completed < monthProgress.total && (
                <div
                  className="relative mt-3 flex h-6 overflow-hidden rounded bg-slate-200 dark:bg-slate-700"
                  aria-label={`${monthProgress.completed} of ${monthProgress.total} gameweeks completed`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#2D9D8B] via-[#1C8376] to-[#157A6E] transition-[width] duration-700"
                    style={{
                      width: `${
                        ((monthProgress.completed + monthProgress.currentFraction) /
                          monthProgress.total) *
                        100
                      }%`,
                    }}
                  />
                  {Array.from(
                    { length: monthProgress.total },
                    (_, index) => selectedMonth.startGw + index
                  ).map((gw, index) => {
                    const hasFill =
                      index < monthProgress.completed ||
                      (index === monthProgress.completed &&
                        monthProgress.currentFraction > 0);
                    return (
                    <div
                      key={gw}
                      className={`relative z-10 flex flex-1 items-center justify-center text-[10px] font-bold ${
                        hasFill
                          ? "text-white"
                          : "text-slate-500 dark:text-slate-300"
                      }`}
                    >
                      GW{gw}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          
          {activeTab === "lastgw" && (
            <div className="text-center pb-3">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {showOpeningGwAtZero
                  ? `GW${displayedGw} starts at zero for all players`
                  : `All players who submitted for GW${displayedGw}`}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {err && (
            <div className="mb-6 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-400 flex-shrink-0">
            {err}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
          </div>
        ) : (activeTab === "overall" ? rowsFiltered : activeTab === "monthly" ? monthlyRows : lastGwRows).length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-slate-600 dark:text-slate-400">
            {activeTab === "monthly"
              ? "No monthly leaderboard data yet."
              : "No leaderboard data yet."}
          </div>
        ) : (
          <div 
            ref={tableContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden -mx-4 sm:mx-0 rounded-none sm:rounded-2xl border-x-0 sm:border-x border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-sm"
            style={{ 
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'auto',
              minHeight: 0,
              paddingBottom: '100px',
              paddingLeft: '1rem',
              paddingRight: '1rem',
              backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc',
              touchAction: 'pan-y'
            }}
          >
            <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>
              <thead className="sticky top-0 z-[25] full-width-header-border bg-slate-50 dark:bg-slate-800" style={{ 
                display: 'table-header-group'
              } as any}>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 text-left font-normal bg-slate-50 dark:bg-slate-800" style={{ width: '35px', paddingLeft: '0.5rem', paddingRight: '0.25rem', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#64748b' }}>#</th>
                  <th className="px-4 py-3 text-left font-normal text-xs bg-slate-50 dark:bg-slate-800" style={{ color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#64748b', width: 'auto' }}>Player</th>
                  {activeTab === "overall" && (
                    <>
                      <th className="px-4 py-3 text-center font-semibold bg-slate-50 dark:bg-slate-800" style={{ width: '40px', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}></th>
                      <th className="px-1 py-3 text-center font-normal bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400" style={{ width: '55px', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                        <div className="flex items-center justify-center gap-1">
                          GW{displayedGw || '?'}
                          {isCurrentGwLive && currentGwFromMeta && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="py-3 text-center font-normal bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400" style={{ width: '60px', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                        <div className="flex items-center justify-center gap-1">
                          OCP
                          {isCurrentGwLive && currentGwFromMeta && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                            </span>
                          )}
                        </div>
                      </th>
                    </>
                  )}
                  {activeTab === "monthly" && selectedMonth && (
                    <>
                      {Array.from(
                        { length: selectedMonth.endGw - selectedMonth.startGw + 1 },
                        (_, index) => selectedMonth.startGw + index
                      ).map((gw) => (
                        <th
                          key={gw}
                          className="py-3 text-center text-[11px] font-normal bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          style={{ width: '32px' }}
                        >
                          <span className="inline-flex items-center gap-1">
                            {isCurrentGwLive && liveGw === gw && (
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            )}
                            {gw}
                          </span>
                        </th>
                      ))}
                      <th className="py-3 text-center font-normal bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400" style={{ width: '55px' }}>PTS</th>
                    </>
                  )}
                  {activeTab === "lastgw" && (
                    <>
                      <th className="px-4 py-3 text-center font-semibold bg-slate-50 dark:bg-slate-800" style={{ width: '40px', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}></th>
                      <th className="py-3 text-center font-normal bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400" style={{ width: '60px', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                        <div className="flex items-center justify-center gap-1">
                          GW{displayedGw || '?'}
                          {isCurrentGwLive && currentGwFromMeta && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                            </span>
                          )}
                        </div>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {(activeTab === "overall" ? rowsFiltered : activeTab === "monthly" ? monthlyRows : lastGwRows).map((r, i, arr) => {
                  const isMe = r.user_id === user?.id;
                  
                  // Check if this rank has multiple players
                  const currentRank = 'rank' in r ? r.rank : i + 1;
                  const rankCount = arr.filter((item, index) => {
                    const itemRank = 'rank' in item ? item.rank : index + 1;
                    return itemRank === currentRank;
                  }).length;
                  const isTied = rankCount > 1;
                  const rowScore =
                    'ocp' in r
                      ? r.ocp
                      : 'monthPoints' in r
                        ? r.monthPoints
                        : 'points' in r
                          ? r.points
                          : 0;
                  const isMonthlyWinner =
                    activeTab === "monthly" && monthlyWinnerIds.has(r.user_id);
                  const isTopRank =
                    currentRank === 1 &&
                    rowScore > 0 &&
                    (activeTab !== "monthly" || isMonthlyWinner);
                  
                  // Special styling for top-ranked players

                  let indicator = "";
                  let indicatorClass = "bg-gray-300"; // default (no change)
                  
                  // Only show rank movement indicators for overall tab
                  if (activeTab === "overall") {
                    const prev = prevRanks[r.user_id];
                    const curr = currRanks[r.user_id];
                    
                    if (curr && prev) {
                      if (curr < prev) {
                        indicator = "▲"; // moved up
                        indicatorClass = "bg-emerald-500 text-white";
                      } else if (curr > prev) {
                        indicator = "▼"; // moved down
                        indicatorClass = "bg-red-500 text-white";
                      } else {
                        indicator = "→"; // same position - right arrow
                        indicatorClass = "bg-gray-500 text-white";
                      }
                    } else if (curr && !prev) {
                        // They have played current GW but no previous rank (first week)
                        indicator = ""; // no change - empty circle
                        indicatorClass = "bg-gray-400";
                    }
                  }

                  // Highlight entire row for current user - make it very obvious
                  const isDark = document.documentElement.classList.contains('dark');
                  const rowBgColor = isMonthlyWinner
                    ? 'transparent'
                    : isMe
                    ? (isDark ? '#065f46' : '#a7f3d0')
                    : (isDark ? '#0f172a' : '#f8fafc');
                  
                  return (
                    <tr 
                      key={r.user_id}
                      ref={isMe ? userRowRef : null}
                      onClick={() => handleUserClick(r.user_id, r.name)}
                      className={`cursor-pointer ${isMe && !isMonthlyWinner ? 'border-l-4 border-emerald-600 shadow-sm' : ''}`}
                      style={{
                        ...(i > 0 ? { 
                          borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                          position: 'relative',
                          backgroundColor: rowBgColor,
                          backgroundImage: isMonthlyWinner
                            ? 'linear-gradient(135deg, #facc15, #f97316, #ec4899, #9333ea)'
                            : undefined,
                        } : {
                          position: 'relative',
                          backgroundColor: rowBgColor,
                          backgroundImage: isMonthlyWinner
                            ? 'linear-gradient(135deg, #facc15, #f97316, #ec4899, #9333ea)'
                            : undefined,
                        })
                      }}
                    >
                      {/* Rank number only */}
                      <td className={`py-3 text-left tabular-nums whitespace-nowrap relative ${isMonthlyWinner ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`} style={{
                        width: '35px',
                        paddingLeft: '0.5rem', 
                        paddingRight: '0.25rem',
                        backgroundColor: rowBgColor
                      }}>
                          <span>{currentRank}{isTied ? '=' : ''}</span>
                      </td>

                      {/* Player name with color-coded indicator */}
                      <td className="pl-0 pr-4 py-3" style={{ backgroundColor: rowBgColor }}>
                        <div className="flex items-center gap-1.5">
                          {(indicator || indicatorClass) && activeTab === "overall" && (
                            <span
                              className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold ${indicatorClass} align-middle flex-shrink-0`}
                              aria-hidden
                            >
                              {indicator}
                            </span>
                          )}
                          <div className="flex-shrink-0">
                            <UserAvatar
                              userId={r.user_id}
                              name={r.name}
                              size={24}
                              className="border border-slate-200 dark:border-slate-700"
                              fallbackToInitials={true}
                            />
                          </div>
                          {isTopRank && (
                            <span className="inline-flex items-center sparkle-trophy flex-shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className={`w-4 h-4 ${isMonthlyWinner ? 'text-white' : 'text-yellow-500'}`}>
                                <g>
                                  <path fill="currentColor" d="M16 3c1.1046 0 2 0.89543 2 2h2c1.1046 0 2 0.89543 2 2v1c0 2.695 -2.1323 4.89 -4.8018 4.9941 -0.8777 1.5207 -2.4019 2.6195 -4.1982 2.9209V19h3c0.5523 0 1 0.4477 1 1s-0.4477 1 -1 1H8c-0.55228 0 -1 -0.4477 -1 -1s0.44772 -1 1 -1h3v-3.085c-1.7965 -0.3015 -3.32148 -1.4 -4.19922 -2.9209C4.13175 12.8895 2 10.6947 2 8V7c0 -1.10457 0.89543 -2 2 -2h2c0 -1.10457 0.89543 -2 2 -2zm-8 7c0 2.2091 1.79086 4 4 4 2.2091 0 4 -1.7909 4 -4V5H8zM4 8c0 1.32848 0.86419 2.4532 2.06055 2.8477C6.02137 10.5707 6 10.2878 6 10V7H4zm14 2c0 0.2878 -0.0223 0.5706 -0.0615 0.8477C19.1353 10.4535 20 9.32881 20 8V7h-2z" strokeWidth="1"></path>
                                </g>
                              </svg>
                            </span>
                          )}
                          <span className={`text-xs truncate min-w-0 whitespace-nowrap ${isMonthlyWinner ? 'font-bold text-white' : isMe ? 'font-bold text-emerald-900 dark:text-emerald-300' : 'font-normal text-slate-900 dark:text-slate-100'}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.name}
                          </span>
                        </div>
                      </td>

                      {/* Overall tab columns */}
                      {activeTab === "overall" && (
                        <>
                          <td className="px-4 py-3 text-center tabular-nums font-bold text-slate-900 dark:text-slate-100" style={{ width: '40px', paddingLeft: '0.5rem', paddingRight: '0.5rem', backgroundColor: rowBgColor }}></td>
                          <td className="px-1 py-3 text-center tabular-nums font-bold text-slate-900 dark:text-slate-100" style={{ width: '55px', paddingLeft: '0.5rem', paddingRight: '0.5rem', backgroundColor: rowBgColor }}>
                            {'this_gw' in r ? r.this_gw : 0}
                          </td>
                          <td className="py-3 text-center tabular-nums font-bold text-slate-900 dark:text-slate-100" style={{ 
                            width: '60px',
                            paddingLeft: '0.5rem', 
                            paddingRight: '0.5rem',
                            backgroundColor: rowBgColor
                          }}>
                            {'ocp' in r ? r.ocp : 0}
                          </td>
                        </>
                      )}

                      {/* Monthly gameweek breakdown and total */}
                      {activeTab === "monthly" && (
                        <>
                          {'gwPoints' in r && r.gwPoints.map((points, index) => (
                            <td
                              key={`${r.user_id}-${index}`}
                              className={`py-3 text-center text-xs tabular-nums font-semibold ${
                                isMonthlyWinner
                                  ? 'text-white'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                              style={{ width: '32px', backgroundColor: rowBgColor }}
                            >
                              {points ?? '—'}
                            </td>
                          ))}
                          <td className={`py-3 text-center tabular-nums font-bold ${isMonthlyWinner ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`} style={{
                            width: '55px',
                            backgroundColor: rowBgColor
                          }}>
                            {'monthPoints' in r ? r.monthPoints : 0}
                          </td>
                        </>
                      )}
                      
                      {/* Last GW tab columns */}
                      {activeTab === "lastgw" && (
                        <>
                          <td className="px-4 py-3 text-center tabular-nums font-bold text-slate-900 dark:text-slate-100" style={{ width: '40px', paddingLeft: '0.5rem', paddingRight: '0.5rem', backgroundColor: rowBgColor }}></td>
                          <td className="py-3 text-center tabular-nums font-bold text-slate-900 dark:text-slate-100" style={{ 
                            width: '60px',
                            paddingLeft: '0.5rem', 
                            paddingRight: '0.5rem',
                            backgroundColor: rowBgColor
                          }}>
                            {'points' in r ? r.points : 0}
                        </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
        
      </div>

      {/* User Picks Modal */}
      {selectedUserId && modalGw && (
        <UserPicksModal
          isOpen={!!selectedUserId}
          onClose={handleCloseModal}
          userId={selectedUserId}
          userName={selectedUserName}
          gw={modalGw}
          globalRank={selectedUserRank}
          fallbackGw={latestGw}
        />
      )}
    </div>
  );
}