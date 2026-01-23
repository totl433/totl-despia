import React from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Screen, TotlText, useTokens } from '@totl/ui';
import type { Fixture, GwResultRow, HomeSnapshot, LiveScore, LiveStatus, Pick } from '@totl/domain';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { LeaguesStackParamList } from '../navigation/LeaguesNavigator';
import LeagueHeader from '../components/league/LeagueHeader';
import LeagueTabBar, { type LeagueTabKey } from '../components/league/LeagueTabBar';
import LeagueGwTable, { type LeagueGwTableRow } from '../components/league/LeagueGwTable';
import LeagueWinnerBanner from '../components/league/LeagueWinnerBanner';
import LeagueGwControlsRow from '../components/league/LeagueGwControlsRow';
import LeagueRulesSheet from '../components/league/LeagueRulesSheet';
import LeagueSeasonTable, { type LeagueSeasonRow } from '../components/league/LeagueSeasonTable';
import LeaguePointsFormToggle from '../components/league/LeaguePointsFormToggle';
import LeagueSeasonRulesSheet from '../components/league/LeagueSeasonRulesSheet';
import LeaguePillButton from '../components/league/LeaguePillButton';
import LeagueSubmissionStatusCard from '../components/league/LeagueSubmissionStatusCard';
import type { LeaguePick } from '../components/league/LeaguePickPill';
import FixtureCard from '../components/FixtureCard';
import LeaguePickChipsRow from '../components/league/LeaguePickChipsRow';
import LeagueChatTab from '../components/chat/LeagueChatTab';

export default function LeagueDetailScreen() {
  const route = useRoute<any>();
  const params = route.params as LeaguesStackParamList['LeagueDetail'];
  const t = useTokens();
  const navigation = useNavigation<any>();
  const [tab, setTab] = React.useState<LeagueTabKey>('gwTable');
  const [rulesOpen, setRulesOpen] = React.useState(false);

  type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;
  type LeagueSummary = LeaguesResponse['leagues'][number];

  const { data: leagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  const leagueFromList = React.useMemo(() => {
    const list: LeagueSummary[] = leagues?.leagues ?? [];
    return list.find((l) => String(l.id) === String(params.leagueId)) ?? null;
  }, [leagues?.leagues, params.leagueId]);

  const avatarUri =
    leagueFromList && typeof leagueFromList.avatar === 'string' && leagueFromList.avatar.startsWith('http')
      ? leagueFromList.avatar
      : null;

  const { data: home } = useQuery<HomeSnapshot>({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });
  const viewingGw = home?.viewingGw ?? null;
  const currentGw = home?.currentGw ?? viewingGw ?? null;

  const [selectedGw, setSelectedGw] = React.useState<number | null>(null);
  React.useEffect(() => {
    // Keep the GW table in sync with the user’s viewing GW by default.
    // Only initialize once (don’t override manual selection).
    if (selectedGw !== null) return;
    if (typeof viewingGw === 'number') {
      setSelectedGw(viewingGw);
      return;
    }
    if (typeof currentGw === 'number') {
      setSelectedGw(currentGw);
    }
  }, [currentGw, selectedGw, viewingGw]);

  const availableGws = React.useMemo(() => {
    const maxGw = typeof currentGw === 'number' ? currentGw : typeof viewingGw === 'number' ? viewingGw : null;
    if (!maxGw || maxGw < 1) return [];
    return Array.from({ length: maxGw }, (_, i) => i + 1);
  }, [currentGw, viewingGw]);

  type LeagueTableResponse = Awaited<ReturnType<typeof api.getLeagueGwTable>>;
  const leagueId = String(params.leagueId);
  const { data: table, isLoading: tableLoading } = useQuery<LeagueTableResponse>({
    enabled: tab === 'gwTable' && typeof selectedGw === 'number',
    queryKey: ['leagueGwTable', leagueId, selectedGw],
    queryFn: () => api.getLeagueGwTable(leagueId, selectedGw as number),
  });

  type LeagueMembersResponse = Awaited<ReturnType<typeof api.getLeague>>;
  const { data: leagueDetails } = useQuery<LeagueMembersResponse>({
    enabled: tab === 'season',
    queryKey: ['league', leagueId],
    queryFn: () => api.getLeague(leagueId),
  });
  const members = leagueDetails?.members ?? [];

  const allFixturesFinished = React.useMemo(() => {
    if (tab !== 'gwTable') return false;
    if (!home) return false;
    if (typeof selectedGw !== 'number') return false;
    // If the user selects a past GW, treat it as finished (we won’t have fixtures for it in the home snapshot).
    if (typeof viewingGw === 'number' && selectedGw !== viewingGw) return true;

    const fixtures: Fixture[] = home.fixtures ?? [];
    if (!fixtures.length) return false;

    const outcomes = new Set<number>();
    (home.gwResults ?? []).forEach((r: GwResultRow) => {
      if (typeof r?.fixture_index === 'number') outcomes.add(r.fixture_index);
    });

    const liveByFixtureIndex = new Map<number, LiveScore>();
    (home.liveScores ?? []).forEach((ls: LiveScore) => {
      if (typeof ls?.fixture_index === 'number') liveByFixtureIndex.set(ls.fixture_index, ls);
    });

    const hasActiveGames = fixtures.some((f: Fixture) => {
      const ls = liveByFixtureIndex.get(f.fixture_index);
      const st: LiveStatus = ls?.status ?? 'SCHEDULED';
      return st === 'IN_PLAY' || st === 'PAUSED';
    });

    const allHaveResults = fixtures.every((f: Fixture) => outcomes.has(f.fixture_index));
    const allFinishedStatus = fixtures.every((f: Fixture) => {
      const ls = liveByFixtureIndex.get(f.fixture_index);
      return ls?.status === 'FINISHED';
    });

    return (allHaveResults || allFinishedStatus) && !hasActiveGames;
  }, [home, selectedGw, tab, viewingGw]);

  const seasonShowUnicorns = members.length >= 3;
  const [seasonShowForm, setSeasonShowForm] = React.useState(false);
  const [seasonRulesOpen, setSeasonRulesOpen] = React.useState(false);

  const seasonIsLateStartingLeague = React.useMemo(() => {
    const name = String(params.name ?? '');
    const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
    const gw7StartLeagues = ['The Bird league'];
    const gw8StartLeagues = ['gregVjofVcarl', 'Let Down'];
    return !!(name && !specialLeagues.includes(name) && !gw7StartLeagues.includes(name) && !gw8StartLeagues.includes(name));
  }, [params.name]);

  const seasonStartGw = React.useMemo(() => {
    const name = String(params.name ?? '');
    const gw7StartLeagues = ['The Bird league'];
    const gw8StartLeagues = ['gregVjofVcarl', 'Let Down'];
    if (gw7StartLeagues.includes(name)) return 7;
    if (gw8StartLeagues.includes(name)) return 8;
    return 1;
  }, [params.name]);

  const { data: seasonRows, isLoading: seasonLoading } = useQuery<LeagueSeasonRow[]>({
    enabled: tab === 'season' && members.length > 0 && typeof currentGw === 'number',
    queryKey: ['leagueSeasonTable', leagueId, currentGw, members.map((m: any) => String(m.id ?? '')).join(',')],
    queryFn: async () => {
      const memberIds = members.map((m: any) => String(m.id));
      const showUnicorns = memberIds.length >= 3;
      const latestGw = currentGw as number;

      const [fixturesRes, resultsRes] = await Promise.all([
        (supabase as any).from('app_fixtures').select('gw,fixture_index').gte('gw', seasonStartGw).lte('gw', latestGw),
        (supabase as any).from('app_gw_results').select('gw,fixture_index,result').gte('gw', seasonStartGw).lte('gw', latestGw),
      ]);
      if (fixturesRes.error) throw fixturesRes.error;
      if (resultsRes.error) throw resultsRes.error;

      const fixtures: Array<{ gw: number; fixture_index: number }> = fixturesRes.data ?? [];
      const results: Array<{ gw: number; fixture_index: number; result: 'H' | 'D' | 'A' | string }> = resultsRes.data ?? [];

      const fixtureCountByGw = new Map<number, number>();
      fixtures.forEach((f) => fixtureCountByGw.set(f.gw, (fixtureCountByGw.get(f.gw) ?? 0) + 1));

      const resultCountByGw = new Map<number, number>();
      const outcomeByGwFixture = new Map<string, 'H' | 'D' | 'A'>();
      results.forEach((r) => {
        if (r.result !== 'H' && r.result !== 'D' && r.result !== 'A') return;
        resultCountByGw.set(r.gw, (resultCountByGw.get(r.gw) ?? 0) + 1);
        outcomeByGwFixture.set(`${r.gw}:${r.fixture_index}`, r.result);
      });

      const completeGws: number[] = [];
      for (let gw = seasonStartGw; gw <= latestGw; gw += 1) {
        const fixtureCount = fixtureCountByGw.get(gw) ?? 0;
        const resultCount = resultCountByGw.get(gw) ?? 0;
        if (fixtureCount > 0 && resultCount === fixtureCount) completeGws.push(gw);
      }
      if (completeGws.length === 0) return [];

      const picksRes = await (supabase as any)
        .from('app_picks')
        .select('user_id,gw,fixture_index,pick')
        .in('user_id', memberIds)
        .in('gw', completeGws);
      if (picksRes.error) throw picksRes.error;
      const picks: Array<{ user_id: string; gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' | string }> =
        picksRes.data ?? [];

      type GwScore = { user_id: string; score: number; unicorns: number };
      const perGw = new Map<number, Map<string, GwScore>>();
      completeGws.forEach((g) => {
        const m = new Map<string, GwScore>();
        memberIds.forEach((uid) => m.set(uid, { user_id: uid, score: 0, unicorns: 0 }));
        perGw.set(g, m);
      });

      const picksByGwFixture = new Map<string, Array<{ user_id: string; pick: string }>>();
      picks.forEach((p) => {
        const key = `${p.gw}:${p.fixture_index}`;
        const arr = picksByGwFixture.get(key) ?? [];
        arr.push({ user_id: p.user_id, pick: p.pick });
        picksByGwFixture.set(key, arr);
      });

      completeGws.forEach((g) => {
        const gwMap = perGw.get(g)!;
        // Iterate fixtures for this GW using outcomes map keys for that GW
        const fixtureIdxs = fixtures.filter((f) => f.gw === g).map((f) => f.fixture_index);
        fixtureIdxs.forEach((idx) => {
          const out = outcomeByGwFixture.get(`${g}:${idx}`);
          if (!out) return;
          const these = picksByGwFixture.get(`${g}:${idx}`) ?? [];
          const correct = these.filter((p) => p.pick === out).map((p) => p.user_id);

          these.forEach((p) => {
            if (p.pick !== out) return;
            const row = gwMap.get(p.user_id);
            if (row) row.score += 1;
          });

          if (showUnicorns && correct.length === 1) {
            const uid = correct[0];
            const row = gwMap.get(uid);
            if (row) row.unicorns += 1;
          }
        });
      });

      const mltPts = new Map<string, number>();
      const ocp = new Map<string, number>();
      const unis = new Map<string, number>();
      const wins = new Map<string, number>();
      const draws = new Map<string, number>();
      const form = new Map<string, Array<'W' | 'D' | 'L'>>();
      memberIds.forEach((uid) => {
        mltPts.set(uid, 0);
        ocp.set(uid, 0);
        unis.set(uid, 0);
        wins.set(uid, 0);
        draws.set(uid, 0);
        form.set(uid, []);
      });

      completeGws.forEach((g) => {
        const rows = Array.from(perGw.get(g)!.values());
        rows.forEach((r) => {
          ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
          unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
        });

        rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
        if (!rows.length) return;
        const top = rows[0];
        const coTop = rows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);

        if (coTop.length === 1) {
          mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
          wins.set(top.user_id, (wins.get(top.user_id) ?? 0) + 1);
          form.get(top.user_id)!.push('W');
          rows.slice(1).forEach((r) => form.get(r.user_id)!.push('L'));
        } else {
          coTop.forEach((r) => {
            mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
            draws.set(r.user_id, (draws.get(r.user_id) ?? 0) + 1);
            form.get(r.user_id)!.push('D');
          });
          rows
            .filter((r) => !coTop.find((t) => t.user_id === r.user_id))
            .forEach((r) => form.get(r.user_id)!.push('L'));
        }
      });

      const nameById = new Map<string, string>();
      members.forEach((m: any) => nameById.set(String(m.id), String(m.name ?? 'User')));

      const out: LeagueSeasonRow[] = memberIds.map((uid) => ({
        user_id: uid,
        name: nameById.get(uid) ?? 'User',
        mltPts: mltPts.get(uid) ?? 0,
        ocp: ocp.get(uid) ?? 0,
        unicorns: unis.get(uid) ?? 0,
        wins: wins.get(uid) ?? 0,
        draws: draws.get(uid) ?? 0,
        form: form.get(uid) ?? [],
      }));

      out.sort((a, b) => b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name));
      return out;
    },
  });

  const picksGw = React.useMemo(() => {
    // Match web: Predictions tab is for the current GW (except special leagues which we can add later).
    return typeof currentGw === 'number' ? currentGw : null;
  }, [currentGw]);

  type LeaguePredictionsData = {
    picksGw: number;
    deadlinePassed: boolean;
    allSubmitted: boolean;
    submittedSet: Set<string>;
    members: Array<{ id: string; name: string }>;
    fixtures: Fixture[];
    sections: Array<{ label: string; fixtures: Fixture[] }>;
    outcomeByFixtureIndex: Map<number, LeaguePick>;
    liveByFixtureIndex: Map<number, LiveScore>;
    picksByFixtureIndex: Map<number, Map<string, LeaguePick>>;
  };

  const { data: predictions } = useQuery<LeaguePredictionsData>({
    enabled: tab === 'predictions' && members.length > 0 && typeof picksGw === 'number' && picksGw >= seasonStartGw,
    queryKey: ['leaguePredictions', leagueId, picksGw, members.map((m: any) => String(m.id)).join(',')],
    queryFn: async () => {
      const gw = picksGw as number;
      const memberIds = members.map((m: any) => String(m.id));

      const [fixturesRes, subsRes, picksRes, liveRes, resultsRes] = await Promise.all([
        (supabase as any).from('app_fixtures').select('*').eq('gw', gw).order('fixture_index', { ascending: true }),
        (supabase as any).from('app_gw_submissions').select('user_id').eq('gw', gw),
        (supabase as any).from('app_picks').select('user_id,fixture_index,pick').eq('gw', gw).in('user_id', memberIds),
        (supabase as any)
          .from('live_scores')
          .select('api_match_id,fixture_index,home_score,away_score,status,minute,goals')
          .eq('gw', gw),
        (supabase as any).from('app_gw_results').select('fixture_index,result').eq('gw', gw),
      ]);
      if (fixturesRes.error) throw fixturesRes.error;
      if (subsRes.error) throw subsRes.error;
      if (picksRes.error) throw picksRes.error;
      if (liveRes.error) throw liveRes.error;
      if (resultsRes.error) throw resultsRes.error;

      const fixtures: Fixture[] = (fixturesRes.data ?? []) as Fixture[];

      const kickoffTimes = fixtures
        .map((f) => f.kickoff_time)
        .filter((kt): kt is string => !!kt)
        .map((kt) => new Date(kt))
        .filter((d) => !Number.isNaN(d.getTime()));
      const firstKickoff = kickoffTimes.length ? new Date(Math.min(...kickoffTimes.map((d) => d.getTime()))) : null;
      const deadlineTime = firstKickoff ? new Date(firstKickoff.getTime() - 75 * 60 * 1000) : null;
      const deadlinePassed = deadlineTime ? new Date() >= deadlineTime : false;

      const submittedSet = new Set<string>(
        ((subsRes.data ?? []) as Array<{ user_id: string }>).map((s) => String(s.user_id)).filter((id) => memberIds.includes(id))
      );
      const allSubmitted = memberIds.length > 0 && memberIds.every((id) => submittedSet.has(id));

      const outcomeByFixtureIndex = new Map<number, LeaguePick>();
      ((resultsRes.data ?? []) as Array<{ fixture_index: number; result: Pick | string }>).forEach((r) => {
        if (r.result === 'H' || r.result === 'D' || r.result === 'A') outcomeByFixtureIndex.set(r.fixture_index, r.result);
      });

      const apiMatchIdToFixtureIndex = new Map<number, number>();
      fixtures.forEach((f) => {
        if (typeof (f as any).api_match_id === 'number') apiMatchIdToFixtureIndex.set((f as any).api_match_id, f.fixture_index);
      });

      const liveByFixtureIndex = new Map<number, LiveScore>();
      ((liveRes.data ?? []) as LiveScore[]).forEach((ls: any) => {
        const idx =
          typeof ls?.fixture_index === 'number'
            ? ls.fixture_index
            : typeof ls?.api_match_id === 'number'
              ? apiMatchIdToFixtureIndex.get(ls.api_match_id)
              : undefined;
        if (typeof idx !== 'number') return;
        liveByFixtureIndex.set(idx, ls);

        const st: LiveStatus = (ls?.status ?? 'SCHEDULED') as LiveStatus;
        const started = st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED';
        if (!started) return;
        const hs = Number(ls?.home_score ?? 0);
        const as = Number(ls?.away_score ?? 0);
        outcomeByFixtureIndex.set(idx, hs > as ? 'H' : hs < as ? 'A' : 'D');
      });

      const picksByFixtureIndex = new Map<number, Map<string, LeaguePick>>();
      ((picksRes.data ?? []) as Array<{ user_id: string; fixture_index: number; pick: LeaguePick | string }>).forEach((p) => {
        if (p.pick !== 'H' && p.pick !== 'D' && p.pick !== 'A') return;
        // Match web: only show picks from users who have submitted.
        if (!submittedSet.has(String(p.user_id))) return;
        if (!fixtures.find((f) => f.fixture_index === p.fixture_index)) return;
        const m = picksByFixtureIndex.get(p.fixture_index) ?? new Map<string, LeaguePick>();
        m.set(String(p.user_id), p.pick);
        picksByFixtureIndex.set(p.fixture_index, m);
      });

      const fmt = (iso?: string | null) => {
        if (!iso) return 'Fixtures';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return 'Fixtures';
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      };
      const buckets = new Map<string, { label: string; key: number; minFixtureIndex: number; fixtures: Fixture[] }>();
      fixtures.forEach((f) => {
        const label = fmt(f.kickoff_time ?? null);
        const timeKey = f.kickoff_time ? new Date(f.kickoff_time).getTime() : Number.MAX_SAFE_INTEGER;
        const safeTimeKey = Number.isFinite(timeKey) ? timeKey : Number.MAX_SAFE_INTEGER;
        const b =
          buckets.get(label) ?? { label, key: safeTimeKey, minFixtureIndex: Number(f.fixture_index ?? Number.MAX_SAFE_INTEGER), fixtures: [] };
        b.key = Math.min(b.key, safeTimeKey);
        b.minFixtureIndex = Math.min(b.minFixtureIndex, Number(f.fixture_index ?? Number.MAX_SAFE_INTEGER));
        b.fixtures.push(f);
        buckets.set(label, b);
      });
      const sections = Array.from(buckets.values())
        // Sort by earliest kickoff time, then by earliest fixture index as a stable fallback.
        .sort((a, b) => a.key - b.key || a.minFixtureIndex - b.minFixtureIndex)
        .map((b) => ({ label: b.label, fixtures: [...b.fixtures].sort((a, b) => a.fixture_index - b.fixture_index) }));

      return {
        picksGw: gw,
        deadlinePassed,
        allSubmitted,
        submittedSet,
        members: members.map((m: any) => ({ id: String(m.id), name: String(m.name ?? 'User') })),
        fixtures,
        sections,
        outcomeByFixtureIndex,
        liveByFixtureIndex,
        picksByFixtureIndex,
      };
    },
  });

  const { data: me } = useQuery<{ id: string } | null>({
    enabled: tab === 'predictions',
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ? { id: data.user.id } : null;
    },
  });

  return (
    <Screen fullBleed>
      <LeagueHeader
        title={String(params.name ?? '')}
        subtitle={typeof selectedGw === 'number' ? `Gameweek ${selectedGw}` : viewingGw ? `Gameweek ${viewingGw}` : 'Gameweek'}
        avatarUri={avatarUri}
        onPressBack={() => navigation.goBack()}
        onPressMenu={() => {}}
      />

      <LeagueTabBar value={tab} onChange={setTab} />

      <View style={{ flex: 1, padding: t.space[4] }}>
        {tab === 'gwTable' ? (
          <>
            {table?.rows?.length && allFixturesFinished ? (
              <LeagueWinnerBanner
                winnerName={String(table.rows?.[0]?.name ?? '')}
                isDraw={
                  Number(table.rows?.[0]?.score ?? 0) === Number(table.rows?.[1]?.score ?? -1) &&
                  Number(table.rows?.[0]?.unicorns ?? 0) === Number(table.rows?.[1]?.unicorns ?? -1)
                }
              />
            ) : null}

            {tableLoading ? <TotlText variant="muted">Loading…</TotlText> : null}

            <LeagueGwTable
              rows={(table?.rows ?? []) as LeagueGwTableRow[]}
              showUnicorns={Number(table?.totalMembers ?? 0) >= 3}
              submittedCount={typeof table?.submittedCount === 'number' ? table.submittedCount : null}
              totalMembers={typeof table?.totalMembers === 'number' ? table.totalMembers : null}
            />

            <LeagueGwControlsRow
              availableGws={availableGws}
              selectedGw={selectedGw}
              onChangeGw={setSelectedGw}
              onPressRules={() => setRulesOpen(true)}
            />

            <LeagueRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
          </>
        ) : tab === 'season' ? (
          <>
            <LeagueSeasonTable
              rows={seasonRows ?? []}
              loading={seasonLoading}
              showForm={seasonShowForm}
              showUnicorns={seasonShowUnicorns}
              isLateStartingLeague={seasonIsLateStartingLeague}
            />

            <View
              style={{
                marginTop: t.space[4],
                marginBottom: t.space[2],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <LeaguePointsFormToggle showForm={seasonShowForm} onToggle={setSeasonShowForm} />
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }} />
              <LeaguePillButton label="Rules" onPress={() => setSeasonRulesOpen(true)} />
            </View>

            <LeagueSeasonRulesSheet
              open={seasonRulesOpen}
              onClose={() => setSeasonRulesOpen(false)}
              isLateStartingLeague={seasonIsLateStartingLeague}
            />
          </>
        ) : tab === 'predictions' ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }}>
            {typeof picksGw !== 'number' ? (
              <TotlText variant="muted">No current gameweek available.</TotlText>
            ) : picksGw < seasonStartGw ? (
              <TotlText variant="muted">No Predictions Available (this league started later).</TotlText>
            ) : !predictions ? (
              <TotlText variant="muted">Loading…</TotlText>
            ) : (() => {
                const shouldShowWhoSubmitted = !predictions.allSubmitted && !predictions.deadlinePassed;

                if (shouldShowWhoSubmitted) {
                  return (
                    <LeagueSubmissionStatusCard
                      members={predictions.members}
                      submittedSet={predictions.submittedSet}
                      picksGw={predictions.picksGw}
                      fixtures={predictions.fixtures}
                      variant="compact"
                    />
                  );
                }

                return (
                  <>
                    {!predictions.allSubmitted ? (
                      <LeagueSubmissionStatusCard
                        members={predictions.members}
                        submittedSet={predictions.submittedSet}
                        picksGw={predictions.picksGw}
                        fixtures={predictions.fixtures}
                        variant="full"
                      />
                    ) : null}

                    {predictions.sections.map((sec) => (
                      <View key={sec.label} style={{ marginTop: 12 }}>
                        <TotlText variant="body" style={{ fontWeight: '900', marginBottom: 10 }}>
                          {sec.label}
                        </TotlText>

                        <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(148,163,184,0.14)' }}>
                          {sec.fixtures.map((f, idx) => {
                            const live = predictions.liveByFixtureIndex.get(f.fixture_index) ?? null;
                            const lsNoGoals = live ? ({ ...(live as any), goals: undefined } as any) : null;
                            const outcome = predictions.outcomeByFixtureIndex.get(f.fixture_index) ?? null;
                            const picksMap = predictions.picksByFixtureIndex.get(f.fixture_index) ?? new Map<string, LeaguePick>();

                            return (
                              <View
                                key={`${predictions.picksGw}-${f.fixture_index}`}
                                style={{
                                  borderTopWidth: idx === 0 ? 0 : 1,
                                  borderTopColor: 'rgba(148,163,184,0.14)',
                                }}
                              >
                                <FixtureCard
                                  fixture={f as any}
                                  liveScore={lsNoGoals}
                                  showPickButtons={false}
                                  variant="grouped"
                                  result={outcome}
                                />
                                <LeaguePickChipsRow
                                  members={predictions.members}
                                  picksByUserId={picksMap}
                                  outcome={outcome}
                                  currentUserId={me?.id ?? null}
                                />
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </>
                );
              })()}
          </ScrollView>
        ) : tab === 'chat' ? (
          <LeagueChatTab leagueId={leagueId} members={members.map((m: any) => ({ id: String(m.id), name: String(m.name ?? 'User') }))} />
        ) : (
          <TotlText variant="muted">Season tab (coming).</TotlText>
        )}
      </View>
    </Screen>
  );
}

