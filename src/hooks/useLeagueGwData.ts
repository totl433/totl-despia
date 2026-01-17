import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached, CACHE_TTL } from '../lib/cache';
import { getGameweekState } from '../lib/gameweekState';

export type LeagueGwDataLeague = { id: string; name: string; code: string };
export type LeagueGwDataMember = { id: string; name: string };

export type LeagueGwDataFixture = {
  api_match_id?: number | null;
  id: string;
  gw: number;
  fixture_index: number;
  home_team: string;
  away_team: string;
  home_code?: string | null;
  away_code?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  home_crest?: string | null;
  away_crest?: string | null;
  kickoff_time?: string | null;
};

export type LeagueGwDataPickRow = { user_id: string; gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' };
export type LeagueGwDataSubmissionRow = { user_id: string; gw: number; submitted_at: string | null };
export type LeagueGwDataResultRow = {
  gw: number;
  fixture_index: number;
  result?: 'H' | 'D' | 'A' | null;
  home_goals?: number | null;
  away_goals?: number | null;
};

interface UseLeagueGwDataProps {
  league: LeagueGwDataLeague | null;
  members: LeagueGwDataMember[];
  tab: 'chat' | 'mlt' | 'gw' | 'gwr';
  currentGw: number | null;
  latestResultsGw: number | null;
  selectedGw: number | null;
  manualGwSelectedRef: React.MutableRefObject<boolean>;
  gwResultsVersion: number;
}

interface UseLeagueGwDataReturn {
  fixtures: LeagueGwDataFixture[];
  picks: LeagueGwDataPickRow[];
  subs: LeagueGwDataSubmissionRow[];
  results: LeagueGwDataResultRow[];
  submittedMap: Map<string, boolean>;
  currentTestGw: number | null;
  loadingGwData: boolean;
}

/**
 * Extracted loader for League GW data (fixtures/picks/submissions/results).
 * This is intentionally conservative and mirrors existing League.tsx behavior.
 */
export function useLeagueGwData({
  league,
  members,
  tab,
  currentGw,
  latestResultsGw,
  selectedGw,
  manualGwSelectedRef,
  gwResultsVersion,
}: UseLeagueGwDataProps): UseLeagueGwDataReturn {
  const [fixtures, setFixtures] = useState<LeagueGwDataFixture[]>([]);
  const [picks, setPicks] = useState<LeagueGwDataPickRow[]>([]);
  const [subs, setSubs] = useState<LeagueGwDataSubmissionRow[]>([]);
  const [results, setResults] = useState<LeagueGwDataResultRow[]>([]);
  const [currentTestGw, setCurrentTestGw] = useState<number | null>(null);
  const [loadingGwData, setLoadingGwData] = useState(true);

  const memberIds = useMemo(() => members.map((m) => m.id), [members]);
  const isApiTestLeague = useMemo(() => league?.name === 'API Test', [league?.name]);

  // API Test current GW support
  useEffect(() => {
    if (!isApiTestLeague) {
      setCurrentTestGw(null);
      return;
    }
    let alive = true;
    (async () => {
      const cachedTestGw = getCached<number>('app_meta:current_test_gw');
      let testGw = cachedTestGw ?? 1;

      if (!cachedTestGw) {
        const { data: testMetaData } = await supabase
          .from('test_api_meta')
          .select('current_test_gw')
          .eq('id', 1)
          .maybeSingle();
        testGw = testMetaData?.current_test_gw ?? 1;
        setCached('app_meta:current_test_gw', testGw, CACHE_TTL.LEAGUES);
      }

      if (!alive) return;
      setCurrentTestGw(testGw);
    })();
    return () => {
      alive = false;
    };
  }, [isApiTestLeague]);

  useEffect(() => {
    if (!league) {
      setFixtures([]);
      setPicks([]);
      setSubs([]);
      setResults([]);
      setLoadingGwData(false);
      return;
    }

    let alive = true;
    setLoadingGwData(true);

    (async () => {
      let gwForData: number | null = null;
      const useTestFixtures = isApiTestLeague && (tab === 'gw' || tab === 'gwr');

      if (tab === 'gwr') {
        if (manualGwSelectedRef.current && selectedGw) {
          gwForData = selectedGw;
        } else if (currentGw) {
          try {
            const st = await getGameweekState(currentGw);
            const deadlinePassed = st === 'LIVE' || st === 'RESULTS_PRE_GW';
            if (deadlinePassed) gwForData = currentGw;
            else gwForData = latestResultsGw && latestResultsGw < currentGw ? latestResultsGw : Math.max(1, currentGw - 1);
          } catch {
            gwForData = latestResultsGw && currentGw ? Math.min(latestResultsGw, currentGw) : currentGw;
          }
        } else {
          gwForData = selectedGw;
        }
      } else if (tab === 'gw') {
        gwForData = currentGw;
      } else {
        gwForData = currentGw;
      }

      if (useTestFixtures) {
        gwForData = currentTestGw;
      }

      if (!gwForData) {
        if (!alive) return;
        setFixtures([]);
        setPicks([]);
        setSubs([]);
        setResults([]);
        setLoadingGwData(false);
        return;
      }

      // Fixtures
      let fx: LeagueGwDataFixture[] = [];
      if (useTestFixtures) {
        const { data } = await supabase
          .from('app_fixtures')
          .select(
            'id,test_gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,home_crest,away_crest,kickoff_time,api_match_id'
          )
          .eq('test_gw', gwForData)
          .order('fixture_index', { ascending: true });
        fx =
          data?.map((f: any) => ({
            ...f,
            gw: f.test_gw as number,
          })) ?? [];
      } else {
        const { data } = await supabase
          .from('app_fixtures')
          .select('id,gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,kickoff_time,api_match_id')
          .eq('gw', gwForData)
          .order('fixture_index', { ascending: true });
        fx = (data as any[])?.map((f) => f as LeagueGwDataFixture) ?? [];
      }

      if (!alive) return;
      setFixtures(fx);

      if (!memberIds.length) {
        setPicks([]);
        setSubs([]);
        setResults([]);
        setLoadingGwData(false);
        return;
      }

      // Picks + submissions
      let pk: LeagueGwDataPickRow[] = [];
      let sb: LeagueGwDataSubmissionRow[] = [];

      if (useTestFixtures) {
        const { data: testPicks } = await supabase
          .from('app_picks')
          .select('user_id,matchday,fixture_index,pick')
          .eq('matchday', gwForData)
          .in('user_id', memberIds);
        pk =
          testPicks?.map((p: any) => ({
            user_id: p.user_id as string,
            gw: p.matchday as number,
            fixture_index: p.fixture_index as number,
            pick: p.pick as 'H' | 'D' | 'A',
          })) ?? [];

        const { data: testSubs } = await supabase
          .from('app_gw_submissions')
          .select('user_id,matchday,submitted_at')
          .eq('matchday', gwForData)
          .not('submitted_at', 'is', null)
          .in('user_id', memberIds);
        sb =
          testSubs?.map((s: any) => ({
            user_id: s.user_id as string,
            gw: s.matchday as number,
            submitted_at: s.submitted_at as string | null,
          })) ?? [];
      } else {
        const { data: regularPicks } = await supabase
          .from('app_picks')
          .select('user_id,gw,fixture_index,pick')
          .eq('gw', gwForData)
          .in('user_id', memberIds);
        pk = (regularPicks as any[])?.map((p) => p as LeagueGwDataPickRow) ?? [];

        const { data: regularSubs } = await supabase
          .from('app_gw_submissions')
          .select('user_id,gw,submitted_at')
          .eq('gw', gwForData)
          .in('user_id', memberIds);
        sb = (regularSubs as any[])?.map((s) => s as LeagueGwDataSubmissionRow) ?? [];
      }

      if (!alive) return;
      setPicks(pk);
      setSubs(sb);

      // Results (final results table)
      const { data: rs } = await supabase
        .from('app_gw_results')
        .select('gw,fixture_index,result')
        .eq('gw', useTestFixtures ? 1 : gwForData);
      if (!alive) return;
      setResults((rs as any[])?.map((r) => r as LeagueGwDataResultRow) ?? []);

      setLoadingGwData(false);
    })();

    return () => {
      alive = false;
    };
  }, [
    league?.id,
    memberIds.join(','),
    tab,
    currentGw,
    latestResultsGw,
    selectedGw,
    currentTestGw,
    gwResultsVersion,
    manualGwSelectedRef,
    isApiTestLeague,
    league,
  ]);

  const submittedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    subs.forEach((s) => {
      if (s.submitted_at) m.set(`${s.user_id}:${s.gw}`, true);
    });
    return m;
  }, [subs]);

  return { fixtures, picks, subs, results, submittedMap, currentTestGw, loadingGwData };
}

