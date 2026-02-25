import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, TotlText, useTokens } from '@totl/ui';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { Image } from 'react-native';
import { LeaderboardCardResultsCta } from '../../components/home/LeaderboardCards';
import WinnerShimmer from '../../components/WinnerShimmer';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import PageHeader from '../../components/PageHeader';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

type SimGameState = 'GW_OPEN' | 'GW_PREDICTED' | 'DEADLINE_PASSED' | 'LIVE' | 'RESULTS_PRE_GW';
type SimFixtureStatus = 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED';
type Pick = 'H' | 'D' | 'A';

type SimFixture = {
  id: string;
  kickoff: string;
  kickoffDetail: string;
  home: string;
  away: string;
  homeCode: string;
  awayCode: string;
  pick: Pick | null;
  status: SimFixtureStatus;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  outcome?: Pick;
};

const GAME_STATES: SimGameState[] = ['GW_OPEN', 'GW_PREDICTED', 'DEADLINE_PASSED', 'LIVE', 'RESULTS_PRE_GW'];
const PICKS: Pick[] = ['H', 'D', 'A', 'H', 'A', 'D', 'H', 'D', 'A', 'H'];
const LB_BADGE_5 = require('../../../../../dist/assets/5-week-form-badge.png');
const MINI_LAYOUT_TRANSITION = LinearTransition.springify().damping(42).stiffness(260).mass(0.7);
const TEAMS: Array<{ name: string; code: string }> = [
  { name: 'Arsenal', code: 'ARS' },
  { name: 'Villa', code: 'AVL' },
  { name: 'Bournemouth', code: 'BOU' },
  { name: 'Brentford', code: 'BRE' },
  { name: 'Chelsea', code: 'CHE' },
  { name: 'Everton', code: 'EVE' },
  { name: 'Liverpool', code: 'LIV' },
  { name: 'Newcastle', code: 'NEW' },
  { name: 'Spurs', code: 'TOT' },
  { name: 'West Ham', code: 'WHU' },
  { name: 'Leeds', code: 'LEE' },
  { name: 'Brighton', code: 'BHA' },
];
const KICKOFFS = ['Sat 12:30', 'Sat 15:00', 'Sat 17:30', 'Sat 19:45', 'Sat 20:00', 'Sun 12:00', 'Sun 14:00', 'Sun 16:30', 'Sun 19:00', 'Mon 20:00'];
const KICKOFF_DETAILS = [
  'Sat 21 Feb • 12:30',
  'Sat 21 Feb • 15:00',
  'Sat 21 Feb • 17:30',
  'Sat 21 Feb • 19:45',
  'Sat 21 Feb • 20:00',
  'Sun 22 Feb • 12:00',
  'Sun 22 Feb • 14:00',
  'Sun 22 Feb • 16:30',
  'Sun 22 Feb • 19:00',
  'Mon 23 Feb • 20:00',
];

function resultForScore(homeScore: number, awayScore: number): Pick {
  if (homeScore > awayScore) return 'H';
  if (homeScore < awayScore) return 'A';
  return 'D';
}

function ordinalLabel(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return '—';
  const n = Math.trunc(Number(value));
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

function buildFixtures(state: SimGameState): SimFixture[] {
  return Array.from({ length: 10 }, (_, i) => {
    const home = TEAMS[i % TEAMS.length];
    const away = TEAMS[(i + 4) % TEAMS.length];
    const baseHome = i % 3;
    const baseAway = (i + 1) % 3;
    let status: SimFixtureStatus = 'SCHEDULED';
    let minute: number | undefined;
    let homeScore: number | undefined;
    let awayScore: number | undefined;

    if (state === 'LIVE') {
      if (i <= 2) {
        status = 'FINISHED';
        homeScore = baseHome + 1;
        awayScore = baseAway;
      } else if (i <= 6) {
        status = i % 2 === 0 ? 'PAUSED' : 'IN_PLAY';
        minute = i % 2 === 0 ? 45 : 7 + i * 8;
        homeScore = baseHome;
        awayScore = baseAway;
      }
    } else if (state === 'RESULTS_PRE_GW') {
      status = 'FINISHED';
      homeScore = baseHome + (i % 2);
      awayScore = baseAway;
    }

    const outcome =
      status === 'FINISHED' && typeof homeScore === 'number' && typeof awayScore === 'number'
        ? resultForScore(homeScore, awayScore)
        : undefined;

    return {
      id: `sim-${i + 1}`,
      kickoff: KICKOFFS[i],
      kickoffDetail: KICKOFF_DETAILS[i],
      home: home.name,
      away: away.name,
      homeCode: home.code,
      awayCode: away.code,
      pick: state === 'GW_OPEN' ? null : PICKS[i],
      status,
      minute,
      homeScore,
      awayScore,
      outcome,
    };
  });
}

export default function AdminHomeSimulatorScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const [state, setState] = React.useState<SimGameState>('GW_OPEN');
  const [gwOpenLayout, setGwOpenLayout] = React.useState<'mini' | 'compact'>('mini');
  const [viewMode, setViewMode] = React.useState<'compact' | 'details'>('compact');
  const [stateMenuOpen, setStateMenuOpen] = React.useState(false);
  const [expandedFixtureId, setExpandedFixtureId] = React.useState<string | null>(null);
  const [miniExpandedFixtureId, setMiniExpandedFixtureId] = React.useState<string | null>(null);
  const [cardHeightsById, setCardHeightsById] = React.useState<Record<string, number>>({});
  const { data: teamPositionsByCode } = useQuery({
    queryKey: ['predictions-team-positions-hp-sim'],
    queryFn: async () => {
      const fromPredictions = await api
        .getPredictions()
        .then((res) => {
          const out: Record<string, number> = {};
          const raw = (res?.teamPositions ?? {}) as Record<string, unknown>;
          Object.entries(raw).forEach(([code, positionRaw]) => {
            const normalizedCode = String(code ?? '').trim().toUpperCase();
            const position = Number(positionRaw);
            if (!normalizedCode) return;
            if (!Number.isFinite(position) || position <= 0) return;
            out[normalizedCode] = Math.trunc(position);
          });
          return out;
        })
        .catch(() => ({} as Record<string, number>));

      if (Object.keys(fromPredictions).length > 0) return fromPredictions;

      const { data: meta } = await supabase.from('app_meta').select('current_gw').eq('id', 1).maybeSingle();
      const currentGw = Number((meta as any)?.current_gw);
      const gwToTry = Number.isFinite(currentGw) && currentGw > 0 ? Math.trunc(currentGw) : null;

      const readPositionsForGw = async (gw: number) => {
        const { data } = await supabase.from('app_team_forms').select('team_code, league_position').eq('gw', gw);
        const out: Record<string, number> = {};
        (data ?? []).forEach((row: any) => {
          const code = String(row?.team_code ?? '').trim().toUpperCase();
          const pos = Number(row?.league_position);
          if (!code) return;
          if (!Number.isFinite(pos) || pos <= 0) return;
          out[code] = Math.trunc(pos);
        });
        return out;
      };

      if (gwToTry) {
        const fromCurrentGw = await readPositionsForGw(gwToTry);
        if (Object.keys(fromCurrentGw).length > 0) return fromCurrentGw;
      }

      const { data: latestWithPosition } = await supabase
        .from('app_team_forms')
        .select('gw')
        .not('league_position', 'is', null)
        .order('gw', { ascending: false })
        .limit(1);
      const fallbackGw = Number(latestWithPosition?.[0]?.gw);
      if (Number.isFinite(fallbackGw) && fallbackGw > 0) {
        return readPositionsForGw(Math.trunc(fallbackGw));
      }

      return {} as Record<string, number>;
    },
    staleTime: 60_000,
  });
  const fixtures = React.useMemo(() => buildFixtures(state), [state]);
  const fixturesByMiniDay = React.useMemo(() => {
    const dayOrder = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const orderMap = new Map(dayOrder.map((d, i) => [d, i]));
    const buckets = new Map<string, SimFixture[]>();
    fixtures.forEach((fixture) => {
      const [day] = String(fixture.kickoff ?? '').split(' ');
      const key = day || 'Fixtures';
      const arr = buckets.get(key) ?? [];
      arr.push(fixture);
      buckets.set(key, arr);
    });
    return Array.from(buckets.entries())
      .sort((a, b) => (orderMap.get(a[0]) ?? 999) - (orderMap.get(b[0]) ?? 999))
      .map(([day, list]) => {
        const first = list[0];
        const dateLabelFromDetail = String(first?.kickoffDetail ?? '').split('•')[0]?.trim();
        return { day, dateLabel: dateLabelFromDetail || day, fixtures: list };
      });
  }, [fixtures]);
  const supportsMiniCompactLayout =
    state === 'GW_OPEN' || state === 'GW_PREDICTED' || state === 'DEADLINE_PASSED' || state === 'LIVE' || state === 'RESULTS_PRE_GW';
  const isMiniLayoutSelected = supportsMiniCompactLayout && gwOpenLayout === 'mini' && viewMode !== 'details';
  const isAllExpandedMiniMode = isMiniLayoutSelected && miniExpandedFixtureId === '__all__';
  const isMiniToggleActive = isMiniLayoutSelected && !isAllExpandedMiniMode;
  const isExpandedToggleActive = isAllExpandedMiniMode || !isMiniLayoutSelected;
  const isCompactLayoutSelected = supportsMiniCompactLayout && gwOpenLayout === 'compact' && viewMode !== 'details';
  const isDetailsOnlyState = (state === 'GW_OPEN' || state === 'GW_PREDICTED') && isMiniLayoutSelected;
  const showAllExpanded = isCompactLayoutSelected ? false : isDetailsOnlyState || viewMode === 'details';
  const collapsedStackStep = state === 'GW_OPEN' ? 58 : 125;
  const renderedStackFixtures = fixtures;

  const expandedFixtureIndex = React.useMemo(() => {
    if (!expandedFixtureId) return -1;
    return renderedStackFixtures.findIndex((f) => f.id === expandedFixtureId);
  }, [expandedFixtureId, renderedStackFixtures]);
  const anyFixtureExpanded = !showAllExpanded && expandedFixtureIndex >= 0;
  const expandedFixtureKey = expandedFixtureIndex >= 0 ? renderedStackFixtures[expandedFixtureIndex]?.id : null;
  const expandedCardHeight = expandedFixtureKey ? cardHeightsById[expandedFixtureKey] ?? 168 : 168;
  const expandedStackPush = anyFixtureExpanded ? Math.max(0, expandedCardHeight - collapsedStackStep + 8) : 0;

  const stackContainerHeight = React.useMemo(() => {
    if (showAllExpanded) return undefined;
    const count = renderedStackFixtures.length;
    if (count === 0) return 0;
    const last = renderedStackFixtures[count - 1];
    const lastHeight = cardHeightsById[last.id] ?? 120;
    if (!anyFixtureExpanded || expandedFixtureIndex < 0) {
      return collapsedStackStep * (count - 1) + lastHeight;
    }
    const cardsAfterExpanded = count - expandedFixtureIndex - 1;
    return collapsedStackStep * (count - 1) + expandedStackPush * cardsAfterExpanded + lastHeight - collapsedStackStep;
  }, [
    anyFixtureExpanded,
    cardHeightsById,
    collapsedStackStep,
    expandedFixtureIndex,
    expandedStackPush,
    renderedStackFixtures,
    showAllExpanded,
  ]);

  const goBack = React.useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('AdminHome');
  }, [navigation]);

  React.useEffect(() => {
    setStateMenuOpen(false);
    if (viewMode === 'details' || isMiniLayoutSelected) {
      setExpandedFixtureId(null);
    }
    if (!isMiniLayoutSelected) {
      setMiniExpandedFixtureId(null);
    }
  }, [isMiniLayoutSelected, state, viewMode]);

  return (
    <Screen fullBleed>
      <PageHeader
        title="HP Simulator"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={goBack}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={24} color={t.color.text} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: t.space[4], paddingTop: t.space[4], paddingBottom: 24 }}>
        <View style={{ marginBottom: 10, zIndex: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TotlText style={{ fontSize: 13, fontWeight: '700', color: t.color.muted }}>Game State</TotlText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open game state menu"
              onPress={() => setStateMenuOpen((prev) => !prev)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 999,
                borderWidth: 1,
                borderColor: 'rgba(28,131,118,0.28)',
                backgroundColor: 'rgba(28,131,118,0.08)',
                paddingHorizontal: 10,
                paddingVertical: 6,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <TotlText style={{ fontSize: 12, fontWeight: '800', color: t.color.brand }}>{state}</TotlText>
              <View style={{ width: 6 }} />
              <Ionicons name={stateMenuOpen ? 'chevron-up' : 'chevron-down'} size={14} color={t.color.brand} />
            </Pressable>
          </View>

          {stateMenuOpen ? (
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: 42,
                width: 190,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: t.color.border,
                backgroundColor: t.color.surface,
                shadowColor: '#0F172A',
                shadowOpacity: 0.04,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
                zIndex: 60,
              }}
            >
              {GAME_STATES.map((s, idx) => {
                const active = s === state;
                return (
                  <Pressable
                    key={s}
                    onPress={() => {
                      setState(s);
                      setStateMenuOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: t.color.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <TotlText style={{ fontSize: 12, fontWeight: active ? '800' : '600', color: active ? t.color.brand : t.color.muted }}>{s}</TotlText>
                    {active ? <Ionicons name="checkmark" size={16} color={t.color.brand} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {state === 'GW_OPEN' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to predictions"
            onPress={() => {
              const parent = navigation.getParent?.();
              parent?.navigate?.('PredictionsTestFlow');
            }}
            style={({ pressed }) => ({
              backgroundColor: '#e9f0ef',
              borderRadius: 16,
              paddingVertical: 10,
              paddingHorizontal: 12,
              marginBottom: 10,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexShrink: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: t.color.brand,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                    }}
                  >
                    <TotlText style={{ color: '#FFFFFF', fontSize: 10, lineHeight: 10 }}>!</TotlText>
                  </View>
                  <TotlText style={{ fontFamily: 'Gramatika-Bold', fontWeight: '700', fontSize: 16, lineHeight: 18 }}>
                    Gameweek Predictions
                  </TotlText>
                </View>
                <TotlText variant="muted" style={{ marginLeft: 30 }}>
                  Deadline{' '}
                  <TotlText style={{ color: t.color.brand, fontWeight: '700' }}>
                    {fixtures[0]?.kickoff ?? 'TBD'}
                  </TotlText>
                </TotlText>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: t.radius.pill,
                    backgroundColor: t.color.brand,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Medium', fontWeight: '500' }}>Go</TotlText>
                  <View style={{ width: 6 }} />
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </View>
              </View>
            </View>
          </Pressable>
        ) : null}

        <View style={{ marginBottom: 12 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -t.space[4] }}
            contentContainerStyle={{ paddingHorizontal: t.space[4], paddingBottom: 8 }}
          >
            <View style={{ marginRight: 10 }}>
              <LeaderboardCardResultsCta
                gw={27}
                badge={LB_BADGE_5}
                label="Ready to predict (...)"
                onPress={() => {
                  const parent = navigation.getParent?.();
                  parent?.navigate?.('PredictionsTestFlow');
                }}
              />
            </View>
            <LeaderboardCardResultsCta
              topLabel="OVERALL"
              badge={LB_BADGE_5}
              tone="light"
              showSheen={false}
              label="Your Performance"
              onPress={() => {}}
            />
          </ScrollView>
        </View>

        <View style={{ position: 'relative' }}>
          <View style={{ marginBottom: 10, zIndex: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 22, lineHeight: 22, color: t.color.text }}>
              Gameweek 39
            </TotlText>
            {supportsMiniCompactLayout || !isDetailsOnlyState ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: t.color.border,
                  backgroundColor: t.color.surface,
                  padding: 4,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mini view"
                  onPress={() => {
                    if (supportsMiniCompactLayout) {
                      setGwOpenLayout('mini');
                      setViewMode('compact');
                      setMiniExpandedFixtureId(null);
                    }
                  }}
                  style={({ pressed }) => ({
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isMiniToggleActive ? 'rgba(28,131,118,0.14)' : 'transparent',
                    opacity: pressed ? 0.86 : 1,
                  })}
                >
                  <Ionicons name="grid-outline" size={18} color={isMiniToggleActive ? t.color.brand : t.color.muted} />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Expanded view"
                  onPress={() => {
                    // Expanded toggle = Mini layout with all cards expanded.
                    if (supportsMiniCompactLayout) {
                      setGwOpenLayout('mini');
                      setViewMode('compact');
                      setMiniExpandedFixtureId('__all__');
                      return;
                    }
                    setViewMode('details');
                  }}
                  style={({ pressed }) => ({
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isExpandedToggleActive ? 'rgba(28,131,118,0.14)' : 'transparent',
                    opacity: pressed ? 0.86 : 1,
                  })}
                >
                  <Ionicons name="tablet-landscape-outline" size={18} color={isExpandedToggleActive ? t.color.brand : t.color.muted} />
                </Pressable>
              </View>
            ) : (
              <View style={{ width: 48, height: 48 }} />
            )}
          </View>
          {isMiniLayoutSelected ? (
            <View>
              {fixturesByMiniDay.map((section, sectionIdx) => {
                return (
                <Animated.View
                  key={`mini-day-${section.day}`}
                  layout={MINI_LAYOUT_TRANSITION}
                  style={{
                    marginBottom: sectionIdx === fixturesByMiniDay.length - 1 ? 0 : 8,
                  }}
                >
                  <View style={{ marginBottom: 10, zIndex: 1 }}>
                    <TotlText style={{ fontSize: 17, lineHeight: 21, fontWeight: '800', color: t.color.text }}>{section.dateLabel}</TotlText>
                  </View>
                  <Animated.View layout={MINI_LAYOUT_TRANSITION} style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, zIndex: 20 }}>
                    {section.fixtures.map((fixture, idx) => {
                      const homeBadge = TEAM_BADGES[fixture.homeCode] ?? null;
                      const awayBadge = TEAM_BADGES[fixture.awayCode] ?? null;
                      const miniPick: Pick | null = fixture.pick;
                      const isMiniExpanded = miniExpandedFixtureId === '__all__' || miniExpandedFixtureId === fixture.id;
                      const [, miniTimeRaw] = fixture.kickoff.split(' ');
                      const miniTime = miniTimeRaw ?? '';
                      const hasMiniScore = typeof fixture.homeScore === 'number' && typeof fixture.awayScore === 'number';
                      const miniLiveOutcome: Pick | null = hasMiniScore
                        ? fixture.homeScore! > fixture.awayScore!
                          ? 'H'
                          : fixture.homeScore! < fixture.awayScore!
                            ? 'A'
                            : 'D'
                        : null;
                      const isLiveOrResultsMini = state === 'LIVE' || state === 'RESULTS_PRE_GW';
                      const miniLivePickCorrect = isLiveOrResultsMini && !!miniPick && !!miniLiveOutcome && miniPick === miniLiveOutcome;
                      const miniLivePickIncorrect = isLiveOrResultsMini && !!miniPick && !!miniLiveOutcome && miniPick !== miniLiveOutcome;
                      const miniPrimaryLabel = hasMiniScore ? `${fixture.homeScore}-${fixture.awayScore}` : miniTime;
                      const miniPrimaryExpandedLabel = isMiniExpanded && hasMiniScore ? `${fixture.homeScore} - ${fixture.awayScore}` : miniPrimaryLabel;
                      const miniSecondaryLabel =
                        fixture.status === 'IN_PLAY'
                          ? `${fixture.minute ?? 0}'`
                          : fixture.status === 'PAUSED'
                            ? 'HT'
                            : fixture.status === 'FINISHED'
                              ? 'FT'
                              : '';
                      const scorerPoolHome = [
                        [`Stratton 24'`, `Bird 28'`],
                        [`Saka 13'`, `Trossard 71'`],
                        [`Watkins 41'`],
                      ];
                      const scorerPoolAway = [
                        [`Middleton 1'`],
                        [`No.9 22'`],
                        [`Winger 81'`, `Defender 90+1'`],
                      ];
                      const homeScorers = scorerPoolHome[idx % scorerPoolHome.length];
                      const awayScorers = scorerPoolAway[idx % scorerPoolAway.length];
                      const showExpandedScorers = isMiniExpanded && (state === 'LIVE' || state === 'RESULTS_PRE_GW');
                      const isExpandedLiveOrResults = isMiniExpanded && (state === 'LIVE' || state === 'RESULTS_PRE_GW');
                      const miniPickIndex = miniPick === 'H' ? 0 : miniPick === 'D' ? 1 : 2;
                      const homePositionLabel = ordinalLabel(teamPositionsByCode?.[String(fixture.homeCode ?? '').toUpperCase()] ?? null);
                      const awayPositionLabel = ordinalLabel(teamPositionsByCode?.[String(fixture.awayCode ?? '').toUpperCase()] ?? null);

                      return (
                        <Animated.View
                          key={`mini-${fixture.id}`}
                          layout={MINI_LAYOUT_TRANSITION}
                          style={{
                            width: isMiniExpanded ? '100%' : '50%',
                            paddingHorizontal: 6,
                            marginBottom: 12,
                            position: 'relative',
                            zIndex: isMiniExpanded ? 80 : 30,
                            elevation: isMiniExpanded ? 6 : 2,
                          }}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Expand ${fixture.home} versus ${fixture.away}`}
                            onPress={() => setMiniExpandedFixtureId((prev) => (prev === fixture.id ? null : fixture.id))}
                            style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
                          >
                            <View
                              style={{
                                borderRadius: isMiniExpanded ? 18 : 16,
                                borderWidth: 1,
                                borderColor: t.color.border,
                                overflow: 'hidden',
                                backgroundColor: t.color.surface,
                                shadowColor: '#0F172A',
                                shadowOpacity: 0.05,
                                shadowRadius: 3,
                                shadowOffset: { width: 0, height: 2 },
                                elevation: 1,
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                                <View
                                  style={{
                                    width: isMiniExpanded ? '37%' : '33.3333%',
                                    aspectRatio: isMiniExpanded ? undefined : 1,
                                    height: isMiniExpanded ? 70 : undefined,
                                    alignItems: 'center',
                                    justifyContent: isMiniExpanded ? 'flex-start' : 'center',
                                    backgroundColor: t.color.surface,
                                    paddingTop: isMiniExpanded ? 15 : 0,
                                  }}
                                >
                                  {homeBadge ? (
                                    <Image source={homeBadge} style={{ width: isMiniExpanded ? 54 : 37, height: isMiniExpanded ? 54 : 37 }} />
                                  ) : (
                                    <TotlText style={{ fontWeight: '800' }}>{fixture.homeCode}</TotlText>
                                  )}
                                </View>
                                <View
                                  style={{
                                    width: isMiniExpanded ? '26%' : '33.3333%',
                                    aspectRatio: isMiniExpanded ? undefined : 1,
                                    height: isMiniExpanded ? 70 : undefined,
                                    alignItems: 'center',
                                    justifyContent: isMiniExpanded ? 'flex-start' : 'center',
                                    backgroundColor: t.color.surface,
                                    paddingTop: isMiniExpanded ? 27 : 0,
                                  }}
                                >
                                  <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                    <TotlText
                                      style={{
                                        color: t.color.text,
                                        fontWeight: '900',
                                        fontSize: isMiniExpanded ? 30 : 16,
                                        lineHeight: isMiniExpanded ? 32 : 18,
                                        letterSpacing: isMiniExpanded ? 0.9 : 0,
                                        textAlign: 'center',
                                      }}
                                    >
                                      {miniPrimaryExpandedLabel}
                                    </TotlText>
                                    {miniSecondaryLabel && !isMiniExpanded ? (
                                      <TotlText style={{ color: t.color.muted, fontWeight: '700', fontSize: 11, lineHeight: 13, textAlign: 'center', marginTop: 2 }}>
                                        {miniSecondaryLabel}
                                      </TotlText>
                                    ) : null}
                                  </View>
                                </View>
                                <View
                                  style={{
                                    width: isMiniExpanded ? '37%' : '33.3333%',
                                    aspectRatio: isMiniExpanded ? undefined : 1,
                                    height: isMiniExpanded ? 70 : undefined,
                                    alignItems: 'center',
                                    justifyContent: isMiniExpanded ? 'flex-start' : 'center',
                                    backgroundColor: t.color.surface,
                                    paddingTop: isMiniExpanded ? 15 : 0,
                                  }}
                                >
                                  {awayBadge ? (
                                    <Image source={awayBadge} style={{ width: isMiniExpanded ? 54 : 37, height: isMiniExpanded ? 54 : 37 }} />
                                  ) : (
                                    <TotlText style={{ fontWeight: '800' }}>{fixture.awayCode}</TotlText>
                                  )}
                                </View>
                              </View>
                              {state !== 'GW_OPEN' &&
                              miniPick &&
                              !(isMiniExpanded &&
                                (state === 'GW_PREDICTED' ||
                                  state === 'DEADLINE_PASSED' ||
                                  state === 'LIVE' ||
                                  state === 'RESULTS_PRE_GW')) ? (
                                <View
                                  style={{
                                    position: 'absolute',
                                    left: `${miniPickIndex * 33.3333}%`,
                                    bottom: 0,
                                    width: '33.3333%',
                                    height: 6,
                                    borderTopLeftRadius: 2,
                                    borderTopRightRadius: 2,
                                    overflow: 'hidden',
                                    backgroundColor: miniLivePickIncorrect ? t.color.surface2 : t.color.brand,
                                  }}
                                >
                                  {miniLivePickCorrect ? (
                                    <>
                                      <LinearGradient
                                        colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                                      />
                                      <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
                                      <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
                                    </>
                                  ) : null}
                                </View>
                              ) : null}

                              {isMiniExpanded ? (
                                <Animated.View
                                  entering={FadeIn.duration(180)}
                                  exiting={FadeOut.duration(120)}
                                  style={{
                                    paddingTop: 2,
                                    paddingBottom: 15,
                                    paddingHorizontal: 0,
                                  }}
                                >
                                  {isExpandedLiveOrResults ? (
                                    <View style={{ marginTop: 7, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <View style={{ width: '37%', alignItems: 'center' }}>
                                        <TotlText
                                          numberOfLines={1}
                                          style={{ width: '100%', fontSize: 15, fontWeight: '900', color: t.color.text, textAlign: 'center' }}
                                        >
                                          {fixture.home}
                                        </TotlText>
                                      </View>
                                      <View style={{ width: '26%', alignItems: 'center' }}>
                                        <TotlText style={{ fontSize: 12, fontWeight: '700', color: t.color.muted, textAlign: 'center' }}>{miniSecondaryLabel}</TotlText>
                                      </View>
                                      <View style={{ width: '37%', alignItems: 'center' }}>
                                        <TotlText
                                          numberOfLines={1}
                                          style={{ width: '100%', fontSize: 15, fontWeight: '900', color: t.color.text, textAlign: 'center' }}
                                        >
                                          {fixture.away}
                                        </TotlText>
                                      </View>
                                    </View>
                                  ) : null}
                                  {!isExpandedLiveOrResults ? (
                                    <View style={{ marginTop: 0, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <View style={{ width: '37%', alignItems: 'center' }}>
                                        <TotlText
                                          numberOfLines={1}
                                          style={{ width: '100%', fontSize: 15, fontWeight: '900', color: t.color.text, textAlign: 'center' }}
                                        >
                                          {fixture.home}
                                        </TotlText>
                                      </View>
                                      <View style={{ width: '26%' }} />
                                      <View style={{ width: '37%', alignItems: 'center' }}>
                                        <TotlText
                                          numberOfLines={1}
                                          style={{ width: '100%', fontSize: 15, fontWeight: '900', color: t.color.text, textAlign: 'center' }}
                                        >
                                          {fixture.away}
                                        </TotlText>
                                      </View>
                                    </View>
                                  ) : null}

                                  {showExpandedScorers ? (
                                    <View style={{ marginTop: 8, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start' }}>
                                      <View style={{ width: '42%', alignItems: 'flex-end', paddingRight: 6 }}>
                                        {homeScorers.map((line) => (
                                          <TotlText
                                            key={`${fixture.id}-eh-${line}`}
                                            numberOfLines={1}
                                            style={{ fontSize: 12, lineHeight: 16, fontWeight: '900', color: t.color.text, textAlign: 'right' }}
                                          >
                                            {line}
                                          </TotlText>
                                        ))}
                                      </View>
                                      <View style={{ width: '16%' }} />
                                      <View style={{ width: '42%', alignItems: 'flex-start', paddingLeft: 6 }}>
                                        {awayScorers.map((line) => (
                                          <TotlText
                                            key={`${fixture.id}-ea-${line}`}
                                            numberOfLines={1}
                                            style={{ fontSize: 12, lineHeight: 16, fontWeight: '900', color: t.color.text, textAlign: 'left' }}
                                          >
                                            {line}
                                          </TotlText>
                                        ))}
                                      </View>
                                    </View>
                                  ) : null}
                                  {state !== 'GW_OPEN' ? (
                                    <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 12 }}>
                                      {(['H', 'D', 'A'] as const).map((side) => {
                                        const active = fixture.pick === side;
                                        const sideBadge = side === 'H' ? homeBadge : side === 'A' ? awayBadge : null;
                                        const pct = side === 'H' ? 24 : side === 'D' ? 18 : 58;
                                        const showExpandedPercentages =
                                          state === 'DEADLINE_PASSED' || state === 'LIVE' || state === 'RESULTS_PRE_GW';
                                        const showExpandedWinnerShiny =
                                          (state === 'LIVE' || state === 'RESULTS_PRE_GW') &&
                                          fixture.status === 'FINISHED' &&
                                          Boolean(fixture.pick) &&
                                          Boolean(fixture.outcome) &&
                                          fixture.pick === fixture.outcome &&
                                          side === fixture.outcome;
                                        return (
                                          <View
                                            key={`inplace-mini-tab-${fixture.id}-${side}`}
                                            style={{
                                              flex: 1,
                                              height: 46,
                                              borderRadius: 11,
                                              borderWidth: showExpandedWinnerShiny ? 0 : 1,
                                              borderColor: showExpandedWinnerShiny
                                                ? 'transparent'
                                                : active
                                                  ? 'rgba(28,131,118,0.4)'
                                                  : t.color.border,
                                              backgroundColor: showExpandedWinnerShiny ? 'transparent' : active ? t.color.brand : t.color.surface2,
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexDirection: 'row',
                                              overflow: 'hidden',
                                            }}
                                          >
                                            {showExpandedWinnerShiny ? (
                                              <>
                                                <LinearGradient
                                                  colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
                                                  start={{ x: 0, y: 0 }}
                                                  end={{ x: 1, y: 1 }}
                                                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                                                />
                                                <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
                                                <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
                                              </>
                                            ) : null}
                                            {sideBadge ? <Image source={sideBadge} style={{ width: 18, height: 18, marginRight: 5 }} /> : null}
                                            <TotlText
                                              style={{ fontSize: 13, fontWeight: '700', color: showExpandedWinnerShiny || active ? '#FFFFFF' : t.color.text }}
                                            >
                                              {showExpandedPercentages
                                                ? side === 'D'
                                                  ? `Draw ${pct}%`
                                                  : `${pct}%`
                                                : side === 'D'
                                                  ? 'Draw'
                                                  : 'Win'}
                                            </TotlText>
                                          </View>
                                        );
                                      })}
                                    </View>
                                  ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                      <View style={{ width: '37%', alignItems: 'center' }}>
                                        <View style={{ width: 56, height: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                          {[t.color.border, t.color.danger, t.color.danger, t.color.danger, t.color.success].map((color, i) => (
                                            <View key={`home-form-${fixture.id}-${i}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                                          ))}
                                        </View>
                                        <TotlText style={{ marginTop: 8, fontSize: 13, fontWeight: '700', color: t.color.text }}>{homePositionLabel}</TotlText>
                                      </View>
                                      <View style={{ width: '26%', alignItems: 'center' }}>
                                        <View style={{ height: 8 }} />
                                        <TotlText style={{ marginTop: 8, fontSize: 13, color: t.color.muted, textAlign: 'center' }}>
                                          {String(fixture.kickoffDetail).split('•')[0].trim()}
                                        </TotlText>
                                      </View>
                                      <View style={{ width: '37%', alignItems: 'center' }}>
                                        <View style={{ width: 56, height: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                          {[t.color.border, t.color.danger, t.color.danger, t.color.danger, t.color.success].map((color, i) => (
                                            <View key={`away-form-${fixture.id}-${i}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                                          ))}
                                        </View>
                                        <TotlText style={{ marginTop: 8, fontSize: 13, fontWeight: '700', color: t.color.text }}>{awayPositionLabel}</TotlText>
                                      </View>
                                    </View>
                                  )}
                                </Animated.View>
                              ) : null}
                            </View>
                          </Pressable>
                        </Animated.View>
                      );
                    })}
                  </Animated.View>
                </Animated.View>
              );
              })}
            </View>
          ) : (
          <View style={showAllExpanded ? undefined : { position: 'relative', height: stackContainerHeight }}>
            {renderedStackFixtures.map((fixture, idx) => {
              const baseTop = idx * collapsedStackStep;
              const top = anyFixtureExpanded && idx > expandedFixtureIndex ? baseTop + expandedStackPush : baseTop;
              const isExpanded = showAllExpanded || expandedFixtureId === fixture.id;
              const statusLabel =
                fixture.status === 'FINISHED'
                  ? 'FT'
                  : fixture.status === 'IN_PLAY'
                    ? `${fixture.minute ?? 0}'`
                    : fixture.status === 'PAUSED'
                      ? 'HT'
                      : fixture.kickoff;
              const centerLabel =
                typeof fixture.homeScore === 'number' && typeof fixture.awayScore === 'number'
                  ? `${fixture.homeScore}-${fixture.awayScore}`
                  : fixture.kickoff;
              const homeBadge = TEAM_BADGES[fixture.homeCode] ?? null;
              const awayBadge = TEAM_BADGES[fixture.awayCode] ?? null;
              const isLiveOrResultsCard = state === 'LIVE' || state === 'RESULTS_PRE_GW';
              const isGwOpenState = state === 'GW_OPEN';
              const isPreLiveState = state === 'GW_OPEN' || state === 'GW_PREDICTED' || state === 'DEADLINE_PASSED';
              const showTabPercentages = isLiveOrResultsCard || state === 'DEADLINE_PASSED';
              const showPlaceholderPercentages = state === 'GW_OPEN' && isExpanded;
              const showPercentagesOnTabs = showTabPercentages || showPlaceholderPercentages;
              const showTabsRow = state !== 'GW_OPEN';
              const hideRepeatedKickoffInDetails =
                (state === 'GW_OPEN' || state === 'GW_PREDICTED' || state === 'DEADLINE_PASSED') &&
                isExpanded &&
                fixture.status === 'SCHEDULED';
              const hideRepeatedKickoffInCompact = !isExpanded && fixture.status === 'SCHEDULED';
              const hideRepeatedKickoffInLiveScheduled = state === 'LIVE' && fixture.status === 'SCHEDULED';
              const hideStatusRowCompletely = state === 'GW_OPEN';
              const isFinished = fixture.status === 'FINISHED';
              const isCompactCard = !showAllExpanded && !isExpanded;
              const scorerPoolHome = [
                [`Pedro 24'`, `Palmer 58'`],
                [`Saka 13'`, `Trossard 71'`],
                [`Watkins 41'`],
              ];
              const scorerPoolAway = [
                [`Nmecha 67'`, `Okafor 73'`],
                [`No.9 22'`],
                [`Winger 81'`, `Defender 90+1'`],
              ];
              const homeScorers = scorerPoolHome[idx % scorerPoolHome.length];
              const awayScorers = scorerPoolAway[idx % scorerPoolAway.length];
              const tabsAboveScorers = state === 'LIVE' || state === 'RESULTS_PRE_GW';
              const scorersBlock = (
                <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ width: '40%', alignItems: 'flex-end', paddingRight: 6 }}>
                    {homeScorers.map((line) => (
                      <TotlText
                        key={`${fixture.id}-h-${line}`}
                        numberOfLines={1}
                        style={{ fontSize: 11, lineHeight: 17, color: t.color.text, textAlign: 'right' }}
                      >
                        {line}
                      </TotlText>
                    ))}
                  </View>
                  <View style={{ width: '20%' }} />
                  <View style={{ width: '40%', alignItems: 'flex-start', paddingLeft: 6 }}>
                    {awayScorers.map((line) => (
                      <TotlText
                        key={`${fixture.id}-a-${line}`}
                        numberOfLines={1}
                        style={{ fontSize: 11, lineHeight: 17, color: t.color.text, textAlign: 'left' }}
                      >
                        {line}
                      </TotlText>
                    ))}
                  </View>
                </View>
              );
              const percentBySide: Record<Pick, number> = isLiveOrResultsCard
                ? {
                    H: fixture.pick === 'H' ? 88 : 6,
                    D: fixture.pick === 'D' ? 88 : 6,
                    A: fixture.pick === 'A' ? 88 : 6,
                  }
                : {
                    H: 36 + (idx % 4) * 5,
                    D: 22 + (idx % 3) * 3,
                    A: 100 - (36 + (idx % 4) * 5) - (22 + (idx % 3) * 3),
                  };

              return (
                <View
                  key={fixture.id}
                  onLayout={(event) => {
                    const measured = event.nativeEvent.layout.height;
                    if (!Number.isFinite(measured) || measured <= 0) return;
                    setCardHeightsById((prev) => {
                      const existing = prev[fixture.id];
                      if (typeof existing === 'number' && Math.abs(existing - measured) <= 1) return prev;
                      return { ...prev, [fixture.id]: measured };
                    });
                  }}
                  style={{
                    ...(showAllExpanded
                      ? {
                          position: 'relative',
                          marginTop: idx === 0 ? 0 : 8,
                        }
                      : {
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top,
                          zIndex: idx + 1,
                        }),
                    shadowColor: '#0F172A',
                    shadowOpacity: 0.06,
                    shadowRadius: 1.8,
                    shadowOffset: { width: 0, height: -0.8 },
                    elevation: 1,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      if (showAllExpanded) return;
                      setExpandedFixtureId((prev) => (prev === fixture.id ? null : fixture.id));
                    }}
                    style={({ pressed }) => ({
                      borderWidth: 1,
                      borderColor: t.color.border,
                      borderTopLeftRadius: 18,
                      borderTopRightRadius: 18,
                      borderBottomLeftRadius: 18,
                      borderBottomRightRadius: 18,
                      paddingHorizontal: isLiveOrResultsCard ? 16 : 12,
                      paddingTop: isLiveOrResultsCard ? 14 : 12,
                      paddingBottom: isLiveOrResultsCard ? 14 : 12,
                      backgroundColor: t.color.surface,
                      opacity: pressed ? 0.96 : 1,
                      transform: [{ scale: pressed ? 0.995 : 1 }],
                    })}
                  >
                      <View style={{ paddingLeft: 0 }}>
                        {isGwOpenState ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <TotlText numberOfLines={1} style={{ fontWeight: '800', fontSize: 14, color: t.color.text }}>
                              {fixture.home}
                            </TotlText>
                            {homeBadge ? <Image source={homeBadge} style={{ width: 24, height: 24, marginLeft: 8, marginRight: 6 }} /> : null}
                            <TotlText style={{ fontWeight: '800', fontSize: 14, color: t.color.text }}>{centerLabel}</TotlText>
                            {awayBadge ? <Image source={awayBadge} style={{ width: 24, height: 24, marginLeft: 6, marginRight: 8 }} /> : null}
                            <TotlText numberOfLines={1} style={{ fontWeight: '800', fontSize: 14, color: t.color.text }}>
                              {fixture.away}
                            </TotlText>
                          </View>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', transform: [{ translateY: 5 }] }}>
                            <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 6 }}>
                              <TotlText numberOfLines={1} style={{ fontWeight: '800', fontSize: 14, color: t.color.text }}>
                                {fixture.home}
                              </TotlText>
                            </View>
                            <View style={{ minWidth: 118, alignItems: 'center', justifyContent: 'center' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                {homeBadge ? <Image source={homeBadge} style={{ width: 24, height: 24, marginRight: 6 }} /> : null}
                                <TotlText style={{ fontWeight: '800', fontSize: 14, color: t.color.text }}>{centerLabel}</TotlText>
                                {awayBadge ? <Image source={awayBadge} style={{ width: 24, height: 24, marginLeft: 6 }} /> : null}
                              </View>
                            </View>
                            <View style={{ flex: 1, alignItems: 'flex-start', paddingLeft: 6 }}>
                              <TotlText numberOfLines={1} style={{ fontWeight: '800', fontSize: 14, color: t.color.text }}>
                                {fixture.away}
                              </TotlText>
                            </View>
                          </View>
                        )}
                        {!hideStatusRowCompletely ? (
                          <View style={{ marginTop: 2, alignItems: 'center' }}>
                            <TotlText
                              style={{
                                color: t.color.muted,
                                fontSize: 12,
                                opacity:
                                  hideRepeatedKickoffInDetails || hideRepeatedKickoffInCompact || hideRepeatedKickoffInLiveScheduled ? 0 : 1,
                              }}
                            >
                              {statusLabel}
                            </TotlText>
                          </View>
                        ) : null}
                        <>
                            {isLiveOrResultsCard && !tabsAboveScorers ? scorersBlock : null}
                            {showTabsRow ? (
                              <View
                                style={{
                                  marginTop: isLiveOrResultsCard ? 12 : 4,
                                  flexDirection: 'row',
                                  gap: isLiveOrResultsCard ? 6 : 8,
                                }}
                              >
                                {(['H', 'D', 'A'] as const).map((side) => {
                                  const active = fixture.pick === side;
                                  const sideBadge = side === 'H' ? homeBadge : side === 'A' ? awayBadge : null;
                                  const showPercentagesForCard = showPercentagesOnTabs && !isCompactCard;
                                  const label = showPercentagesForCard && side === 'D' ? 'Draw' : '';
                                  const showWinnerTabShiny =
                                    isLiveOrResultsCard &&
                                    isFinished &&
                                    Boolean(fixture.pick) &&
                                    Boolean(fixture.outcome) &&
                                    fixture.pick === fixture.outcome &&
                                    fixture.outcome === side;
                                  const showLiveWrongPicked =
                                    (state === 'LIVE' || state === 'RESULTS_PRE_GW') &&
                                    active &&
                                    isFinished &&
                                    Boolean(fixture.pick) &&
                                    Boolean(fixture.outcome) &&
                                    fixture.pick !== fixture.outcome;
                                  const showWrongFinishedPickedTab =
                                    isFinished &&
                                    active &&
                                    Boolean(fixture.pick) &&
                                    Boolean(fixture.outcome) &&
                                    fixture.pick !== fixture.outcome &&
                                    !showLiveWrongPicked;
                                  const showSolidPickedTab =
                                    (active && !isFinished && !showWinnerTabShiny && !showWrongFinishedPickedTab) ||
                                    showLiveWrongPicked;
                                  const activeBorder = 'rgba(28,131,118,0.45)';
                                  const activeBackground = 'rgba(28,131,118,0.12)';
                                  const activeText = t.color.brand;
                                  return (
                                    <View
                                      key={`${fixture.id}-${side}`}
                                      style={{
                                        flex: 1,
                                        borderRadius: 9,
                                        borderWidth: showWinnerTabShiny ? 0 : 1,
                                        borderColor: showWrongFinishedPickedTab
                                          ? 'rgba(203,213,225,0.9)'
                                          : showLiveWrongPicked
                                            ? 'rgba(203,213,225,0.9)'
                                          : showSolidPickedTab
                                            ? t.color.brand
                                          : active
                                            ? activeBorder
                                            : t.color.border,
                                        backgroundColor: showWinnerTabShiny
                                          ? 'transparent'
                                          : showWrongFinishedPickedTab
                                            ? t.color.surface2
                                          : showLiveWrongPicked
                                            ? t.color.surface2
                                          : showSolidPickedTab
                                            ? t.color.brand
                                          : isLiveOrResultsCard
                                            ? active
                                              ? activeBackground
                                              : t.color.surface2
                                            : active
                                              ? activeBackground
                                              : t.color.background,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingVertical: isLiveOrResultsCard ? 10 : 5,
                                        position: 'relative',
                                        overflow: 'visible',
                                      }}
                                    >
                                      {showWinnerTabShiny ? (
                                        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 9, overflow: 'hidden' }}>
                                          <LinearGradient
                                            colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                                          />
                                          <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
                                          <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
                                        </View>
                                      ) : null}
                                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {sideBadge ? <Image source={sideBadge} style={{ width: 16, height: 16, marginRight: 4 }} /> : null}
                                        {label ? (
                                          <TotlText style={{ fontSize: 13, fontWeight: '500', color: showWinnerTabShiny || showSolidPickedTab ? '#FFFFFF' : t.color.text }}>
                                            {label}{' '}
                                          </TotlText>
                                        ) : null}
                                        {showPlaceholderPercentages && !isCompactCard ? (
                                          <TotlText
                                            style={{
                                              fontSize: 15,
                                              fontWeight: active ? '700' : '500',
                                              color: showSolidPickedTab ? '#FFFFFF' : active ? t.color.brand : t.color.muted,
                                            }}
                                          >
                                            --%
                                          </TotlText>
                                        ) : showPercentagesForCard ? (
                                          <TotlText
                                            style={{
                                              fontSize: 15,
                                              fontWeight: active ? '700' : '500',
                                              color: showWinnerTabShiny
                                                ? '#FFFFFF'
                                                : showSolidPickedTab
                                                  ? '#FFFFFF'
                                                : showWrongFinishedPickedTab
                                                  ? '#94A3B8'
                                                : isLiveOrResultsCard
                                                  ? active
                                                    ? activeText
                                                    : t.color.text
                                                  : active
                                                    ? activeText
                                                    : t.color.text,
                                            }}
                                          >
                                            {`${percentBySide[side]}%`}
                                          </TotlText>
                                        ) : (
                                          <TotlText
                                            style={{
                                              fontSize: 14,
                                              fontWeight: active ? '800' : '600',
                                              color: showWinnerTabShiny ? '#FFFFFF' : showSolidPickedTab ? '#FFFFFF' : active ? '#047857' : t.color.muted,
                                            }}
                                          >
                                            {side === 'D' ? 'Draw' : 'Win'}
                                          </TotlText>
                                        )}
                                      </View>
                                    </View>
                                  );
                                })}
                              </View>
                            ) : null}
                            {isLiveOrResultsCard && tabsAboveScorers ? scorersBlock : null}
                            {isLiveOrResultsCard ? (
                              <View style={{ marginTop: 14, alignItems: 'center' }}>
                                <TotlText style={{ fontSize: 14, color: t.color.muted }}>{fixture.kickoffDetail}</TotlText>
                              </View>
                            ) : null}
                        </>
                      </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

