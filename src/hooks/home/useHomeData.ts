import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { getDeterministicLeagueAvatar } from '../../lib/leagueAvatars';
import { League, Fixture, PickRow, ResultRow } from '../../types/home';
import { rowToOutcome } from '../../lib/homeHelpers';

type LeagueSubmissionStatus = { allSubmitted: boolean; submittedCount: number; totalCount: number };

export function useHomeData(userId: string | undefined) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, LeagueSubmissionStatus>>({});
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [gw, setGw] = useState<number>(1);
  const [gwSubmitted, setGwSubmitted] = useState<boolean>(false);
  const [gwScore, setGwScore] = useState<number | null>(null);
  const [picksMap, setPicksMap] = useState<Record<number, "H" | "D" | "A">>({});
  const [resultsMap, setResultsMap] = useState<Record<number, "H" | "D" | "A">>({});
  const [loading, setLoading] = useState(true);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastScoreGw, setLastScoreGw] = useState<number | null>(null);
  const [unreadByLeague, setUnreadByLeague] = useState<Record<string, number>>({});
  const [isInApiTestLeague, setIsInApiTestLeague] = useState(false);
  const [nextGwComing, setNextGwComing] = useState<number | null>(null);

  const leagueIdsRef = useRef<Set<string>>(new Set());

  const fetchHomeData = useCallback(async (showLoading = true) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let alive = true;
    
    if (showLoading) {
      setLoading(true);
    }

    try {
      // PARALLEL QUERY 1: Fetch current GW and user's leagues simultaneously
      console.log('[Home] Starting data fetch for user:', userId);
      
      const [currentGwResult, userLeaguesResult] = await Promise.all([
        supabase.from("meta").select("current_gw").eq("id", 1).maybeSingle(),
        supabase.from("league_members").select("leagues(id,name,code,created_at)").eq("user_id", userId),
      ]);
      
      const currentGw = (currentGwResult.data as any)?.current_gw ?? 1;

      const userLeagues = ((userLeaguesResult.data ?? []) as any[])
        .map((r) => r.leagues)
        .filter(Boolean) as League[];
      
      // Assign avatars to leagues
      const ls: League[] = userLeagues.map((league) => ({
        ...league,
        avatar: getDeterministicLeagueAvatar(league.id),
      }));
      
      // Check if user is in API Test league
      const isTestLeague = userLeagues.some((league) => league.name === "API Test");
      
      if (alive) {
        setLeagues(ls);
        setGw(currentGw);
        setIsInApiTestLeague(isTestLeague);
        leagueIdsRef.current = new Set(ls.map((l) => l.id));
      }

      // PARALLEL QUERY 2: Fetch fixtures, picks, results, and submission status for current GW
      let fixturesResult, picksResult, resultsResult, submissionResult;
      let thisGwFixtures: Fixture[];
      let userPicks: PickRow[];
      let gwResults: ResultRow[];
      let submitted: boolean;
      
      if (isTestLeague) {
        // Fetch from test API tables
        [fixturesResult, picksResult, resultsResult, submissionResult] = await Promise.all([
          supabase.from("test_api_fixtures").select("id,test_gw,fixture_index,api_match_id,home_code,away_code,home_team,away_team,home_name,away_name,kickoff_time").eq("test_gw", 1).order("fixture_index", { ascending: true }),
          supabase.from("test_api_picks").select("user_id,matchday,fixture_index,pick").eq("user_id", userId).eq("matchday", 1),
          supabase.from("gw_results").select("gw,fixture_index,result").eq("gw", 1),
          supabase.from("test_api_submissions").select("submitted_at").eq("user_id", userId).eq("matchday", 1).maybeSingle(),
        ]);
        
        const testFixtures = (fixturesResult.data as any[]) ?? [];
        thisGwFixtures = testFixtures.map(f => ({ ...f, gw: f.test_gw })) as Fixture[];
        
        const testPicks = (picksResult.data as any[]) ?? [];
        if (testPicks.length > 0 && thisGwFixtures.length > 0) {
          const currentFixtureIndices = new Set(thisGwFixtures.map(f => f.fixture_index));
          const picksForCurrentFixtures = testPicks.filter((p: any) => currentFixtureIndices.has(p.fixture_index));
          
          const allFixturesHavePicks = thisGwFixtures.every(f => picksForCurrentFixtures.some((p: any) => p.fixture_index === f.fixture_index));
          const noExtraPicks = picksForCurrentFixtures.length === thisGwFixtures.length;
          const picksAreValid = allFixturesHavePicks && noExtraPicks && picksForCurrentFixtures.length > 0;
          
          if (picksAreValid) {
            userPicks = picksForCurrentFixtures.map(p => ({ ...p, gw: p.matchday })) as PickRow[];
          } else {
            userPicks = [];
          }
        } else {
          userPicks = testPicks.map(p => ({ ...p, gw: p.matchday })) as PickRow[];
        }
        
        gwResults = (resultsResult.data as ResultRow[]) ?? [];
        
        const cutoffDate = new Date('2025-11-18T00:00:00Z');
        const submissionDate = submissionResult.data?.submitted_at ? new Date(submissionResult.data.submitted_at) : null;
        const isRecentSubmission = submissionDate && submissionDate >= cutoffDate;
        
        if (isRecentSubmission && userPicks.length > 0) {
          const currentFixtureIndices = new Set(thisGwFixtures.map(f => f.fixture_index));
          const picksForCurrentFixtures = userPicks.filter((p: any) => currentFixtureIndices.has(p.fixture_index));
          const allFixturesHavePicks = thisGwFixtures.every(f => picksForCurrentFixtures.some((p: any) => p.fixture_index === f.fixture_index));
          const noExtraPicks = picksForCurrentFixtures.length === thisGwFixtures.length;
          const picksAreValid = allFixturesHavePicks && noExtraPicks && picksForCurrentFixtures.length > 0;
          
          submitted = picksAreValid;
        } else {
          submitted = false;
        }
      } else {
        // Regular fixtures
        [fixturesResult, picksResult, resultsResult, submissionResult] = await Promise.all([
          supabase.from("fixtures").select("id,gw,fixture_index,home_code,away_code,home_team,away_team,home_name,away_name,kickoff_time").eq("gw", currentGw).order("fixture_index", { ascending: true }),
          supabase.from("picks").select("user_id,gw,fixture_index,pick").eq("user_id", userId).eq("gw", currentGw),
          supabase.from("gw_results").select("gw,fixture_index,result").eq("gw", currentGw),
          supabase.from("gw_submissions").select("submitted_at").eq("user_id", userId).eq("gw", currentGw).maybeSingle(),
        ]);
        
        thisGwFixtures = (fixturesResult.data as Fixture[]) ?? [];
        userPicks = (picksResult.data as PickRow[]) ?? [];
        gwResults = (resultsResult.data as ResultRow[]) ?? [];
        submitted = !!submissionResult.data?.submitted_at;
      }

      // Calculate score for current GW
      const outcomeByIdx = new Map<number, "H" | "D" | "A">();
      gwResults.forEach((r) => {
        const out = rowToOutcome(r);
        if (out) {
          outcomeByIdx.set(r.fixture_index, out);
        }
      });

      const currentResultsMap: Record<number, "H" | "D" | "A"> = {};
      outcomeByIdx.forEach((result, fixtureIndex) => {
        currentResultsMap[fixtureIndex] = result;
      });

      let score: number | null = null;
      if (outcomeByIdx.size > 0 && userPicks.length > 0 && submitted) {
        let s = 0;
        userPicks.forEach((p) => {
          const out = outcomeByIdx.get(p.fixture_index);
          if (out && out === p.pick) s += 1;
        });
        score = s;
      } else if (outcomeByIdx.size === 0 && userPicks.length === 0) {
        score = null;
      } else if (!submitted && isTestLeague) {
        score = null;
      }

      const map: Record<number, "H" | "D" | "A"> = {};
      if (submitted || !isTestLeague) {
        userPicks.forEach((p) => {
          map[p.fixture_index] = p.pick;
        });
      }

      if (!alive) return;

      // PARALLEL QUERY 3: Fetch latest GW with results, unread counts, and submission status
      const leagueIds = ls.map(l => l.id);
      
      const [lastGwResult, readsResult] = await Promise.all([
        supabase.from("gw_results").select("gw").order("gw", { ascending: false }).limit(1),
        leagueIds.length > 0 ? supabase.from("league_message_reads").select("league_id,last_read_at").eq("user_id", userId) : Promise.resolve({ data: [], error: null }),
      ]);
      
      const lastGwWithResults = Array.isArray(lastGwResult.data) && lastGwResult.data.length ? (lastGwResult.data[0] as any).gw : null;
      
      // Fetch unread counts
      const unreadCounts: Record<string, number> = {};
      if (leagueIds.length > 0 && readsResult.data) {
        const lastRead = new Map<string, string>();
        (readsResult.data as any[]).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));

        const countPromises = leagueIds.map(async (leagueId) => {
          const since = lastRead.get(leagueId) ?? "1970-01-01T00:00:00Z";
          const { data, count } = await supabase
            .from("league_messages")
            .select("id", { count: "exact" })
            .eq("league_id", leagueId)
            .gte("created_at", since);
          return [leagueId, typeof count === "number" ? count : (data?.length ?? 0)] as [string, number];
        });
        
        const counts = await Promise.all(countPromises);
        counts.forEach(([leagueId, count]) => {
          unreadCounts[leagueId] = count;
        });
      }
      
      // Fetch submission status
      const submissionStatus: Record<string, LeagueSubmissionStatus> = {};
      if (leagueIds.length > 0) {
        const membersResult = await supabase
          .from("league_members")
          .select("league_id,user_id")
          .in("league_id", leagueIds);
        
        const membersByLeague: Record<string, string[]> = {};
        leagueIds.forEach(id => membersByLeague[id] = []);
        (membersResult.data ?? []).forEach((row: any) => {
          if (!membersByLeague[row.league_id]) membersByLeague[row.league_id] = [];
          membersByLeague[row.league_id].push(row.user_id);
        });
              
        const allMemberIds = Array.from(new Set(Object.values(membersByLeague).flat()));
        const { data: allSubmissions } = allMemberIds.length > 0 
          ? await supabase.from("gw_submissions").select("user_id").eq("gw", currentGw).in("user_id", allMemberIds)
          : { data: [] };
              
        const submittedUserIds = new Set((allSubmissions ?? []).map((s: any) => s.user_id));
        
        Object.entries(membersByLeague).forEach(([leagueId, memberIds]) => {
          const totalCount = memberIds.length;
          const submittedCount = memberIds.filter(id => submittedUserIds.has(id)).length;
          submissionStatus[leagueId] = {
            allSubmitted: submittedCount === totalCount && totalCount > 0,
            submittedCount,
            totalCount,
          };
        });
      }

      // Calculate score for last GW with results
      if (lastGwWithResults !== null && lastGwWithResults !== currentGw) {
        const [lastGwResultsData, lastGwPicksData] = await Promise.all([
          supabase.from("gw_results").select("fixture_index,result").eq("gw", lastGwWithResults),
          supabase.from("picks").select("fixture_index,pick").eq("gw", lastGwWithResults).eq("user_id", userId),
        ]);
        
        const lastGwResults = (lastGwResultsData.data as ResultRow[]) ?? [];
        const lastGwPicks = (lastGwPicksData.data as PickRow[]) ?? [];
        
        const outMap2 = new Map<number, "H" | "D" | "A">();
        lastGwResults.forEach(r => {
          const out = rowToOutcome(r);
          if (out) outMap2.set(r.fixture_index, out);
        });

        let myScore = 0;
        lastGwPicks.forEach((p) => {
          const out = outMap2.get(p.fixture_index);
          if (out && out === p.pick) myScore += 1;
        });

        if (alive) {
          setLastScoreGw(lastGwWithResults);
          setLastScore(myScore);
        }
      } else {
        if (alive) {
          setLastScoreGw(null);
          setLastScore(null);
        }
      }

      setNextGwComing(null);

      if (alive) {
        setGwSubmitted(submitted);
        setGwScore(score);
        setResultsMap(currentResultsMap);
        setFixtures(thisGwFixtures);
        setPicksMap(map);
        setUnreadByLeague(unreadCounts);
        setLeagueSubmissions(submissionStatus);
        setTimeout(() => {
          if (alive) {
            setLoading(false);
          }
        }, 0);
      }
    } catch (error) {
      console.error('[Home] Error loading home page data:', error);
      if (alive) {
        setLoading(false);
        setFixtures([]);
        setGwSubmitted(false);
        setGwScore(null);
      }
    }
  }, [userId]);

  return {
    leagues,
    leagueSubmissions,
    fixtures,
    gw,
    gwSubmitted,
    gwScore,
    picksMap,
    resultsMap,
    loading,
    lastScore,
    lastScoreGw,
    unreadByLeague,
    isInApiTestLeague,
    nextGwComing,
    fetchHomeData,
    setLoading,
    setFixtures, // Exported for live scores to update
    setResultsMap // Exported for live scores to update
  };
}

