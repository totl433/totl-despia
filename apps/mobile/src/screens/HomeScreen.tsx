import React from 'react';
import { Animated, FlatList, type ImageSourcePropType, Image, Pressable, RefreshControl, Share, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import type { Fixture, GwResultRow, HomeRanks, HomeSnapshot, LiveScore, LiveStatus, Pick, RankBadge } from '@totl/domain';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import FixtureCard from '../components/FixtureCard';
import MiniLeagueCard from '../components/MiniLeagueCard';
import MiniLeaguesDefaultList from '../components/MiniLeaguesDefaultList';
import { getGameweekStateFromSnapshot, type GameweekState } from '../lib/gameweekState';
import PickPill from '../components/home/PickPill';
import RoundIconButton from '../components/home/RoundIconButton';
import SectionHeaderRow from '../components/home/SectionHeaderRow';
import SectionTitle from '../components/home/SectionTitle';
import { LeaderboardCardLastGw, LeaderboardCardSimple } from '../components/home/LeaderboardCards';

type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;
type LeagueSummary = LeaguesResponse['leagues'][number];

function getErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function formatMinute(status: LiveStatus, minute: number | null | undefined) {
  if (status === 'FINISHED') return 'FT';
  if (status === 'PAUSED') return 'HT';
  if (status === 'IN_PLAY') return typeof minute === 'number' ? `${minute}'` : 'LIVE';
  return '';
}

function formatKickoffUtc(kickoff: string | null | undefined) {
  if (!kickoff) return '—';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function fixtureDateLabel(kickoff: string | null | undefined) {
  if (!kickoff) return 'No date';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function HomeScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();

  const {
    data: home,
    isLoading: homeLoading,
    error: homeError,
    refetch: refetchHome,
    isRefetching: homeRefetching,
  } = useQuery<HomeSnapshot>({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });

  const isHomeLoading = Boolean(homeLoading);

  const {
    data: leagues,
    error: leaguesError,
    refetch: refetchLeagues,
    isRefetching: leaguesRefetching,
  } = useQuery<LeaguesResponse>({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  const { data: ranks } = useQuery<HomeRanks>({
    queryKey: ['homeRanks'],
    queryFn: () => api.getHomeRanks(),
  });

  const fixtures: Fixture[] = home?.fixtures ?? [];
  const userPicks: Record<string, Pick> = home?.userPicks ?? {};

  const resultByFixtureIndex = React.useMemo(() => {
    const m = new Map<number, Pick>();
    (home?.gwResults ?? []).forEach((r: GwResultRow) => m.set(r.fixture_index, r.result));
    return m;
  }, [home?.gwResults]);

  const liveByFixtureIndex = React.useMemo(() => {
    const m = new Map<number, LiveScore>();
    if (!home) return m;
    const apiMatchIdToFixtureIndex = new Map<number, number>();
    home.fixtures.forEach((f: Fixture) => {
      if (typeof f.api_match_id === 'number') apiMatchIdToFixtureIndex.set(f.api_match_id, f.fixture_index);
    });
    (home.liveScores ?? []).forEach((ls: LiveScore) => {
      const idx =
        typeof ls.fixture_index === 'number'
          ? ls.fixture_index
          : typeof ls.api_match_id === 'number'
            ? apiMatchIdToFixtureIndex.get(ls.api_match_id)
            : undefined;
      if (typeof idx !== 'number') return;
      m.set(idx, ls);
    });
    return m;
  }, [home]);

  const fixturesByDate = React.useMemo(() => {
    const groups = new Map<string, Fixture[]>();
    fixtures.forEach((f: Fixture) => {
      const key = fixtureDateLabel(f.kickoff_time ?? null);
      const arr = groups.get(key) ?? [];
      arr.push(f);
      groups.set(key, arr);
    });

    // Sort fixtures within each group by fixture_index (matches web’s stable ordering)
    groups.forEach((arr, key) => {
      groups.set(
        key,
        [...arr].sort((a, b) => Number(a?.fixture_index ?? 0) - Number(b?.fixture_index ?? 0))
      );
    });

    // Sort chronologically when possible (like web)
    const keys = Array.from(groups.keys()).sort((a, b) => {
      if (a === 'No date') return 1;
      if (b === 'No date') return -1;
      const a0 = groups.get(a)?.[0]?.kickoff_time;
      const b0 = groups.get(b)?.[0]?.kickoff_time;
      const da = a0 ? new Date(a0).getTime() : Number.POSITIVE_INFINITY;
      const db = b0 ? new Date(b0).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    });

    return keys.map((k) => ({ date: k, fixtures: groups.get(k) ?? [] }));
  }, [fixtures]);

  // Match web: only show per-date section headers when there are multiple dates in the GW.
  // Otherwise it duplicates the date already shown under the GW header.
  const showFixtureDateSections = fixturesByDate.length > 1;

  const scoreSummary = React.useMemo(() => {
    if (!fixtures.length) return null;

    let started = 0;
    let live = 0;
    let correct = 0;
    for (const f of fixtures) {
      const fixtureIndex = f.fixture_index;
      const pick = userPicks[String(fixtureIndex)];

      const ls = liveByFixtureIndex.get(fixtureIndex);
      const st: LiveStatus = ls?.status ?? 'SCHEDULED';
      const isStarted = st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED';
      if (!isStarted) continue;
      started += 1;
      if (st === 'IN_PLAY' || st === 'PAUSED') live += 1;

      if (!pick) continue;

      const resultFromDb = resultByFixtureIndex.get(fixtureIndex);
      const hs = Number(ls?.home_score ?? 0);
      const as = Number(ls?.away_score ?? 0);

      const outcome: Pick | null =
        resultFromDb ?? (hs > as ? 'H' : hs < as ? 'A' : 'D');

      if (outcome === pick) correct += 1;
    }

    return { started, live, correct, total: fixtures.length };
  }, [fixtures, liveByFixtureIndex, resultByFixtureIndex, userPicks]);

  const refreshing = homeRefetching || leaguesRefetching;
  const onRefresh = () => {
    void Promise.all([refetchHome(), refetchLeagues()]);
  };
  const [visibleLeagueIds, setVisibleLeagueIds] = React.useState<Set<string>>(() => new Set());
  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 45 }).current;
  const onViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: LeagueSummary; index: number | null; isViewable: boolean }> }) => {
      const leagueList: LeagueSummary[] = leagues?.leagues ?? [];
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

      // Avoid churn: only update state when membership changes.
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

  // SectionTitle/RoundIconButton/PickPill/SectionHeaderRow/LeaderboardCards are extracted into `src/components/home/*`.

  const LB_BADGE_5 = require('../../../../dist/assets/5-week-form-badge.png');
  const LB_BADGE_10 = require('../../../../dist/assets/10-week-form-badge.png');
  const LB_BADGE_SEASON = require('../../../../dist/assets/season-rank-badge.png');

  function leaderboardBadgeFor(title: string): ImageSourcePropType | null {
    const t = title.toUpperCase();
    if (t.includes('5')) return LB_BADGE_5;
    if (t.includes('10')) return LB_BADGE_10;
    if (t.includes('SEASON')) return LB_BADGE_SEASON;
    return null;
  }

  function leaderboardIconText(title: string): string {
    const t = title.toUpperCase();
    if (t.includes('GW')) return 'GW';
    if (t.includes('5')) return '5';
    if (t.includes('10')) return '10';
    if (t.includes('SEASON')) return 'S';
    return '—';
  }

  // Leaderboard cards and pills are now shared components.

  const FixtureCardRow = ({ f }: { f: Fixture }) => (
    <FixtureCard
      fixture={f}
      liveScore={liveByFixtureIndex.get(f.fixture_index) ?? null}
      pick={userPicks[String(f.fixture_index)]}
      result={resultByFixtureIndex.get(Number(f.fixture_index)) ?? null}
      showPickButtons={!!home?.hasSubmittedViewingGw}
    />
  );

  function HomeMiniLeagueCardItem({
    league,
    index,
    totalCount,
  }: {
    league: LeagueSummary;
    index: number;
    totalCount: number;
  }) {
    const leagueId = String(league.id);
    const enabled = !!viewingGw && visibleLeagueIds.has(leagueId);

    const { data: table, isLoading } = useQuery({
      enabled,
      queryKey: ['leagueGwTable', leagueId, viewingGw],
      queryFn: () => api.getLeagueGwTable(leagueId, viewingGw!),
    });

    const rows = table?.rows?.slice(0, 4) ?? [];
    const winnerName = rows?.[0]?.name as string | undefined;
    const isDraw =
      rows.length >= 2 &&
      Number(rows[0]?.score ?? 0) === Number(rows[1]?.score ?? 0) &&
      Number(rows[0]?.unicorns ?? 0) === Number(rows[1]?.unicorns ?? 0);
    const winnerChip = rows.length ? (isDraw ? 'Draw!' : winnerName ? `${winnerName} Wins!` : null) : null;
    const avatarUri = typeof league.avatar === 'string' && league.avatar.startsWith('http') ? league.avatar : null;
    const showUnicorns = (table?.totalMembers ?? 0) >= 3;

    const emptyLabel = !viewingGw
      ? '—'
      : !visibleLeagueIds.has(leagueId)
        ? 'Swipe to load…'
        : isLoading
          ? 'Loading table…'
          : 'No table yet.';

    return (
      <Pressable
        onPress={() =>
          navigation.navigate('Leagues', {
            screen: 'LeagueDetail',
            params: { leagueId: league.id, name: league.name },
          })
        }
        style={({ pressed }) => ({
          opacity: pressed ? 0.96 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <View style={{ marginRight: index === totalCount - 1 ? 0 : 12 }}>
          <MiniLeagueCard
            title={String(league.name ?? '')}
            avatarUri={avatarUri}
            gwIsLive={gwIsLive}
            winnerChip={winnerChip}
            rows={rows}
            showUnicorns={showUnicorns}
            emptyLabel={emptyLabel}
          />
        </View>
      </Pressable>
    );
  }

  const handleShare = async () => {
    try {
      const gw = home?.viewingGw ?? home?.currentGw ?? null;
      const line1 = gw ? `TOTL — Gameweek ${gw}` : 'TOTL';
      const line2 =
        home && scoreSummary && home.hasSubmittedViewingGw
          ? `My score: ${scoreSummary.correct}/${scoreSummary.total}`
          : 'Join me on TOTL.';
      await Share.share({ message: `${line1}\n${line2}` });
    } catch {
      // ignore
    }
  };

  const viewingGwLabel = home?.viewingGw ? `Gameweek ${home.viewingGw}` : 'Gameweek';
  const viewingGwSubtitle = React.useMemo(() => {
    // If we are already rendering date section headers, don't duplicate the date under the GW title.
    if (showFixtureDateSections) return undefined;
    // Match the web’s “Sat 17 Jan” feel when possible.
    const first = fixtures.find((f) => f.kickoff_time)?.kickoff_time;
    if (!first) return undefined;
    const d = new Date(first);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  }, [fixtures, showFixtureDateSections]);

  const scorePill = React.useMemo(() => {
    if (!scoreSummary) {
      return { label: 'Score', score: '--', total: '--', bg: t.color.surface2, border: t.color.border, dot: false };
    }
    const label = scoreSummary.live > 0 ? 'Live' : 'Score';
    const score = home?.hasSubmittedViewingGw ? String(scoreSummary.correct) : '--';
    const total = String(scoreSummary.total);
    if (label === 'Live') return { label, score, total, bg: '#DC2626', border: 'transparent', dot: true };
    return { label, score, total, bg: t.color.surface2, border: t.color.border, dot: false };
  }, [home?.hasSubmittedViewingGw, scoreSummary, t.color.border, t.color.surface2]);

  const gwIsLive = (scoreSummary?.live ?? 0) > 0;
  const viewingGw = home?.viewingGw ?? null;

  const totlLogoUri = React.useMemo(() => {
    return Asset.fromModule(require('../../../../public/assets/badges/totl-logo1.svg')).uri;
  }, []);

  const gwState: GameweekState | null = React.useMemo(() => {
    if (!home) return null;
    return getGameweekStateFromSnapshot({
      fixtures: home.fixtures ?? [],
      liveScores: home.liveScores ?? [],
      hasSubmittedViewingGw: !!home.hasSubmittedViewingGw,
    });
  }, [home]);

  const showMlToggleButtons = gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
  const [showLiveTables, setShowLiveTables] = React.useState<boolean>(showMlToggleButtons);
  const prevGwRef = React.useRef<number | null>(viewingGw);

  React.useEffect(() => {
    if (prevGwRef.current !== null && viewingGw !== null && prevGwRef.current !== viewingGw) {
      setShowLiveTables(false);
    }
    prevGwRef.current = viewingGw;
  }, [viewingGw]);

  React.useEffect(() => {
    if (showMlToggleButtons) setShowLiveTables(true);
  }, [showMlToggleButtons]);

  const errorMessage = homeError ? getErrorMessage(homeError) : leaguesError ? getErrorMessage(leaguesError) : null;

  return (
    <Screen fullBleed>
      {/* Floating menu buttons (stay visible while scrolling) */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: t.space[2],
          right: t.space[4],
          zIndex: 50,
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          <RoundIconButton
            onPress={() => {}}
            icon={require('../../../../public/assets/Icons/School--Streamline-Outlined-Material-Pr0_White.png')}
          />
          <View style={{ width: 10 }} />
          <RoundIconButton
            onPress={() => navigation.navigate('Profile')}
            icon={require('../../../../public/assets/Icons/Person--Streamline-Outlined-Material-Pro_white.png')}
          />
        </View>
      </View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: 0,
          paddingBottom: t.space[12],
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.color.text} />}
      >
        {/* Header (scrolls with content) */}
        <View style={{ marginBottom: 12, paddingTop: 4, paddingBottom: 4, alignItems: 'center' }}>
          {/* Real TOTL logo (from web assets), simple + static */}
          <View>
            <SvgUri uri={totlLogoUri} width={165} height={77} />
          </View>
        </View>

        {isHomeLoading && <TotlText variant="muted">Loading…</TotlText>}

        {(homeError || leaguesError) && (
          <Card style={{ marginBottom: 12 }}>
            <TotlText variant="heading" style={{ marginBottom: 8 }}>
              Couldn’t load everything
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              {errorMessage ?? 'Unknown error'}
            </TotlText>
            <Button title="Retry" onPress={onRefresh} loading={refreshing} />
          </Card>
        )}

        {/* Results CTA like web (real gradient + pressed scale) */}
        {ranks?.latestGw ? (
          <Pressable
            onPress={() => {}}
            style={({ pressed }) => [
              {
                marginBottom: 14,
                borderRadius: 14,
                overflow: 'hidden',
                transform: [{ scale: pressed ? 0.985 : 1 }],
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 6,
              },
            ]}
          >
            <LinearGradient
              colors={['#10B981', '#0D9488']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TotlText style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18 }}>
                  Your Gameweek {ranks.latestGw} Results
                </TotlText>
                <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 22 }}>›</TotlText>
              </View>
            </LinearGradient>
          </Pressable>
        ) : null}

        {/* Leaderboards row (match web card structure) */}
        <View style={{ marginTop: 18, marginBottom: 12 }}>
          <TotlText variant="sectionTitle">Leaderboards</TotlText>
        </View>
        <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          {(() => {
            const gw = ranks?.latestGw ?? home?.viewingGw ?? null;
            const score = home?.hasSubmittedViewingGw && scoreSummary ? String(scoreSummary.correct) : '--';
            const total = scoreSummary ? String(scoreSummary.total) : String(fixtures.length || '--');
            const lastGwDisplay = ranks?.gwRank?.percentileLabel ? String(ranks.gwRank.percentileLabel) : 'Top —';

            const cards: Array<{ key: string; node: React.JSX.Element }> = [];

            cards.push({
              key: 'last-gw',
              node: (
                <LeaderboardCardLastGw
                  gw={gw}
                  score={score}
                  totalFixtures={total}
                  displayText={lastGwDisplay}
                  onPress={() => navigation.navigate('Global')}
                />
              ),
            });

            const add = (b: RankBadge | null | undefined, badge: ImageSourcePropType | null, title: string) => {
              if (!b) return;
              cards.push({
                key: title,
                node: (
                  <LeaderboardCardSimple
                    title={title}
                    badge={badge}
                    displayText={String(b.percentileLabel ?? 'Top —')}
                    onPress={() => navigation.navigate('Global')}
                  />
                ),
              });
            };

            add(ranks?.fiveWeekForm, LB_BADGE_5, '5-WEEK FORM');
            add(ranks?.tenWeekForm, LB_BADGE_10, '10-WEEK FORM');
            add(ranks?.seasonRank, LB_BADGE_SEASON, 'SEASON RANK');

            return cards.map((c, idx) => (
              <View key={c.key} style={{ marginRight: idx === cards.length - 1 ? 0 : 10 }}>
                {c.node}
              </View>
            ));
          })()}
        </Animated.ScrollView>

        {/* Mini leagues (match web order: before gameweek section) */}
        <View style={{ marginTop: 26 }}>
          <SectionHeaderRow
            title="Mini Leagues"
            subtitle={showLiveTables && home?.viewingGw ? `${viewingGwLabel} Live Tables` : undefined}
            right={
              showMlToggleButtons ? (
                <Pressable
                  onPress={() => setShowLiveTables((v) => !v)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: t.radius.pill,
                    backgroundColor: showLiveTables ? 'rgba(148,163,184,0.16)' : '#1C8376',
                    borderWidth: 1,
                    borderColor: showLiveTables ? 'rgba(148,163,184,0.18)' : 'rgba(255,255,255,0.18)',
                    opacity: pressed ? 0.88 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <TotlText variant="caption" style={{ fontWeight: '800', color: showLiveTables ? t.color.text : '#FFFFFF' }}>
                    {showLiveTables ? 'Default View' : 'View Live Tables'}
                  </TotlText>
                </Pressable>
              ) : null
            }
          />
        </View>
        {leagues?.leagues?.length ? showLiveTables ? (
          <FlatList<LeagueSummary>
            horizontal
            data={leagues.leagues}
            keyExtractor={(l) => String(l.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12 }}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            initialNumToRender={4}
            windowSize={4}
            removeClippedSubviews
            renderItem={({ item: l, index }) => (
              <HomeMiniLeagueCardItem league={l} index={index} totalCount={leagues.leagues.length} />
            )}
          />
        ) : (
          <MiniLeaguesDefaultList
            leagues={leagues.leagues.map((l) => ({
              id: String(l.id),
              name: String(l.name ?? ''),
              avatarUri: typeof l.avatar === 'string' && l.avatar.startsWith('http') ? l.avatar : null,
            }))}
            onLeaguePress={(leagueId, name) =>
              navigation.navigate('Leagues', {
                screen: 'LeagueDetail',
                params: { leagueId, name },
              })
            }
          />
        ) : (
          <Card style={{ marginBottom: 12 }}>
            <TotlText variant="muted">No leagues yet.</TotlText>
          </Card>
        )}

        {/* Gameweek section like web */}
        <View style={{ marginTop: 26 }}>
          <SectionHeaderRow
            title={viewingGwLabel}
            subtitle={viewingGwSubtitle}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => ({
                    minHeight: 40,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: t.radius.pill,
                    backgroundColor: t.color.brand,
                    marginRight: 10,
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <TotlText variant="caption" style={{ color: '#FFFFFF', fontWeight: '800' }}>
                    Share
                  </TotlText>
                </Pressable>
                <View
                  style={{
                    minHeight: 40,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: t.radius.pill,
                    backgroundColor: scorePill.bg,
                    borderWidth: scorePill.border === 'transparent' ? 0 : 1,
                    borderColor: scorePill.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {scorePill.dot ? (
                      <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: '#FFFFFF', marginRight: 8, opacity: 0.95 }} />
                    ) : null}
                    <TotlText
                      variant="caption"
                      style={{
                        fontWeight: '800',
                        color: scorePill.bg === '#DC2626' ? '#FFFFFF' : t.color.text,
                        letterSpacing: 0.4,
                      }}
                    >
                      {scorePill.label}{' '}
                      <TotlText
                        variant="caption"
                        style={{
                          fontWeight: '900',
                          color: scorePill.bg === '#DC2626' ? '#FFFFFF' : t.color.text,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {scorePill.score}/{scorePill.total}
                      </TotlText>
                    </TotlText>
                  </View>
                </View>
              </View>
            }
          />
        </View>

        {fixtures.length === 0 && !homeLoading ? (
          <Card
            style={{
              marginBottom: 12,
              padding: 0,
              shadowOpacity: 0,
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
              elevation: 0,
            }}
          >
            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <TotlText variant="muted">No fixtures yet. Pull to refresh.</TotlText>
            </View>
          </Card>
        ) : (
          fixturesByDate.map((g, groupIdx) => (
            <View
              key={`${g.date}-${groupIdx}`}
              style={{ marginBottom: groupIdx === fixturesByDate.length - 1 ? 0 : 12 }}
            >
              {/* Date headers should be outside the fixture cards (web-style sections). */}
              {showFixtureDateSections ? (
                <View style={{ paddingHorizontal: 2, paddingBottom: 8 }}>
                  <TotlText variant="sectionSubtitle">{g.date}</TotlText>
                </View>
              ) : null}

              <Card
                style={{
                  padding: 0,
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 0,
                }}
              >
                <View style={{ borderRadius: 14, overflow: 'hidden' }}>
                  {g.fixtures.map((f: Fixture, idx: number) => (
                    <View key={f.id} style={{ position: 'relative' }}>
                      {idx < g.fixtures.length - 1 ? (
                        <View
                          style={{
                            position: 'absolute',
                            left: 16,
                            right: 16,
                            bottom: 0,
                            height: 1,
                            backgroundColor: 'rgba(148,163,184,0.18)',
                            zIndex: 2,
                          }}
                        />
                      ) : null}
                      <FixtureCardRow f={f} />
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          ))
        )}
      </Animated.ScrollView>
    </Screen>
  );
}

