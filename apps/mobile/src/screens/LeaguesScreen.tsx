import React from 'react';
import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';
import Reanimated, { Easing, LinearTransition, useSharedValue } from 'react-native-reanimated';

import { api } from '../lib/api';
import { env } from '../env';
import type { RootStackParamList } from '../navigation/AppNavigator';
import MiniLeagueListItem from '../components/miniLeagues/MiniLeagueListItem';
import { TotlRefreshControl } from '../lib/refreshControl';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import CreateJoinLeagueSheet from '../components/miniLeagues/CreateJoinLeagueSheet';
import { joinLeagueByCode } from '../services/leagues';
import { resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import CenteredSpinner from '../components/CenteredSpinner';
import { sortLeaguesByUnread } from '../lib/sortLeaguesByUnread';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../lib/layout';
import { supabase } from '../lib/supabase';
import { resolveLeagueStartGw } from '../lib/leagueStart';
import { getGameweekStateFromSnapshot } from '../lib/gameweekState';
import MiniLeagueLiveCard from '../components/home/MiniLeagueLiveCard';
import AppTopHeader from '../components/AppTopHeader';
import HeaderLiveScore from '../components/HeaderLiveScore';
import { DEV_FAKE_LEAGUE_ID, DEV_FAKE_LEAGUE_MEMBERS, DEV_FAKE_LEAGUE_NAME, isDevFakeLeagueId } from '../lib/devFakeLeague';
import { buildHeaderExpandedStats, buildHeaderScoreSummary, buildHeaderTickerEvent, formatHeaderScoreLabel } from '../lib/headerLiveScore';
import { useLiveScores } from '../hooks/useLiveScores';

type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;
type LeagueSummary = LeaguesResponse['leagues'][number];
type LeagueMembersResponse = Awaited<ReturnType<typeof api.getLeague>>;
type LeagueTableResponse = Awaited<ReturnType<typeof api.getLeagueGwTable>>;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('refresh-timeout')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      }
    );
  });
}

function ordinal(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function LeagueRow({
  league,
  enabled,
  currentGw,
  meId,
  fallbackMeId,
  onPress,
}: {
  league: LeagueSummary;
  enabled: boolean;
  currentGw: number | null;
  meId: string | null;
  fallbackMeId: string | null;
  onPress: () => void;
}) {
  const leagueId = String(league.id);
  const isDevFakeLeague = isDevFakeLeagueId(leagueId);
  const { unreadByLeagueId, optimisticallyClear } = useLeagueUnreadCounts();
  const unread = Number(unreadByLeagueId[leagueId] ?? 0);

  const { data: membersData } = useQuery<LeagueMembersResponse>({
    enabled: enabled && !isDevFakeLeague,
    queryKey: ['leagueMembers', leagueId],
    queryFn: () => api.getLeague(leagueId),
  });

  const { data: table } = useQuery<LeagueTableResponse>({
    enabled: enabled && typeof currentGw === 'number' && !isDevFakeLeague,
    queryKey: ['leagueGwTable', leagueId, currentGw],
    queryFn: () => api.getLeagueGwTable(leagueId, currentGw as number),
  });

  const members = isDevFakeLeague ? DEV_FAKE_LEAGUE_MEMBERS : (membersData?.members ?? []);
  const allSubmitted = isDevFakeLeague ? true : !!table && table.submittedCount === table.totalMembers && table.totalMembers > 0;

  const memberCount: number | null =
    typeof table?.totalMembers === 'number' && Number.isFinite(table.totalMembers)
      ? table.totalMembers
      : typeof members.length === 'number'
        ? members.length
        : null;

  const { data: resolvedLeagueStartGw } = useQuery<number>({
    enabled: enabled && typeof currentGw === 'number' && !!leagueId && !isDevFakeLeague,
    queryKey: [
      'leagueStartGw',
      leagueId,
      currentGw,
      String((membersData as any)?.league?.name ?? league.name ?? ''),
      String((membersData as any)?.league?.created_at ?? ''),
    ],
    queryFn: async () =>
      resolveLeagueStartGw(
        {
          id: leagueId,
          name: String((membersData as any)?.league?.name ?? league.name ?? ''),
          created_at:
            typeof (membersData as any)?.league?.created_at === 'string' ? String((membersData as any).league.created_at) : undefined,
        },
        currentGw as number
      ),
    staleTime: 5 * 60_000,
  });

  const effectiveMeId = meId ?? fallbackMeId ?? null;

  const { data: seasonRankData } = useQuery<{ myRank: number | null; orderedUserIds: string[] }>({
    enabled:
      enabled &&
      !isDevFakeLeague &&
      members.length > 0 &&
      typeof currentGw === 'number' &&
      typeof resolvedLeagueStartGw === 'number',
    queryKey: [
      'leagueSeasonRank',
      leagueId,
      effectiveMeId,
      currentGw,
      resolvedLeagueStartGw,
      members.map((m: any) => String(m.id ?? '')).join(','),
    ],
    queryFn: async () => {
      const memberIds = members.map((m: any) => String(m.id ?? ''));
      if (!memberIds.length) return { myRank: null, orderedUserIds: memberIds };
      const latestGw = currentGw as number;
      const seasonStartGw = resolvedLeagueStartGw as number;
      const showUnicorns = memberIds.length >= 3;

      const resultsRes = await (supabase as any)
        .from('app_gw_results')
        .select('gw,fixture_index,result')
        .gte('gw', seasonStartGw)
        .lte('gw', latestGw);
      if (resultsRes.error) throw resultsRes.error;

      const results: Array<{ gw: number; fixture_index: number; result: 'H' | 'D' | 'A' | string }> = resultsRes.data ?? [];
      const outcomeByGwFixture = new Map<string, 'H' | 'D' | 'A'>();
      results.forEach((r) => {
        if (r.result !== 'H' && r.result !== 'D' && r.result !== 'A') return;
        outcomeByGwFixture.set(`${r.gw}:${r.fixture_index}`, r.result);
      });

      const gwsWithResults = Array.from(
        new Set(
          Array.from(outcomeByGwFixture.keys())
            .map((k) => Number.parseInt(k.split(':')[0] ?? '', 10))
            .filter((n) => Number.isFinite(n))
        )
      ).sort((a, b) => a - b);

      let relevantGws = gwsWithResults.filter((gw) => gw >= seasonStartGw);

      if (relevantGws.includes(latestGw)) {
        const fixturesForCurrentGwRes = await (supabase as any).from('app_fixtures').select('fixture_index').eq('gw', latestGw);
        if (fixturesForCurrentGwRes.error) throw fixturesForCurrentGwRes.error;
        const fixtureCount = (fixturesForCurrentGwRes.data ?? []).length;
        const resultCountForCurrentGw = Array.from(outcomeByGwFixture.keys()).filter(
          (k) => Number.parseInt(k.split(':')[0] ?? '', 10) === latestGw
        ).length;
        if (fixtureCount > 0 && resultCountForCurrentGw < fixtureCount) {
          relevantGws = relevantGws.filter((gw) => gw < latestGw);
        }
      } else {
        relevantGws = relevantGws.filter((gw) => gw < latestGw);
      }

      if (relevantGws.length === 0) return { myRank: null, orderedUserIds: memberIds };

      const picksRes = await (supabase as any)
        .from('app_picks')
        .select('user_id,gw,fixture_index,pick')
        .in('user_id', memberIds)
        .in('gw', relevantGws);
      if (picksRes.error) throw picksRes.error;

      const picks: Array<{ user_id: string; gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' | string }> = picksRes.data ?? [];

      type GwScore = { user_id: string; score: number; unicorns: number };
      const perGw = new Map<number, Map<string, GwScore>>();
      relevantGws.forEach((g) => {
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

      relevantGws.forEach((gw) => {
        const gwMap = perGw.get(gw)!;
        const outcomesForGw = Array.from(outcomeByGwFixture.entries())
          .filter(([k]) => Number.parseInt(k.split(':')[0] ?? '', 10) === gw)
          .map(([k, out]) => ({ fixtureIndex: Number.parseInt(k.split(':')[1] ?? '', 10), out }))
          .filter((x) => Number.isFinite(x.fixtureIndex));

        outcomesForGw.forEach(({ fixtureIndex, out }) => {
          const these = picksByGwFixture.get(`${gw}:${fixtureIndex}`) ?? [];
          const correct = these.filter((p) => p.pick === out).map((p) => p.user_id);
          these.forEach((p) => {
            if (p.pick !== out) return;
            const row = gwMap.get(p.user_id);
            if (row) row.score += 1;
          });
          if (showUnicorns && correct.length === 1) {
            const lone = gwMap.get(correct[0]!);
            if (lone) lone.unicorns += 1;
          }
        });
      });

      const mltPts = new Map<string, number>();
      const ocp = new Map<string, number>();
      const unis = new Map<string, number>();
      memberIds.forEach((uid) => {
        mltPts.set(uid, 0);
        ocp.set(uid, 0);
        unis.set(uid, 0);
      });

      relevantGws.forEach((g) => {
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
        } else {
          coTop.forEach((r) => mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1));
        }
      });

      const nameById = new Map<string, string>();
      members.forEach((m: any) => nameById.set(String(m.id ?? ''), String(m.name ?? 'User')));

      const orderedIds = memberIds
        .slice()
        .sort((a, b) => {
          const aPts = mltPts.get(a) ?? 0;
          const bPts = mltPts.get(b) ?? 0;
          if (bPts !== aPts) return bPts - aPts;
          const aUnis = unis.get(a) ?? 0;
          const bUnis = unis.get(b) ?? 0;
          if (bUnis !== aUnis) return bUnis - aUnis;
          const aOcp = ocp.get(a) ?? 0;
          const bOcp = ocp.get(b) ?? 0;
          if (bOcp !== aOcp) return bOcp - aOcp;
          return (nameById.get(a) ?? '').localeCompare(nameById.get(b) ?? '');
        });

      const idx = effectiveMeId ? orderedIds.findIndex((id) => id === String(effectiveMeId)) : -1;
      return { myRank: idx >= 0 ? idx + 1 : null, orderedUserIds: orderedIds };
    },
    staleTime: 30_000,
  });

  const currentRank = seasonRankData?.myRank ?? null;
  const orderedUserIds = seasonRankData?.orderedUserIds ?? [];
  const memberOrder = React.useMemo(() => {
    const out = new Map<string, number>();
    orderedUserIds.forEach((id, idx) => out.set(String(id), idx));
    return out;
  }, [orderedUserIds]);

  return (
    <MiniLeagueListItem
      title={String(league.name ?? '')}
      avatarUri={resolveLeagueAvatarUri(typeof league.avatar === 'string' ? league.avatar : null)}
      submittedCount={isDevFakeLeague ? 8 : typeof table?.submittedCount === 'number' ? table.submittedCount : null}
      totalMembers={isDevFakeLeague ? 8 : typeof table?.totalMembers === 'number' ? table.totalMembers : members.length ?? null}
      membersPreview={(() => {
        if (isDevFakeLeague) {
          return DEV_FAKE_LEAGUE_MEMBERS.map((m) => ({
            id: String(m.id),
            name: String(m.name),
            avatarUri: null,
            hasSubmitted: true,
          }));
        }
        const submitted = new Set<string>(
          Array.isArray((table as any)?.submittedUserIds)
            ? ((table as any).submittedUserIds as unknown[]).map((x) => String(x))
            : (table?.rows ?? []).map((r: any) => String(r?.user_id ?? '')).filter(Boolean)
        );
        return members
          .map((m: any) => {
          const id = String(m.id);
          return {
            id,
            name: String(m.name ?? ''),
            avatarUri: typeof m.avatar_url === 'string' && m.avatar_url.startsWith('http') ? m.avatar_url : null,
            hasSubmitted: submitted.has(id),
          };
          })
          .sort((a, b) => {
            const aOrder = memberOrder.get(a.id);
            const bOrder = memberOrder.get(b.id);
            if (typeof aOrder === 'number' && typeof bOrder === 'number') return aOrder - bOrder;
            if (typeof aOrder === 'number') return -1;
            if (typeof bOrder === 'number') return 1;
            return a.name.localeCompare(b.name);
          });
      })()}
      memberCount={isDevFakeLeague ? 8 : memberCount}
      myRank={isDevFakeLeague ? 1 : currentRank}
      unreadCount={unread}
      onPress={() => {
        onPress();
      }}
    />
  );
}

export default function LeaguesScreen() {
  const navigation = useNavigation<any>();
  const t = useTokens();
  const { width: screenWidth } = useWindowDimensions();
  const listRef = React.useRef<FlatList<LeagueSummary> | null>(null);
  useScrollToTop(listRef as any);
  const queryClient = useQueryClient();
  const { unreadByLeagueId, meId: unreadMeId } = useLeagueUnreadCounts();
  const [hasAccessToken, setHasAccessToken] = React.useState<boolean | null>(null);
  const [pullRefreshing, setPullRefreshing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setHasAccessToken(Boolean(data.session?.access_token));
      } catch {
        if (cancelled) return;
        setHasAccessToken(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const { data: authUser } = useQuery<any | null>({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const meId = authUser?.id ? String(authUser.id) : null;
  type UserAvatarRow = { avatar_url: string | null };
  const { data: avatarRow } = useQuery<UserAvatarRow | null>({
    enabled: !!meId,
    queryKey: ['profile-avatar-url', meId],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('avatar_url').eq('id', meId).maybeSingle();
      const err = error as { code?: string } | null;
      if (error && err?.code !== 'PGRST116') throw error;
      if (!data) return null;
      const row = data as { avatar_url?: unknown };
      return { avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null };
    },
    staleTime: 60_000,
  });
  const avatarUrl = typeof avatarRow?.avatar_url === 'string' ? String(avatarRow.avatar_url) : null;
  const { data, isLoading, error, refetch } = useQuery<LeaguesResponse>({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  const sortedLeagues = React.useMemo(() => {
    return sortLeaguesByUnread(data?.leagues ?? [], unreadByLeagueId);
  }, [data?.leagues, unreadByLeagueId]);
  const listLeagues = React.useMemo(() => {
    if (!__DEV__) return sortedLeagues;
    const fake = {
      id: DEV_FAKE_LEAGUE_ID,
      name: DEV_FAKE_LEAGUE_NAME,
      avatar: null,
    } as unknown as LeagueSummary;
    return [fake, ...sortedLeagues.filter((l) => String(l.id) !== DEV_FAKE_LEAGUE_ID)];
  }, [sortedLeagues]);

  const sortedLeaguesRef = React.useRef<LeagueSummary[]>([]);
  React.useEffect(() => {
    sortedLeaguesRef.current = listLeagues;
  }, [listLeagues]);

  const { data: home, refetch: refetchHome } = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });
  const { data: headerRanks } = useQuery({
    queryKey: ['homeRanks'],
    queryFn: () => api.getHomeRanks(),
    staleTime: 60_000,
  });
  const viewingGw = home?.viewingGw ?? null;
  const currentGw = home?.currentGw ?? viewingGw ?? null;
  const showTopLiveRail = typeof viewingGw === 'number' && listLeagues.length > 0;
  const liveScoresGw = typeof viewingGw === 'number' ? viewingGw : typeof currentGw === 'number' ? currentGw : null;
  const { liveByFixtureIndex: liveByFixtureIndexRealtime } = useLiveScores(liveScoresGw, {
    initial: home?.liveScores ?? [],
  });
  const gwState = React.useMemo(() => {
    if (!home) return null;
    return getGameweekStateFromSnapshot({
      fixtures: home.fixtures ?? [],
      liveScores:
        liveByFixtureIndexRealtime.size > 0 ? Array.from(liveByFixtureIndexRealtime.values()) : home.liveScores ?? [],
      hasSubmittedViewingGw: !!home.hasSubmittedViewingGw,
    });
  }, [home, liveByFixtureIndexRealtime]);
  const { data: headerGwLiveTable } = useQuery({
    enabled: gwState === 'LIVE' && typeof viewingGw === 'number' && !!meId,
    queryKey: ['headerGwLiveTable', viewingGw],
    queryFn: () => api.getGlobalGwLiveTable(viewingGw as number),
    staleTime: 30_000,
  });
  const showReadyToMoveOn =
    typeof currentGw === 'number' && typeof viewingGw === 'number' ? viewingGw < currentGw : false;
  const liveRailGap = 10;
  // Carousel uses marginHorizontal: -space[4] to extend full width; content has paddingHorizontal.
  const liveCardWidth = Math.min(336, Math.max(260, screenWidth - t.space[4] * 2 - liveRailGap - 24));
  const liveRailItemSpan = liveCardWidth + liveRailGap;
  const liveRailRef = React.useRef<ScrollView | null>(null);
  const liveRailProgress = useSharedValue(0);
  const [activeLiveRailIndex, setActiveLiveRailIndex] = React.useState(0);
  const [liveTablesLayout, setLiveTablesLayout] = React.useState<'mini' | 'expanded'>('mini');
  const liveLayoutTransition = React.useMemo(
    () => LinearTransition.duration(200).easing(Easing.out(Easing.cubic)),
    []
  );
  const showTablesView =
    showTopLiveRail && (gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW' || showReadyToMoveOn);
  const showListView = !showTablesView;
  const canToggleLiveLayout = showTopLiveRail && showTablesView && listLeagues.length > 2;
  const wasShowingTablesViewRef = React.useRef(showTablesView);
  React.useEffect(() => {
    if (showTablesView && !wasShowingTablesViewRef.current) {
      setLiveTablesLayout('mini');
    }
    wasShowingTablesViewRef.current = showTablesView;
  }, [showTablesView]);

  const headerScoreSummary = React.useMemo(() => {
    if (!home) return null;

    const apiMatchIdToFixtureIndex = new Map<number, number>();
    (home.fixtures ?? []).forEach((fixture) => {
      if (typeof fixture.api_match_id === 'number') apiMatchIdToFixtureIndex.set(fixture.api_match_id, fixture.fixture_index);
    });

    const liveByFixtureIndex =
      liveByFixtureIndexRealtime.size > 0
        ? liveByFixtureIndexRealtime
        : (home.liveScores ?? []).reduce((map, liveScore) => {
            const fixtureIndex =
              typeof liveScore.fixture_index === 'number'
                ? liveScore.fixture_index
                : typeof liveScore.api_match_id === 'number'
                  ? apiMatchIdToFixtureIndex.get(liveScore.api_match_id)
                  : undefined;
            if (typeof fixtureIndex === 'number') map.set(fixtureIndex, liveScore);
            return map;
          }, new Map<number, any>());

    const resultByFixtureIndex = new Map<number, 'H' | 'D' | 'A'>();
    (home.gwResults ?? []).forEach((result) => {
      resultByFixtureIndex.set(result.fixture_index, result.result);
    });

    return buildHeaderScoreSummary({
      fixtures: home.fixtures ?? [],
      userPicks: home.userPicks ?? {},
      liveByFixtureIndex,
      resultByFixtureIndex,
    });
  }, [home, liveByFixtureIndexRealtime]);
  const { tickerEvent: headerTickerEvent, tickerEventKey: headerTickerEventKey } = React.useMemo(() => {
    if (!home) return { tickerEvent: null, tickerEventKey: null };
    return buildHeaderTickerEvent({
      fixtures: home.fixtures ?? [],
      liveByFixtureIndex:
        liveByFixtureIndexRealtime.size > 0
          ? liveByFixtureIndexRealtime
          : (home.liveScores ?? []).reduce((map, liveScore) => {
              const fixtureIndex =
                typeof liveScore.fixture_index === 'number'
                  ? liveScore.fixture_index
                  : typeof liveScore.api_match_id === 'number'
                    ? home.fixtures?.find((fixture) => fixture.api_match_id === liveScore.api_match_id)?.fixture_index
                    : undefined;
              if (typeof fixtureIndex === 'number') map.set(fixtureIndex, liveScore);
              return map;
            }, new Map<number, any>()),
    });
  }, [home, liveByFixtureIndexRealtime]);

  const showLiveHeaderScore = gwState === 'LIVE' && !!headerScoreSummary;
  const showStaticResultsHeaderScore = gwState === 'RESULTS_PRE_GW' && !!headerScoreSummary;
  const showHeaderTotlLogo =
    gwState === 'GW_OPEN' || gwState === 'GW_PREDICTED' || gwState === 'DEADLINE_PASSED';
  const headerScoreLabel = headerScoreSummary ? formatHeaderScoreLabel(headerScoreSummary, showLiveHeaderScore) : null;
  const liveGwRank = React.useMemo(() => {
    if (!meId) return null;
    const rows = headerGwLiveTable?.rows ?? [];
    if (!rows.length) return null;
    const mine = rows.find((row) => String(row.user_id) === String(meId));
    if (!mine) return null;
    const higher = rows.filter((row) => Number(row.score ?? 0) > Number(mine.score ?? 0)).length;
    return higher + 1;
  }, [headerGwLiveTable?.rows, meId]);
  const headerExpandedStats = React.useMemo(
    () =>
      buildHeaderExpandedStats({
        gwRank: showLiveHeaderScore ? liveGwRank : headerRanks?.gwRank?.rank ?? null,
        gwTotal: showLiveHeaderScore ? headerGwLiveTable?.rows?.length ?? null : headerRanks?.gwRank?.total ?? null,
      }),
    [headerGwLiveTable?.rows?.length, headerRanks?.gwRank?.rank, headerRanks?.gwRank?.total, liveGwRank, showLiveHeaderScore]
  );

  const [createJoinOpen, setCreateJoinOpen] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState('');
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [joining, setJoining] = React.useState(false);

  const [visibleLeagueIds, setVisibleLeagueIds] = React.useState<Set<string>>(() => new Set());
  const [initialLoadTimedOut, setInitialLoadTimedOut] = React.useState(false);
  React.useEffect(() => {
    const loading = isLoading && !data && !error;
    if (!loading) {
      setInitialLoadTimedOut(false);
      return;
    }
    const id = setTimeout(() => setInitialLoadTimedOut(true), 15_000);
    return () => clearTimeout(id);
  }, [isLoading, data, error]);
  const refreshing = pullRefreshing;
  const onRefresh = React.useCallback(async () => {
    if (pullRefreshing) return;
    setPullRefreshing(true);
    try {
      await Promise.allSettled([
        withTimeout(refetch(), 8000),
        withTimeout(refetchHome(), 8000),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [pullRefreshing, refetch, refetchHome]);
  const renderCreateJoinHeaderButton = React.useCallback(
    () => (
      <Pressable
        onPress={() => {
          setJoinError(null);
          setCreateJoinOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Create or join mini league"
        style={({ pressed }) => ({
          width: 30,
          height: 38,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.86 : 1,
        })}
      >
        <Ionicons name="add" size={24} color={t.color.muted} />
      </Pressable>
    ),
    [t.color.muted]
  );
  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 35 }).current;
  const onViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: LeagueSummary; index: number | null; isViewable: boolean }> }) => {
      const leagueList: LeagueSummary[] = sortedLeaguesRef.current ?? [];
      const next = new Set<string>();

      viewableItems.forEach((vi) => {
        if (!vi?.isViewable) return;
        const item = vi.item;
        if (item?.id) next.add(String(item.id));
        const idx = typeof vi.index === 'number' ? vi.index : null;
        if (idx === null) return;
        const prev = leagueList[idx - 1];
        const nextItem = leagueList[idx + 1];
        if (prev?.id) next.add(String(prev.id));
        if (nextItem?.id) next.add(String(nextItem.id));
      });

      setVisibleLeagueIds((prev) => {
        if (prev.size === next.size) {
          let same = true;
          for (const id of prev) {
            if (!next.has(id)) {
              same = false;
              break;
            }
          }
          if (same) return prev;
        }
        return next;
      });
    }
  ).current;

  React.useEffect(() => {
    if (sortedLeagues.length <= 1) {
      if (activeLiveRailIndex !== 0) setActiveLiveRailIndex(0);
      liveRailProgress.value = 0;
      return;
    }
    const maxIndex = sortedLeagues.length - 1;
    if (activeLiveRailIndex > maxIndex) {
      setActiveLiveRailIndex(maxIndex);
      liveRailProgress.value = maxIndex;
    }
  }, [activeLiveRailIndex, sortedLeagues.length, liveRailProgress]);

  // Initial/empty load: avoid rendering an empty list shell.
  const showInitialSpinner = isLoading && !data && !error && !initialLoadTimedOut;
  if (isLoading && !data && !error) {
    return (
      <Screen fullBleed>
        <AppTopHeader
          onPressChat={() => navigation.navigate('ChatHub')}
          onPressProfile={() => navigation.navigate('Profile')}
          avatarUrl={avatarUrl}
          title={showLiveHeaderScore || showStaticResultsHeaderScore || showHeaderTotlLogo ? undefined : 'Mini Leagues'}
          centerContent={
            showLiveHeaderScore && headerScoreLabel ? (
              <HeaderLiveScore
                scoreLabel={headerScoreLabel}
                fill
                tickerEvent={headerTickerEvent ?? undefined}
                tickerEventKey={headerTickerEventKey}
                expandedStats={headerExpandedStats}
              />
            ) : showStaticResultsHeaderScore && headerScoreLabel ? (
              <HeaderLiveScore scoreLabel={headerScoreLabel} fill live={false} expandedStats={headerExpandedStats} />
            ) : undefined
          }
          rightAction={renderCreateJoinHeaderButton()}
          hasLiveGames={gwState === 'LIVE'}
          showLeftLiveBadge={!showLiveHeaderScore && !showStaticResultsHeaderScore}
        />
        {showInitialSpinner ? (
          <CenteredSpinner loading />
        ) : (
          <View style={{ flex: 1, padding: t.space[4], justifyContent: 'center' }}>
            <Card style={{ padding: 16 }}>
              <TotlText variant="heading" style={{ marginBottom: 8 }}>Taking longer than expected</TotlText>
              <TotlText variant="muted" style={{ marginBottom: 12 }}>Pull down to retry, or check your connection.</TotlText>
              <Pressable
                onPress={() => refetch()}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: t.color.brand,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <TotlText style={{ color: '#FFFFFF', fontFamily: t.font.medium, textAlign: 'center' }}>Retry</TotlText>
              </Pressable>
            </Card>
          </View>
        )}
        <CreateJoinLeagueSheet
          open={createJoinOpen}
          onClose={() => setCreateJoinOpen(false)}
          joinCode={joinCode}
          setJoinCode={(next) => {
            setJoinError(null);
            setJoinCode(next);
          }}
          joinError={joinError}
          joining={joining}
          onPressCreate={() => {
            setCreateJoinOpen(false);
            navigation.navigate('CreateLeague');
          }}
          onPressJoin={() => {
            if (joining) return;
            const code = joinCode.trim().toUpperCase();
            setJoinError(null);
            setJoining(true);
            void (async () => {
              const res = await joinLeagueByCode(code);
              if (!res.ok) {
                setJoinError(res.error);
                setJoining(false);
                return;
              }
              setJoining(false);
              setCreateJoinOpen(false);
              setJoinCode('');
              await queryClient.invalidateQueries({ queryKey: ['leagues'] });
              navigation.navigate('LeagueDetail', { leagueId: res.league.id, name: res.league.name } as const);
            })();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen fullBleed>
      <AppTopHeader
        onPressChat={() => navigation.navigate('ChatHub')}
        onPressProfile={() => navigation.navigate('Profile')}
        avatarUrl={avatarUrl}
        title={showLiveHeaderScore || showStaticResultsHeaderScore || showHeaderTotlLogo ? undefined : 'Mini Leagues'}
        centerContent={
          showLiveHeaderScore && headerScoreLabel ? (
            <HeaderLiveScore
              scoreLabel={headerScoreLabel}
              fill
              tickerEvent={headerTickerEvent ?? undefined}
              tickerEventKey={headerTickerEventKey}
                expandedStats={headerExpandedStats}
            />
          ) : showStaticResultsHeaderScore && headerScoreLabel ? (
              <HeaderLiveScore scoreLabel={headerScoreLabel} fill live={false} expandedStats={headerExpandedStats} />
          ) : undefined
        }
        rightAction={renderCreateJoinHeaderButton()}
        hasLiveGames={gwState === 'LIVE'}
        showLeftLiveBadge={!showLiveHeaderScore && !showStaticResultsHeaderScore}
      />

      <FlatList
        ref={listRef}
        data={showListView ? listLeagues : []}
        style={{ flex: 1 }}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: t.space[4],
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
        }}
        refreshControl={<TotlRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListHeaderComponent={
          <>
            {showTopLiveRail ? (
              <View style={{ marginBottom: 14 }}>
                {showTablesView ? (
                  <>
                    {canToggleLiveLayout ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 10,
                        }}
                      >
                        <TotlText
                          style={{
                            flex: 1,
                            color: t.color.text,
                            fontSize: 22,
                            lineHeight: 22,
                          }}
                        >
                          Gameweek {viewingGw} {gwState === 'LIVE' ? 'Live ' : ''}Tables
                        </TotlText>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: 'rgba(148,163,184,0.26)',
                            backgroundColor: t.color.surface,
                            padding: 4,
                          }}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Mini cards view"
                            onPress={() => setLiveTablesLayout('mini')}
                            style={({ pressed }) => ({
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: liveTablesLayout === 'mini' ? 'rgba(28,131,118,0.14)' : 'transparent',
                              opacity: pressed ? 0.86 : 1,
                            })}
                          >
                            <Ionicons name="grid-outline" size={18} color={liveTablesLayout === 'mini' ? '#1C8376' : '#475569'} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Expanded cards view"
                            onPress={() => setLiveTablesLayout('expanded')}
                            style={({ pressed }) => ({
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: liveTablesLayout === 'expanded' ? 'rgba(28,131,118,0.14)' : 'transparent',
                              opacity: pressed ? 0.86 : 1,
                            })}
                          >
                            <Ionicons name="tablet-landscape-outline" size={18} color={liveTablesLayout === 'expanded' ? '#1C8376' : '#475569'} />
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                    {(() => {
                      const isExpanded = liveTablesLayout === 'expanded';
                      const cardWidth = isExpanded ? screenWidth - t.space[4] * 2 : (screenWidth - t.space[4] * 2 - 12) / 2;
                      const getEstHeight = (l: LeagueSummary) => (isDevFakeLeagueId(String(l.id)) ? 8 : 3);
                      const sorted = [...listLeagues].sort((a, b) => getEstHeight(b) - getEstHeight(a));
                      const cols: LeagueSummary[][] = [[], []];
                      const colHeights = [0, 0];
                      for (const league of sorted) {
                        const h = getEstHeight(league) * 40;
                        const i = colHeights[0] <= colHeights[1] ? 0 : 1;
                        cols[i].push(league);
                        colHeights[i] += h;
                      }
                      const renderCard = (league: LeagueSummary) => {
                        const leagueId = String(league.id);
                        return (
                          <Reanimated.View
                            key={`live-${leagueId}`}
                            layout={liveLayoutTransition}
                            style={{
                              paddingHorizontal: 6,
                              marginBottom: 12,
                            }}
                          >
                            <MiniLeagueLiveCard
                              leagueId={leagueId}
                              leagueName={String(league.name ?? '')}
                              leagueAvatar={typeof league.avatar === 'string' ? league.avatar : null}
                              gw={viewingGw as number}
                              width={cardWidth}
                              enabled
                              compact={!isExpanded}
                              currentUserId={meId}
                              onPress={() =>
                                navigation.navigate(
                                  'LeagueDetail',
                                  { leagueId: league.id, name: league.name, initialTab: 'predictions' } satisfies RootStackParamList['LeagueDetail']
                                )
                              }
                            />
                          </Reanimated.View>
                        );
                      };
                      if (isExpanded) {
                        return (
                          <Reanimated.View layout={liveLayoutTransition} style={{ marginHorizontal: -6 }}>
                            {listLeagues.map(renderCard)}
                          </Reanimated.View>
                        );
                      }
                      return (
                        <Reanimated.View
                          layout={liveLayoutTransition}
                          style={{ flexDirection: 'row', marginHorizontal: -6 }}
                        >
                          <View style={{ flex: 1 }}>{cols[0].map(renderCard)}</View>
                          <View style={{ flex: 1 }}>{cols[1].map(renderCard)}</View>
                        </Reanimated.View>
                      );
                    })()}
                  </>
                ) : null}
              </View>
            ) : null}
            {error && (
              <Card style={{ marginBottom: 12 }}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Couldn’t load leagues
                </TotlText>
                <TotlText variant="muted">{(error as Error)?.message ?? 'Unknown error'}</TotlText>
              </Card>
            )}
          </>
        }
        ListEmptyComponent={
          showListView && !isLoading && !error ? (
            <Card>
              <TotlText variant="heading" style={{ marginBottom: 6 }}>
                No leagues yet
              </TotlText>
              <TotlText variant="muted">Once you join or create one, it’ll show up here.</TotlText>
            </Card>
          ) : null
        }
        ListFooterComponent={
          <>
            {showListView && (data?.leagues?.length ?? 0) > 0 ? (
              <View style={{ marginTop: 14, marginBottom: 6 }}>
                <Pressable
                  onPress={() => {
                    setJoinError(null);
                    setCreateJoinOpen(true);
                  }}
                  style={({ pressed }) => ({
                    width: '100%',
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    backgroundColor: t.color.brand,
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <TotlText style={{ color: '#FFFFFF', fontFamily: t.font.medium, textAlign: 'center' }}>Create or Join</TotlText>
                </Pressable>
              </View>
            ) : null}
            {__DEV__ ? (
              <View style={{ marginTop: 10 }}>
                <TotlText variant="muted">Dev: BFF {String(env.EXPO_PUBLIC_BFF_URL)}</TotlText>
                <TotlText variant="muted">
                  Dev: Auth token {hasAccessToken === null ? 'unknown' : hasAccessToken ? 'present' : 'missing'}
                </TotlText>
              </View>
            ) : null}
          </>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => {
          const leagueId = String(item.id);
          const enabled = visibleLeagueIds.has(leagueId);

          return (
            <LeagueRow
              league={item}
              enabled={enabled}
              currentGw={currentGw}
              meId={meId ?? null}
              fallbackMeId={unreadMeId ?? null}
              onPress={() => {
                navigation.navigate(
                  'LeagueDetail',
                  { leagueId: item.id, name: item.name, initialTab: 'predictions' } satisfies RootStackParamList['LeagueDetail']
                );
              }}
            />
          );
        }}
      />

      <CreateJoinLeagueSheet
        open={createJoinOpen}
        onClose={() => setCreateJoinOpen(false)}
        joinCode={joinCode}
        setJoinCode={(next) => {
          setJoinError(null);
          setJoinCode(next);
        }}
        joinError={joinError}
        joining={joining}
        onPressCreate={() => {
          setCreateJoinOpen(false);
          // Route will be added in `LeaguesNavigator` as part of the plan.
          navigation.navigate('CreateLeague');
        }}
        onPressJoin={() => {
          if (joining) return;
          const code = joinCode.trim().toUpperCase();
          setJoinError(null);
          setJoining(true);
          void (async () => {
            const res = await joinLeagueByCode(code);
            if (!res.ok) {
              setJoinError(res.error);
              setJoining(false);
              return;
            }
            setJoining(false);
            setCreateJoinOpen(false);
            setJoinCode('');
            await queryClient.invalidateQueries({ queryKey: ['leagues'] });
            navigation.navigate('LeagueDetail', { leagueId: res.league.id, name: res.league.name } as const);
          })();
        }}
      />
    </Screen>
  );
}

