import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import type { DimensionValue, ImageSourcePropType } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { TotlText } from '@totl/ui';
import type { Fixture, GwResults, HomeSnapshot, LiveScore, Pick, ProfileSummary } from '@totl/domain';

import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { getDefaultMlAvatarFilename, resolveLeagueAvatarUri } from '../../lib/leagueAvatars';
import { getMonthForGw } from '../../lib/leaderboardMonths';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { navigationRef } from '../../navigation/AppNavigator';
import WinnerShimmer from '../WinnerShimmer';
import type { PopupCardKind } from './types';
import { getMediumName } from '../../../../../src/lib/teamNames';

type GwPointsRow = { user_id: string; gw: number; points: number };
type UserRow = { id: string; name: string | null; avatar_url: string | null };

type WinnerEntry = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  isCurrentUser?: boolean;
};

type WinnersCardPayload = {
  gw: number;
  gwWinningPoints: number;
  gwWinners: WinnerEntry[];
  monthly:
    | {
        label: string;
        winningPoints: number;
        winners: WinnerEntry[];
      }
    | null;
};

type PersonalWinnerCardPayload = {
  gw: number;
  victoryType: 'gameweek' | 'monthly';
  label: string;
  points: number;
  winnerCount: number;
  joint: boolean;
};

const SEASON_RANK_BADGE = require('../../../assets/icons/season-rank-badge.png');
const FIVE_WEEK_FORM_BADGE = require('../../../assets/icons/5-week-form-badge.png');
const TEN_WEEK_FORM_BADGE = require('../../../assets/icons/10-week-form-badge.png');

function ResultsSectionTitle({ title, badge }: { title: string; badge: ImageSourcePropType }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <Image source={badge} style={{ width: 24, height: 24, marginRight: 8 }} resizeMode="contain" />
      <TotlText
        style={{
          color: '#0F172A',
          fontFamily: 'Gramatika-Bold',
          textAlign: 'center',
          fontWeight: '900',
          fontSize: 18,
          lineHeight: 22,
        }}
      >
        {title}
      </TotlText>
    </View>
  );
}

function SwipeFingerIcon({ size = 34, color = '#64748B' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        d="M22 28V15.5C22 13.6 23.4 12.2 25.2 12.2C27 12.2 28.4 13.6 28.4 15.5V25.5"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M28.4 25.5V22.8C28.4 21.1 29.7 19.8 31.4 19.8C33.1 19.8 34.4 21.1 34.4 22.8V27.2"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 28L18.6 25.2C17.3 24.1 15.4 24.2 14.3 25.4C13.1 26.7 13.2 28.6 14.5 29.8L22.2 37C24.2 38.9 26.8 40 29.6 40H32.2C36.5 40 40 36.5 40 32.2V27.5C40 25.8 38.7 24.5 37 24.5C35.3 24.5 34 25.8 34 27.5"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PredictionsFooterIcon({ size = 34, color = '#1C8376' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Path
        d="M23.5 7C29.3447 7 34.0928 11.748 34.0928 17.5928C34.0925 23.4373 29.3446 28.1846 23.5 28.1846C17.6554 28.1846 12.9085 23.4373 12.9082 17.5928C12.9082 11.748 17.6553 7 23.5 7ZM12.1025 25.001C12.6067 25.0523 13 25.4784 13 25.9961C13 26.5138 12.6067 26.9399 12.1025 26.9912L12 26.9961H7C6.44772 26.9961 6 26.5484 6 25.9961C6 25.4438 6.44772 24.9961 7 24.9961H12L12.1025 25.001ZM20.3008 23.1504L21.0088 26.1855C21.7982 26.4213 22.6389 26.5439 23.5 26.5439C24.3613 26.5439 25.2026 26.4214 25.9922 26.1855L26.6895 23.1914L25.3359 21.4688H21.6133L20.3008 23.1504ZM27.2432 17.3057L26.207 20.5254L27.6631 22.4014L31.0166 22.4531C31.9189 21.0483 32.4521 19.3867 32.4521 17.6025L29.96 16.208L27.2432 17.3057ZM14.5488 17.6025C14.5591 19.3765 15.0718 21.0278 15.9639 22.4121L19.3271 22.3604L20.7832 20.4844L19.7578 17.3057L17.04 16.208L14.5488 17.6025ZM8.10254 16.001C8.60667 16.0523 9 16.4784 9 16.9961C9 17.5138 8.60667 17.9399 8.10254 17.9912L8 17.9961H3C2.44772 17.9961 2 17.5484 2 16.9961C2 16.4438 2.44772 15.9961 3 15.9961H8L8.10254 16.001ZM20.3525 9.21484C18.8556 9.76852 17.5532 10.7223 16.5586 11.9424L17.502 15.0391L20.1064 16.0957L22.875 13.9629V11.2451L20.3525 9.21484ZM24.126 11.2246V13.9629L26.8945 16.0957L29.499 15.0391L30.4424 11.9424C29.4479 10.7223 28.135 9.76907 26.6279 9.20508L24.126 11.2246ZM12.1025 8.00098C12.6067 8.05231 13 8.47842 13 8.99609C13 9.51377 12.6067 9.93988 12.1025 9.99121L12 9.99609H7C6.44772 9.99609 6 9.54838 6 8.99609C6 8.44381 6.44772 7.99609 7 7.99609H12L12.1025 8.00098Z"
        fill={color}
      />
    </Svg>
  );
}

function getPredictionsDeadline(fixtures: Fixture[] | null | undefined): Date | null {
  const kickoffTimes = (fixtures ?? [])
    .map((fixture) => {
      const rawKickoff = fixture.kickoff_time;
      if (!rawKickoff) return null;
      const date = new Date(rawKickoff);
      return Number.isFinite(date.getTime()) ? date : null;
    })
    .filter((date): date is Date => date != null)
    .sort((a, b) => a.getTime() - b.getTime());

  const firstKickoff = kickoffTimes[0] ?? null;
  if (!firstKickoff) return null;
  return new Date(firstKickoff.getTime() - 75 * 60 * 1000);
}

function getSimulatorPredictionsDeadline(): Date {
  return new Date(Date.now() + 2 * 86400 * 1000 + 4 * 3600 * 1000 + 22 * 60 * 1000);
}

function formatCountdown(deadline: Date, nowMs: number): string {
  const remainingMs = Math.max(0, deadline.getTime() - nowMs);
  if (remainingMs <= 0) return 'Deadline passed';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function ordinalSuffix(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

function formatTopPercent(rank: number | null, total: number | null): string | null {
  if (!rank || !total) return null;
  const percent = Math.max(1, Math.min(100, Math.round((rank / total) * 100)));
  return `Top ${percent}%`;
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function WinnerPill({ winner, height }: { winner: WinnerEntry; height: number }) {
  const isCurrentUser = winner.isCurrentUser === true;

  return (
    <View
      style={{
        height,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isCurrentUser ? 'transparent' : 'rgba(28,131,118,0.22)',
        backgroundColor: isCurrentUser ? 'transparent' : 'rgba(28,131,118,0.08)',
        paddingHorizontal: 7,
        overflow: 'hidden',
      }}
    >
      {isCurrentUser ? (
        <>
          <LinearGradient
            colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" skipFirstDelay />
          <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
        </>
      ) : null}
      {winner.avatar_url ? (
        <Image source={{ uri: winner.avatar_url }} style={{ width: 15, height: 15, borderRadius: 8, marginRight: 5 }} />
      ) : (
        <View
          style={{
            width: 15,
            height: 15,
            borderRadius: 8,
            marginRight: 5,
            backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.09)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TotlText style={{ fontSize: 8, lineHeight: 8, color: isCurrentUser ? '#FFFFFF' : '#0F172A', fontWeight: '700' }}>
            {winner.name.slice(0, 1).toUpperCase()}
          </TotlText>
        </View>
      )}
      <TotlText
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontSize: 10,
          lineHeight: 12,
          color: isCurrentUser ? '#FFFFFF' : '#0F172A',
          fontWeight: '700',
        }}
      >
        {winner.name}
      </TotlText>
      {isCurrentUser ? (
        <TotlText
          style={{
            marginLeft: 5,
            color: '#FFFFFF',
            fontSize: 8,
            lineHeight: 10,
            fontWeight: '900',
            letterSpacing: 0.3,
          }}
        >
          YOU
        </TotlText>
      ) : null}
    </View>
  );
}

function WinnerColumnsScroller({ winners, roomy = false }: { winners: WinnerEntry[]; roomy?: boolean }) {
  const ROWS_PER_COLUMN = roomy ? 3 : 2;
  const VISIBLE_COLUMNS = 3;
  const CELL_HEIGHT = roomy ? 34 : 28;
  const CELL_GAP = roomy ? 10 : 4;
  const SMALL_GRID_SIDE_INSET = roomy ? 10 : 18;
  const columns = React.useMemo(() => chunkItems(winners, ROWS_PER_COLUMN), [winners]);
  const scrollRef = React.useRef<ScrollView | null>(null);
  const autoScrollStartTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const activeColumnOffsetRef = React.useRef(0);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const columnWidth = React.useMemo(() => {
    if (viewportWidth <= 0) return 0;
    const totalInterColumnGap = CELL_GAP * (VISIBLE_COLUMNS - 1);
    return Math.max(0, (viewportWidth - totalInterColumnGap) / VISIBLE_COLUMNS);
  }, [CELL_GAP, VISIBLE_COLUMNS, viewportWidth]);
  const columnStride = columnWidth + CELL_GAP;
  const maxOffset = Math.max(0, columns.length - VISIBLE_COLUMNS);

  React.useEffect(() => {
    activeColumnOffsetRef.current = 0;
    if (scrollRef.current && viewportWidth > 0) {
      scrollRef.current.scrollTo({ x: 0, animated: false });
    }
  }, [viewportWidth, winners.length]);

  React.useEffect(() => {
    if (maxOffset <= 0 || columnStride <= 0) return;
    autoScrollStartTimeoutRef.current = setTimeout(() => {
      autoScrollIntervalRef.current = setInterval(() => {
        const nextOffset = activeColumnOffsetRef.current >= maxOffset ? 0 : activeColumnOffsetRef.current + 1;
        scrollRef.current?.scrollTo({ x: nextOffset * columnStride, animated: true });
        activeColumnOffsetRef.current = nextOffset;
      }, 3000);
    }, 700);
    return () => {
      if (autoScrollStartTimeoutRef.current) {
        clearTimeout(autoScrollStartTimeoutRef.current);
        autoScrollStartTimeoutRef.current = null;
      }
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    };
  }, [columnStride, maxOffset]);

  if (!winners.length) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
        <TotlText style={{ color: '#64748B', fontSize: 12, lineHeight: 16 }}>No winners yet</TotlText>
      </View>
    );
  }

  const staticWinnerLimit = roomy ? 10 : ROWS_PER_COLUMN * VISIBLE_COLUMNS;

  if (winners.length <= staticWinnerLimit) {
    const visibleColumns = roomy ? (winners.length === 1 ? 1 : 2) : winners.length === 1 ? 1 : winners.length <= 4 ? 2 : VISIBLE_COLUMNS;
    const rows = chunkItems(winners, visibleColumns);
    const availableGridWidth = Math.max(0, viewportWidth - SMALL_GRID_SIDE_INSET * 2);
    const pillWidth =
      viewportWidth > 0
        ? visibleColumns === 1
          ? Math.min(availableGridWidth, 220)
          : Math.max(0, (availableGridWidth - CELL_GAP * (visibleColumns - 1)) / visibleColumns)
        : undefined;
    return (
      <View
        style={{ width: '100%', marginTop: roomy ? 4 : 0 }}
        onLayout={(event) => {
          const width = Math.max(0, Math.floor(event.nativeEvent.layout.width));
          if (width !== viewportWidth) setViewportWidth(width);
        }}
      >
        <View style={{ width: '100%', paddingHorizontal: SMALL_GRID_SIDE_INSET }}>
          {rows.map((row, rowIndex) => (
            <View
              key={`winner-row-${rowIndex}`}
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginTop: rowIndex === 0 ? 0 : CELL_GAP,
              }}
            >
              {row.map((winner, winnerIndex) => (
                <View
                  key={winner.user_id}
                  style={{
                    width: pillWidth,
                    marginLeft: winnerIndex === 0 ? 0 : CELL_GAP,
                  }}
                >
                  <WinnerPill winner={winner} height={CELL_HEIGHT} />
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{ width: '100%', height: ROWS_PER_COLUMN * CELL_HEIGHT + (ROWS_PER_COLUMN - 1) * CELL_GAP }}
      onLayout={(event) => {
        const width = Math.max(0, Math.floor(event.nativeEvent.layout.width));
        if (width !== viewportWidth) setViewportWidth(width);
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        snapToInterval={columnStride > 0 ? columnStride : undefined}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'stretch' }}
        onMomentumScrollEnd={(event) => {
          if (columnStride <= 0) return;
          const x = event.nativeEvent.contentOffset.x;
          activeColumnOffsetRef.current = Math.max(0, Math.min(maxOffset, Math.round(x / columnStride)));
        }}
      >
        {columns.map((column, colIndex) => (
          <View
            key={`winner-col-${colIndex}`}
            style={{
              width: columnWidth > 0 ? columnWidth : undefined,
              marginRight: colIndex === columns.length - 1 ? 0 : CELL_GAP,
              justifyContent: 'space-between',
              height: ROWS_PER_COLUMN * CELL_HEIGHT + (ROWS_PER_COLUMN - 1) * CELL_GAP,
            }}
          >
            {Array.from({ length: ROWS_PER_COLUMN }, (_, rowIndex) => {
              const winner = column[rowIndex] ?? null;
              if (!winner) {
                return (
                  <View
                    key={`empty-${colIndex}-${rowIndex}`}
                    style={{
                      height: CELL_HEIGHT,
                      borderRadius: 8,
                      backgroundColor: 'transparent',
                    }}
                  />
                );
              }
              return (
                <WinnerPill key={winner.user_id} winner={winner} height={CELL_HEIGHT} />
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

type SimulatorWinnersVariant = 'single' | '1to10' | '11plus' | '20each' | 'withMe';
type SimulatorResultsVariant = 'wins' | 'noWinsInLeagues' | 'noLeagues';

function buildSimulatorResultsPayload(variant: SimulatorResultsVariant): { gw: number; results: GwResults } {
  const base: GwResults = {
    score: 5,
    totalFixtures: 10,
    gwRank: 6,
    gwRankTotal: 33,
    trophies: { gw: false, form5: false, form10: false, overall: false },
    mlVictories: variant === 'wins' ? 4 : 0,
    mlMembershipCount: variant === 'noLeagues' ? 0 : 4,
    mlVictoryNames: variant === 'wins' ? ['Jof Carl Expo', 'Prem Predictions', 'Jof + Kieran', 'forget it'] : [],
    mlVictoryData:
      variant === 'wins'
        ? [
            { id: 'sim-ml-1', name: 'Jof Carl Expo', avatar: 'ML-avatar-1.png' },
            { id: 'sim-ml-2', name: 'Prem Predictions', avatar: 'ML-avatar-2.png' },
            { id: 'sim-ml-3', name: 'Jof + Kieran', avatar: 'ML-avatar-3.png' },
            { id: 'sim-ml-4', name: 'forget it', avatar: 'ML-avatar-4.png' },
          ]
        : [],
    leaderboardChanges: {
      overall: { before: 4, after: 3, change: 1 },
      form5: { before: 1, after: 4, change: -3 },
      form10: { before: 3, after: 3, change: 0 },
    },
  };

  return { gw: 35, results: base };
}

function buildSimulatorResultsScoreSheetPayload(): { gw: number; results: GwResults; snapshot: HomeSnapshot } {
  const { gw, results } = buildSimulatorResultsPayload('wins');
  const teams = [
    ['LEE', 'BUR', 3, 1, 'H'],
    ['BRE', 'WHU', 3, 0, 'H'],
    ['NEW', 'BHA', 3, 1, 'H'],
    ['WOL', 'SUN', 1, 1, 'D'],
    ['ARS', 'FUL', 3, 0, 'H'],
    ['BOU', 'CRY', 3, 0, 'H'],
    ['MUN', 'LIV', 3, 2, 'H'],
    ['AVL', 'TOT', 1, 2, 'A'],
    ['CHE', 'NOT', 0, 0, 'H'],
    ['EVE', 'MCI', 0, 0, 'A'],
  ] as const;

  const fixtures: Fixture[] = teams.map(([home, away], index) => ({
    id: `sim-fixture-${index}`,
    gw,
    fixture_index: index + 1,
    home_code: home,
    away_code: away,
    home_name: home,
    away_name: away,
    kickoff_time: null,
  }));
  const liveScores: LiveScore[] = teams.map(([home, away, homeScore, awayScore], index) => ({
    api_match_id: 9000 + index,
    gw,
    fixture_index: index + 1,
    home_score: homeScore,
    away_score: awayScore,
    status: 'FINISHED',
    home_team: home,
    away_team: away,
  }));
  const gwResults = teams.map(([home, away, homeScore, awayScore], index) => ({
    fixture_index: index + 1,
    result: (homeScore > awayScore ? 'H' : homeScore < awayScore ? 'A' : 'D') as Pick,
  }));
  const userPicks = teams.reduce<Record<string, Pick>>((acc, item, index) => {
    acc[String(index + 1)] = item[4] as Pick;
    return acc;
  }, {});

  return {
    gw,
    results,
    snapshot: {
      currentGw: gw,
      viewingGw: gw,
      fixtures,
      userPicks,
      liveScores,
      gwResults,
      hasSubmittedViewingGw: true,
    },
  };
}

function buildResultsFromScoreSheetSnapshot(snapshot: HomeSnapshot): GwResults {
  const resultByFixture = new Map<number, Pick>();
  snapshot.gwResults.forEach((row) => resultByFixture.set(row.fixture_index, row.result));
  const score = Object.entries(snapshot.userPicks ?? {}).reduce((total, [fixtureIndex, pick]) => {
    const result = resultByFixture.get(Number(fixtureIndex));
    return result && pick === result ? total + 1 : total;
  }, 0);

  return {
    score,
    totalFixtures: Math.max(1, snapshot.fixtures.length || 10),
    gwRank: null,
    gwRankTotal: null,
    trophies: { gw: false, form5: false, form10: false, overall: false },
    mlVictories: 0,
    mlMembershipCount: 0,
    mlVictoryNames: [],
    mlVictoryData: [],
    leaderboardChanges: {
      overall: { before: null, after: null, change: null },
      form5: { before: null, after: null, change: null },
      form10: { before: null, after: null, change: null },
    },
  };
}

function buildSimulatorWinnersPayload(variant: SimulatorWinnersVariant, currentUserId: string | null): WinnersCardPayload {
  const twentyNames = [
    'Alex',
    'Bea',
    'Carl',
    'Dani',
    'Elliot',
    'Faye',
    'Gus',
    'Hana',
    'Isaac',
    'Jules',
    'Kai',
    'Luca',
    'Mina',
    'Nora',
    'Ollie',
    'Pia',
    'Quinn',
    'Rafi',
    'Sofia',
    'Tariq',
  ];
  const baseNames =
    variant === 'single'
      ? twentyNames.slice(0, 1)
      : variant === '1to10' || variant === 'withMe'
      ? twentyNames.slice(0, 10)
      : variant === '11plus'
        ? twentyNames.slice(0, 14)
        : twentyNames;

  const gwWinners: WinnerEntry[] = baseNames.map((name, index) => {
    const isCurrentUserSlot = variant === 'withMe' && index === 2;
    return {
      user_id: isCurrentUserSlot && currentUserId ? currentUserId : `sim-winner-${variant}-${index + 1}`,
      name: isCurrentUserSlot ? 'You' : name,
      avatar_url: null,
      isCurrentUser: isCurrentUserSlot,
    };
  });

  const monthlyNames = variant === '20each' ? twentyNames : variant === '11plus' ? ['Alex', 'Bea', 'Carl', 'Dani'] : [];
  const monthlyWinners: WinnerEntry[] =
    monthlyNames.length > 0
      ? monthlyNames.map((name, index) => ({
          user_id: `sim-monthly-${index + 1}`,
          name,
          avatar_url: null,
        }))
      : [];

  return {
    gw: 25,
    gwWinningPoints: 5,
    gwWinners,
    monthly:
      variant === '11plus' || variant === '20each'
        ? {
            label: 'February 2026',
            winningPoints: variant === '20each' ? 26 : 22,
            winners: monthlyWinners,
          }
        : null,
  };
}

function buildSimulatorPersonalWinnerPayload(victoryType: 'gameweek' | 'monthly'): PersonalWinnerCardPayload {
  if (victoryType === 'monthly') {
    return {
      gw: 35,
      victoryType,
      label: 'April 2026',
      points: 27,
      winnerCount: 4,
      joint: true,
    };
  }

  return {
    gw: 35,
    victoryType,
    label: 'Gameweek 35',
    points: 8,
    winnerCount: 3,
    joint: true,
  };
}

async function fetchAllSupabaseRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function parseGwFromEventKey(eventKey: string | undefined): number | null {
  if (!eventKey) return null;
  const match = eventKey.match(/:gw(\d+)$/i);
  if (!match?.[1]) return null;
  const gw = Number(match[1]);
  return Number.isFinite(gw) && gw > 0 ? gw : null;
}

function parsePersonalWinnerTypeFromEventKey(eventKey: string | undefined): 'gameweek' | 'monthly' {
  return eventKey?.includes(':monthly:') || eventKey?.endsWith(':monthly') ? 'monthly' : 'gameweek';
}

function fallbackName(userId: string): string {
  return `Player ${userId.slice(0, 6).toUpperCase()}`;
}

async function fetchPersonalWinnerPayload(eventKey: string | undefined, currentUserId: string | null): Promise<PersonalWinnerCardPayload | null> {
  if (!currentUserId) return null;
  const victoryType = parsePersonalWinnerTypeFromEventKey(eventKey);
  const uidNorm = String(currentUserId).trim().toLowerCase();

  let gw = parseGwFromEventKey(eventKey);
  if (!gw) {
    const { data: latestGwRow, error: latestGwErr } = await supabase
      .from('app_gw_results')
      .select('gw')
      .order('gw', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestGwErr) throw latestGwErr;
    gw = typeof latestGwRow?.gw === 'number' ? latestGwRow.gw : null;
  }
  if (!gw) return null;

  if (victoryType === 'gameweek') {
    try {
      const live = await api.getGlobalGwLiveTable(gw);
      const liveRows = live?.rows ?? [];
      if (liveRows.length > 0) {
        const scores = liveRows.map((row: { user_id?: string; score?: number | null }) => ({
          user_id: String(row.user_id ?? '').toLowerCase(),
          score: Number(row.score ?? 0),
        }));
        const top = Math.max(...scores.map((r) => r.score));
        const winnerIds = scores.filter((r) => r.score === top).map((r) => r.user_id);
        if (winnerIds.includes(uidNorm)) {
          return {
            gw,
            victoryType,
            label: `Gameweek ${gw}`,
            points: top,
            winnerCount: winnerIds.length,
            joint: winnerIds.length > 1,
          };
        }
        return null;
      }
    } catch {
      // Fall through to view-backed points when live table is unavailable.
    }

    const gwRowsOnly = await fetchAllSupabaseRows<GwPointsRow>((from, to) =>
      supabase
        .from('app_v_gw_points')
        .select('user_id, gw, points')
        .eq('gw', gw)
        .order('user_id', { ascending: true })
        .range(from, to)
    );
    if (!gwRowsOnly.length) return null;

    const gwWinningPoints = Math.max(...gwRowsOnly.map((row) => Number(row.points ?? 0)));
    const gwWinnerIds = gwRowsOnly
      .filter((row) => Number(row.points ?? 0) === gwWinningPoints)
      .map((row) => String(row.user_id).toLowerCase());
    if (!gwWinnerIds.includes(uidNorm)) return null;
    return {
      gw,
      victoryType,
      label: `Gameweek ${gw}`,
      points: gwWinningPoints,
      winnerCount: gwWinnerIds.length,
      joint: gwWinnerIds.length > 1,
    };
  }

  const month = getMonthForGw(gw);
  if (!month || gw !== month.endGw) return null;

  const monthRows = await fetchAllSupabaseRows<GwPointsRow>((from, to) =>
    supabase
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .gte('gw', month.startGw)
      .lte('gw', month.endGw)
      .order('gw', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, to)
  );
  if (!monthRows.length) return null;

  const monthlyTotalsByUser = new Map<string, number>();
  monthRows.forEach((row) => {
    const rowUserId = String(row.user_id).toLowerCase();
    monthlyTotalsByUser.set(rowUserId, (monthlyTotalsByUser.get(rowUserId) ?? 0) + Number(row.points ?? 0));
  });
  const monthlyTop = Math.max(...Array.from(monthlyTotalsByUser.values()));
  const monthlyWinnerIds = Array.from(monthlyTotalsByUser.entries())
    .filter(([, score]) => score === monthlyTop)
    .map(([userId]) => userId);
  if (!monthlyWinnerIds.includes(uidNorm)) return null;
  return {
    gw,
    victoryType,
    label: month.label,
    points: monthlyTop,
    winnerCount: monthlyWinnerIds.length,
    joint: monthlyWinnerIds.length > 1,
  };
}

function AchievementMetric({
  label,
  value,
  prefixValue,
  subValue,
  width = '48%',
  showTopLine = true,
}: {
  label: string;
  value: string;
  prefixValue?: string;
  subValue?: string;
  width?: DimensionValue;
  showTopLine?: boolean;
}) {
  return (
    <View
      style={{
        width,
        aspectRatio: 1,
        borderTopWidth: showTopLine ? 1 : 0,
        borderTopColor: 'rgba(148,163,184,0.32)',
        borderRadius: 16,
        backgroundColor: 'rgba(15,23,42,0.04)',
        paddingHorizontal: 8,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <TotlText
        style={{
          color: '#334155',
          fontSize: 12,
          lineHeight: 15,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {label}
      </TotlText>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 7 }}>
        {prefixValue ? (
          <TotlText style={{ color: '#64748B', fontSize: 11, lineHeight: 14, marginTop: 5 }}>
            {prefixValue}
          </TotlText>
        ) : null}
        <TotlText style={{ color: '#0F172A', fontSize: 22, lineHeight: 26, fontWeight: '700', marginLeft: prefixValue ? 5 : 0 }}>
          {value}
        </TotlText>
        {subValue ? (
          <TotlText style={{ color: '#64748B', fontSize: 10, lineHeight: 12, marginLeft: 4, marginTop: 8 }}>
            {subValue}
          </TotlText>
        ) : null}
      </View>
    </View>
  );
}

function GlobalSummaryMetric({
  rankValue,
  rankTotal,
  positionPrefix,
  positionValue,
}: {
  rankValue: string;
  rankTotal?: number | null;
  positionPrefix?: string;
  positionValue: string;
}) {
  return (
    <View
      style={{
        width: '65%',
        aspectRatio: 2.1,
        borderRadius: 16,
        backgroundColor: 'rgba(15,23,42,0.04)',
        paddingHorizontal: 10,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <TotlText style={{ color: '#334155', fontSize: 12, lineHeight: 15, fontWeight: '700', textAlign: 'center' }}>
        Global
      </TotlText>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
            <TotlText style={{ color: '#0F172A', fontSize: 16, lineHeight: 20, fontWeight: '700' }}>{rankValue}</TotlText>
            {rankTotal ? (
              <TotlText style={{ color: '#64748B', fontSize: 16, lineHeight: 20, marginLeft: 4, fontWeight: '700' }}>
                of {rankTotal}
              </TotlText>
            ) : null}
          </View>
        </View>
        <View style={{ width: 1, height: 34, backgroundColor: 'rgba(28,131,118,0.18)', marginHorizontal: 8 }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
            {positionPrefix ? (
              <TotlText style={{ color: '#64748B', fontSize: 16, lineHeight: 20, marginRight: 5, fontWeight: '700' }}>
                {positionPrefix}
              </TotlText>
            ) : null}
            <TotlText style={{ color: '#0F172A', fontSize: 16, lineHeight: 20, fontWeight: '700' }}>{positionValue}</TotlText>
          </View>
        </View>
      </View>
    </View>
  );
}

function RankAchievementMetric({
  label,
  rank,
  change,
  emptyText,
}: {
  label: string;
  rank: number | null;
  change: number | null;
  emptyText?: string;
}) {
  const improved = typeof change === 'number' && change > 0;
  const dropped = typeof change === 'number' && change < 0;

  return (
    <View
      style={{
        width: '31%',
        borderTopWidth: 0,
        borderTopColor: 'rgba(148,163,184,0.32)',
        borderRadius: 14,
        backgroundColor: 'rgba(15,23,42,0.04)',
        paddingHorizontal: 6,
        paddingVertical: 10,
        minHeight: 66,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TotlText
        style={{
          color: '#475569',
          fontSize: 10,
          lineHeight: 12,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {label}
      </TotlText>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 7 }}>
        {rank ? (
          <>
            <TotlText style={{ color: '#0F172A', fontSize: 17, lineHeight: 20, fontWeight: '400' }}>
              {rank}
              {ordinalSuffix(rank)}
            </TotlText>
            {improved || dropped ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}>
                <Ionicons name={improved ? 'caret-up' : 'caret-down'} size={10} color={improved ? '#16A34A' : '#DC2626'} />
                <TotlText style={{ color: improved ? '#16A34A' : '#DC2626', fontSize: 10, lineHeight: 12, fontWeight: '900' }}>
                  {Math.abs(change ?? 0)}
                </TotlText>
              </View>
            ) : null}
          </>
        ) : emptyText ? (
          <TotlText style={{ color: '#64748B', fontSize: 9, lineHeight: 11, fontWeight: '700', textAlign: 'center' }}>
            {emptyText}
          </TotlText>
        ) : null}
      </View>
    </View>
  );
}

function ResultsTrophies({ trophies }: { trophies: GwResults['trophies'] }) {
  const earned: Array<{ key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [];
  if (trophies.gw) earned.push({ key: 'gw', label: 'GW Winner', icon: 'trophy' });
  if (trophies.form5) earned.push({ key: 'form5', label: '5 Week Form', icon: 'flame' });
  if (trophies.form10) earned.push({ key: 'form10', label: '10 Week Form', icon: 'flash' });
  if (trophies.overall) earned.push({ key: 'overall', label: 'Overall', icon: 'ribbon' });

  if (!earned.length) return null;

  return (
    <LinearGradient
      colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, overflow: 'hidden', marginTop: 12 }}
    >
      <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.85} tint="white" skipFirstDelay />
      <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.5} tint="gold" />
      <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Bold', fontSize: 11, lineHeight: 14, fontWeight: '900', textAlign: 'center', marginBottom: 8 }}>
        Trophies Earned!
      </TotlText>
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
        {earned.map((item) => (
          <View key={item.key} style={{ alignItems: 'center', marginHorizontal: 8 }}>
            <Ionicons name={item.icon} size={18} color="#FFFFFF" />
            <TotlText style={{ color: 'rgba(255,255,255,0.92)', fontSize: 9, lineHeight: 11, marginTop: 3, fontWeight: '700' }}>
              {item.label}
            </TotlText>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

function MiniLeagueVictoryPill({ league }: { league: GwResults['mlVictoryData'][number] }) {
  const id = String(league.id);
  const name = String(league.name ?? 'League');
  const avatarUri = resolveLeagueAvatarUri(league.avatar ?? null) ?? resolveLeagueAvatarUri(getDefaultMlAvatarFilename(id));

  return (
    <View
      style={{
        height: 28,
        minWidth: 112,
        maxWidth: 148,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        paddingHorizontal: 8,
        marginHorizontal: 3,
        marginTop: 6,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.85} tint="white" skipFirstDelay />
      <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.48} tint="gold" />
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={{ width: 16, height: 16, borderRadius: 8, marginRight: 5 }} />
      ) : (
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            marginRight: 5,
            backgroundColor: 'rgba(255,255,255,0.28)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="people" size={10} color="#FFFFFF" />
        </View>
      )}
      <TotlText numberOfLines={1} style={{ flexShrink: 1, color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: '900' }}>
        {name}
      </TotlText>
    </View>
  );
}

function MiniLeagueNoWinPanel({
  hasMiniLeagues,
  onPressMiniLeagues,
}: {
  hasMiniLeagues: boolean;
  onPressMiniLeagues: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <ResultsSectionTitle title="Mini-League Wins" badge={TEN_WEEK_FORM_BADGE} />
      {hasMiniLeagues ? (
        <TotlText style={{ color: '#64748B', fontSize: 12, lineHeight: 16, marginTop: 12, textAlign: 'center', maxWidth: 290 }}>
          No mini-league wins this week, but you&apos;re in the mix. One good Gameweek and the group chat is yours.
        </TotlText>
      ) : (
        <>
          <TotlText style={{ color: '#64748B', fontSize: 12, lineHeight: 16, marginTop: 12, textAlign: 'center', maxWidth: 290 }}>
            Mini-leagues are where TOTL gets spicy. Create or join one to make next Gameweek personal.
          </TotlText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to Mini Leagues"
            onPress={onPressMiniLeagues}
            style={({ pressed }) => ({
              marginTop: 10,
              borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.24)',
              paddingHorizontal: 16,
              paddingVertical: 8,
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <TotlText style={{ color: '#FFFFFF', fontSize: 12, lineHeight: 14, fontWeight: '900' }}>Go to Mini Leagues</TotlText>
          </Pressable>
        </>
      )}
    </View>
  );
}

function ResultsUserPill({ profile }: { profile?: ProfileSummary | null }) {
  const displayName = profile?.name?.trim() ? profile.name.trim() : 'You';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View
      style={{
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        backgroundColor: 'rgba(248,250,252,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.34)',
        paddingVertical: 5,
        paddingHorizontal: 9,
        marginBottom: 0,
        maxWidth: 220,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1C8376',
          marginRight: 8,
        }}
      >
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={{ width: 28, height: 28 }} />
        ) : (
          <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Bold', fontWeight: '900', fontSize: 13, lineHeight: 15 }}>
            {initial}
          </TotlText>
        )}
      </View>
      <TotlText
        numberOfLines={1}
        style={{
          flexShrink: 1,
          color: '#0F172A',
          fontFamily: 'Gramatika-Bold',
          fontWeight: '900',
          fontSize: 13,
          lineHeight: 15,
        }}
      >
        {displayName}
      </TotlText>
    </View>
  );
}

function ScoreSheetFixtureRow({
  fixture,
  liveScore,
  pick,
  result,
  index,
}: {
  fixture: Fixture;
  liveScore?: LiveScore | null;
  pick?: Pick | null;
  result?: Pick | null;
  index: number;
}) {
  const homeCode = String(fixture.home_code ?? fixture.home_name ?? '').toUpperCase();
  const awayCode = String(fixture.away_code ?? fixture.away_name ?? '').toUpperCase();
  const homeBadge = TEAM_BADGES[homeCode] ?? null;
  const awayBadge = TEAM_BADGES[awayCode] ?? null;
  const homeLabel = homeCode || getMediumName(String(fixture.home_name ?? fixture.home_team ?? 'HOME')).slice(0, 3).toUpperCase();
  const awayLabel = awayCode || getMediumName(String(fixture.away_name ?? fixture.away_team ?? 'AWAY')).slice(0, 3).toUpperCase();
  const hasScore = typeof liveScore?.home_score === 'number' && typeof liveScore?.away_score === 'number';
  const homeScore = hasScore ? String(liveScore?.home_score) : '-';
  const awayScore = hasScore ? String(liveScore?.away_score) : '-';
  const winningPick = result ?? null;
  const pickedCorrect = !!pick && !!winningPick && pick === winningPick;
  const showOutcomeMarker = !!pick && !!winningPick;

  const renderPickBar = (bucket: Pick) => {
    if (pick !== bucket) return <View style={{ height: 4, width: 52 }} />;
    if (pickedCorrect) {
      return (
        <LinearGradient
          colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 4, width: 52, borderRadius: 999 }}
        />
      );
    }
    return <View style={{ height: 4, width: 52, borderRadius: 999, backgroundColor: '#CBD5E1' }} />;
  };

  return (
    <View style={{ backgroundColor: index % 2 === 0 ? '#F5F7FA' : '#FFFFFF', paddingHorizontal: 10, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 26, alignItems: 'center', justifyContent: 'center' }}>
          {showOutcomeMarker ? (
            <Ionicons name={pickedCorrect ? 'checkmark-sharp' : 'close-sharp'} size={18} color={pickedCorrect ? '#16A34A' : '#DC2626'} />
          ) : null}
        </View>

        <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TotlText
              numberOfLines={1}
              style={{
                color: '#0F172A',
                fontFamily: winningPick === 'H' ? 'Gramatika-Bold' : 'Gramatika-Regular',
                fontWeight: winningPick === 'H' ? '800' : '600',
                fontSize: 12,
                lineHeight: 14,
                marginRight: 6,
              }}
            >
              {homeLabel}
            </TotlText>
            {homeBadge ? <Image source={homeBadge} style={{ width: 17, height: 17 }} resizeMode="contain" /> : null}
          </View>
        </View>

        <View style={{ width: 76, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Medium', fontWeight: '700', fontSize: 17, lineHeight: 18 }}>
              {homeScore}
            </TotlText>
            <TotlText style={{ color: '#334155', marginHorizontal: 5, fontFamily: 'Gramatika-Medium', fontWeight: '700', fontSize: 15, lineHeight: 16 }}>
              -
            </TotlText>
            <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Medium', fontWeight: '700', fontSize: 17, lineHeight: 18 }}>
              {awayScore}
            </TotlText>
          </View>
        </View>

        <View style={{ flex: 1, alignItems: 'flex-start', paddingLeft: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {awayBadge ? <Image source={awayBadge} style={{ width: 17, height: 17, marginRight: 6 }} resizeMode="contain" /> : null}
            <TotlText
              numberOfLines={1}
              style={{
                color: '#0F172A',
                fontFamily: winningPick === 'A' ? 'Gramatika-Bold' : 'Gramatika-Regular',
                fontWeight: winningPick === 'A' ? '800' : '600',
                fontSize: 12,
                lineHeight: 14,
              }}
            >
              {awayLabel}
            </TotlText>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <View style={{ width: 26 }} />
        <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 8 }}>{renderPickBar('H')}</View>
        <View style={{ width: 76, alignItems: 'center' }}>{renderPickBar('D')}</View>
        <View style={{ flex: 1, alignItems: 'flex-start', paddingLeft: 8 }}>{renderPickBar('A')}</View>
      </View>
    </View>
  );
}

function ResultsScoreSheetCardBody({ eventKey }: { eventKey?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['popup-card', 'results-score-sheet', eventKey ?? 'none'],
    staleTime: 60_000,
    queryFn: async (): Promise<{ gw: number; results: GwResults; snapshot: HomeSnapshot } | null> => {
      if (eventKey === 'simulator:resultsScoreSheet:example') {
        return buildSimulatorResultsScoreSheetPayload();
      }

      let gw = parseGwFromEventKey(eventKey);
      if (!gw) {
        const { data: latestGwRow, error: latestGwErr } = await supabase
          .from('app_gw_results')
          .select('gw')
          .order('gw', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestGwErr) throw latestGwErr;
        gw = typeof latestGwRow?.gw === 'number' ? latestGwRow.gw : null;
      }
      if (!gw) return null;
      const snapshot = await api.getHomeSnapshot({ gw });
      const results = await api.getGwResults(gw).catch(() => buildResultsFromScoreSheetSnapshot(snapshot));
      return { gw, results, snapshot };
    },
  });
  const { data: profileSummary } = useQuery<ProfileSummary>({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
        <TotlText style={{ color: '#334155', textAlign: 'center', fontSize: 14, lineHeight: 18 }}>Loading your score sheet...</TotlText>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
        <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 18, lineHeight: 22 }}>
          Score sheet
        </TotlText>
        <TotlText style={{ color: '#475569', textAlign: 'center', marginTop: 8, fontSize: 13, lineHeight: 17 }}>
          Your score sheet will appear here once this gameweek is final.
        </TotlText>
      </View>
    );
  }

  const liveByFixture = new Map<number, LiveScore>();
  data.snapshot.liveScores.forEach((liveScore) => {
    if (typeof liveScore.fixture_index === 'number') liveByFixture.set(liveScore.fixture_index, liveScore);
  });
  const resultByFixture = new Map<number, Pick>();
  data.snapshot.gwResults.forEach((row) => resultByFixture.set(row.fixture_index, row.result));
  const fixtures = [...data.snapshot.fixtures].sort((a, b) => Number(a.fixture_index) - Number(b.fixture_index));
  const hasUnfinishedFixtures = fixtures.some((fixture) => !resultByFixture.has(Number(fixture.fixture_index)));

  return (
    <View style={{ flex: 1, width: '100%', paddingTop: 0, paddingBottom: 0 }}>
      <View style={{ alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <ResultsUserPill profile={profileSummary} />
          <View
            style={{
              marginLeft: 8,
              minHeight: 40,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: 'rgba(248,250,252,0.92)',
              borderWidth: 1,
              borderColor: 'rgba(15,23,42,0.08)',
              paddingVertical: 5,
              paddingHorizontal: 14,
            }}
          >
            {hasUnfinishedFixtures ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#DC2626', marginRight: 7 }} /> : null}
            <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', fontWeight: '900', fontSize: 15, lineHeight: 17 }}>
              {data.results.score}/{data.results.totalFixtures}
            </TotlText>
          </View>
        </View>
        <TotlText style={{ color: '#64748B', fontFamily: 'Gramatika-Medium', fontWeight: '700', fontSize: 13, lineHeight: 17, marginTop: 2 }}>
          Gameweek {data.gw} score sheet
        </TotlText>
      </View>

      <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
        {fixtures.slice(0, 10).map((fixture, index) => {
          const fixtureIndex = Number(fixture.fixture_index);
          return (
            <ScoreSheetFixtureRow
              key={`score-sheet-${fixtureIndex}`}
              fixture={fixture}
              liveScore={liveByFixture.get(fixtureIndex) ?? null}
              pick={data.snapshot.userPicks[String(fixtureIndex)] ?? null}
              result={resultByFixture.get(fixtureIndex) ?? null}
              index={index}
            />
          );
        })}
      </View>
    </View>
  );
}

function ResultsCardBody({
  eventKey,
  onClose,
  isShareAsset = false,
}: {
  eventKey?: string;
  onClose?: () => void;
  isShareAsset?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['popup-card', 'results', eventKey ?? 'none'],
    staleTime: 60_000,
    queryFn: async (): Promise<{ gw: number; results: GwResults } | null> => {
      if (eventKey === 'simulator:results:example-no-wins-in-leagues') {
        return buildSimulatorResultsPayload('noWinsInLeagues');
      }
      if (eventKey === 'simulator:results:example-no-leagues') {
        return buildSimulatorResultsPayload('noLeagues');
      }
      if (eventKey === 'simulator:results:example-wins') {
        return buildSimulatorResultsPayload('wins');
      }

      let gw = parseGwFromEventKey(eventKey);
      if (!gw) {
        const { data: latestGwRow, error: latestGwErr } = await supabase
          .from('app_gw_results')
          .select('gw')
          .order('gw', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestGwErr) throw latestGwErr;
        gw = typeof latestGwRow?.gw === 'number' ? latestGwRow.gw : null;
      }
      if (!gw) return null;
      return { gw, results: await api.getGwResults(gw) };
    },
  });
  const { data: profileSummary } = useQuery<ProfileSummary>({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
        <TotlText style={{ color: '#334155', textAlign: 'center', fontSize: 14, lineHeight: 18 }}>Loading your results...</TotlText>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
        <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 18, lineHeight: 22 }}>Results</TotlText>
        <TotlText style={{ color: '#475569', textAlign: 'center', marginTop: 8, fontSize: 13, lineHeight: 17 }}>
          Results will appear here once this gameweek is final.
        </TotlText>
      </View>
    );
  }

  const { gw, results } = data;
  const topPercent = formatTopPercent(results.gwRank, results.gwRankTotal);
  const hasMiniLeagueWins = results.mlVictories > 0;
  const showMiniLeagueSection = hasMiniLeagueWins || !isShareAsset;
  const hasMiniLeagueMemberships = Number(results.mlMembershipCount ?? 0) > 0;
  const hasGwRank = !!results.gwRank && !!results.gwRankTotal;
  const gwRankValue = hasGwRank ? `${results.gwRank}${ordinalSuffix(results.gwRank as number)}` : '--';
  const [positionPrefix, positionValue] = topPercent ? topPercent.split(' ') : ['', '--'];
  const titleToContentGap = 12;
  const handlePressMiniLeagues = () => {
    onClose?.();
    if (navigationRef.isReady()) {
      navigationRef.navigate('Tabs' as any, { screen: 'Leagues', params: { screen: 'LeaguesList' } } as any);
    }
  };

  return (
    <View style={{ flex: 1, width: '100%', justifyContent: 'space-evenly', paddingTop: 0, paddingBottom: 12, transform: [{ translateY: 8 }] }}>
      <View style={{ transform: [{ translateY: -12 }] }}>
        <View style={{ transform: [{ translateY: -10 }] }}>
          <ResultsUserPill profile={profileSummary} />
        </View>
        <View style={{ height: 8 }} />
        <ResultsSectionTitle title={`Gameweek ${gw} Results`} badge={FIVE_WEEK_FORM_BADGE} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: titleToContentGap }}>
          <AchievementMetric
            label="Score"
            value={`${results.score}/${results.totalFixtures}`}
            width="31%"
            showTopLine={false}
          />
          <GlobalSummaryMetric
            rankValue={gwRankValue}
            rankTotal={hasGwRank ? results.gwRankTotal : null}
            positionPrefix={positionPrefix || undefined}
            positionValue={positionValue ?? '--'}
          />
        </View>
      </View>

      <View style={{ marginTop: 6 }}>
        <ResultsSectionTitle title="2025/26 Season" badge={SEASON_RANK_BADGE} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: titleToContentGap }}>
          <RankAchievementMetric label="Overall" rank={results.leaderboardChanges.overall.after} change={results.leaderboardChanges.overall.change} />
          <RankAchievementMetric
            label="5 Week Form"
            rank={results.leaderboardChanges.form5.after}
            change={results.leaderboardChanges.form5.change}
            emptyText="Play 5 weeks in a row to see your form"
          />
          <RankAchievementMetric
            label="10 Week Form"
            rank={results.leaderboardChanges.form10.after}
            change={results.leaderboardChanges.form10.change}
            emptyText="Play 10 weeks in a row to see your form"
          />
        </View>
      </View>

      {showMiniLeagueSection ? (
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          {hasMiniLeagueWins ? (
            <>
              <ResultsSectionTitle title="Mini-League Wins" badge={TEN_WEEK_FORM_BADGE} />
              <TotlText style={{ color: '#64748B', fontSize: 11, lineHeight: 14, marginTop: titleToContentGap, textAlign: 'center' }}>
                You topped {results.mlVictories} mini-league{results.mlVictories === 1 ? '' : 's'} this week
              </TotlText>
              <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                {(results.mlVictoryData.length > 0
                  ? results.mlVictoryData
                  : results.mlVictoryNames.map((name, index) => ({ id: `ml-win-${index}`, name, avatar: null }))
                ).map((league) => (
                  <MiniLeagueVictoryPill key={league.id} league={league} />
                ))}
              </View>
            </>
          ) : (
            <MiniLeagueNoWinPanel hasMiniLeagues={hasMiniLeagueMemberships} onPressMiniLeagues={handlePressMiniLeagues} />
          )}
        </View>
      ) : null}
    </View>
  );
}

function NewGameweekCardBody({ eventKey, onClose }: { eventKey?: string; onClose?: () => void }) {
  const queryClient = useQueryClient();
  const [isAdvancing, setIsAdvancing] = React.useState(false);
  const { data: home } = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
    staleTime: 60_000,
  });

  const eventGw = parseGwFromEventKey(eventKey);
  const nextGw = eventGw ?? (typeof home?.currentGw === 'number' ? home.currentGw : null);

  const handleReadyToGo = async () => {
    if (!nextGw || isAdvancing) return;
    setIsAdvancing(true);
    try {
      await api.updateNotificationPrefs({ current_viewing_gw: nextGw });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] }),
        queryClient.invalidateQueries({ queryKey: ['homeRanks'] }),
        queryClient.invalidateQueries({ queryKey: ['leagues'] }),
      ]);
      onClose?.();
    } catch (error) {
      console.error('[NewGameweekCardBody] Failed to move to new gameweek:', error);
      setIsAdvancing(false);
    }
  };

  return (
    <View style={{ flex: 1, width: '100%', paddingTop: 12, paddingBottom: 12, position: 'relative' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', alignItems: 'center', transform: [{ translateY: -70 }] }}>
        <TotlText
          style={{
            color: '#FFFFFF',
            fontFamily: 'Gramatika-Bold',
            textAlign: 'center',
            fontWeight: '900',
            fontSize: 24,
            lineHeight: 28,
          }}
        >
          Gameweek {nextGw ?? ''} is ready
        </TotlText>
        <TotlText style={{ color: 'rgba(255,255,255,0.82)', textAlign: 'center', marginTop: 12, fontSize: 13, lineHeight: 18, maxWidth: 286 }}>
          The next set of fixtures is live. Move on when you&apos;re ready and start making your picks.
        </TotlText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Move to the new gameweek"
          disabled={!nextGw || isAdvancing}
          onPress={handleReadyToGo}
          style={({ pressed }) => ({
            marginTop: 16,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: '#FFFFFF',
            opacity: !nextGw || isAdvancing ? 0.65 : pressed ? 0.86 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <TotlText style={{ color: '#1C8376', fontFamily: 'Gramatika-Bold', fontSize: 14, lineHeight: 16, fontWeight: '900' }}>
            Ready to go
          </TotlText>
          <View style={{ width: 8 }} />
          <Ionicons name="arrow-forward" size={16} color="#1C8376" />
        </Pressable>
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <TotlText style={{ color: 'rgba(255,255,255,0.78)', textAlign: 'center', fontSize: 12, lineHeight: 15, fontWeight: '700' }}>
          Swipe away if you aren&apos;t ready{'\n'}to move on just yet
        </TotlText>
        <View style={{ marginTop: 6 }}>
          <SwipeFingerIcon color="rgba(255,255,255,0.78)" />
        </View>
      </View>
    </View>
  );
}

function DoPredictionsCardBody({ eventKey, onClose }: { eventKey?: string; onClose?: () => void }) {
  const eventGw = parseGwFromEventKey(eventKey);
  const isSimulatorExample = eventKey?.startsWith('simulator:') === true;
  const { data: home } = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
    staleTime: 60_000,
  });
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const deadline = React.useMemo(
    () => (isSimulatorExample ? getSimulatorPredictionsDeadline() : getPredictionsDeadline(home?.fixtures ?? null)),
    [home?.fixtures, isSimulatorExample]
  );
  const countdownLabel = React.useMemo(() => (deadline ? formatCountdown(deadline, nowMs) : null), [deadline, nowMs]);

  React.useEffect(() => {
    if (isSimulatorExample || !deadline) return;
    if (deadline.getTime() > Date.now()) return;
    onClose?.();
  }, [deadline, isSimulatorExample, onClose]);

  React.useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const handleDoPredictions = () => {
    onClose?.();
    requestAnimationFrame(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('PredictionsFlow');
      }
    });
  };

  return (
    <View style={{ flex: 1, width: '100%', position: 'relative', overflow: 'hidden' }}>
      <LinearGradient
        colors={['rgba(250,204,21,0.28)', 'rgba(45,212,191,0.18)', 'rgba(168,85,247,0.16)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: -24, right: -24, bottom: -24, left: -24 }}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', alignItems: 'center', transform: [{ translateY: -122 }] }}>
        <View
          style={{
            width: 58,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PredictionsFooterIcon size={42} color="#0F172A" />
        </View>

        <TotlText
          style={{
            color: '#0F172A',
            fontFamily: 'Gramatika-Bold',
            textAlign: 'center',
            fontWeight: '900',
            fontSize: 22,
            lineHeight: 26,
            marginTop: 6,
            maxWidth: 292,
          }}
        >
          Ready to do your predictions?
        </TotlText>
        <TotlText style={{ color: '#334155', textAlign: 'center', marginTop: 10, fontSize: 13, lineHeight: 18, maxWidth: 292 }}>
          Gameweek {eventGw ?? ''} is waiting.{'\n'}Make your predictions before deadline.
        </TotlText>

        {countdownLabel ? (
          <View
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Ionicons name="time-outline" size={16} color="#0F172A" />
            <TotlText
              style={{
                marginLeft: 6,
                color: '#0F172A',
                fontFamily: 'Gramatika-Bold',
                fontWeight: '900',
                fontSize: 13,
                lineHeight: 15,
              }}
            >
              {countdownLabel === 'Deadline passed' ? countdownLabel : `Deadline in ${countdownLabel}`}
            </TotlText>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Do your predictions"
          onPress={handleDoPredictions}
          style={({ pressed }) => ({
            marginTop: countdownLabel ? 14 : 18,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: '#1C8376',
            opacity: pressed ? 0.86 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#1C8376',
            shadowOpacity: 0.22,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 7 },
            elevation: 5,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Bold', fontSize: 14, lineHeight: 16, fontWeight: '900' }}>
            Do your predictions
          </TotlText>
          <View style={{ width: 8 }} />
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 20, alignItems: 'center', justifyContent: 'center' }}>
        <TotlText style={{ color: '#475569', textAlign: 'center', fontSize: 12, lineHeight: 15, fontWeight: '700' }}>
          Swipe away if you&apos;re not{'\n'}ready to pick just yet
        </TotlText>
        <View style={{ marginTop: 6 }}>
          <SwipeFingerIcon color="#64748B" />
        </View>
      </View>
    </View>
  );
}

function WinnersCardBody({ eventKey }: { eventKey?: string }) {
  const { data: authUser } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },
    staleTime: 60_000,
  });
  const currentUserId = authUser?.id ? String(authUser.id) : null;

  const { data, isLoading } = useQuery({
    queryKey: ['popup-card', 'winners', eventKey ?? 'none', currentUserId ?? 'anonymous'],
    enabled: true,
    staleTime: 60_000,
    queryFn: async (): Promise<WinnersCardPayload | null> => {
      if (eventKey === 'simulator:winners:example-single') {
        return buildSimulatorWinnersPayload('single', currentUserId);
      }
      if (eventKey === 'simulator:winners:example-1to10') {
        return buildSimulatorWinnersPayload('1to10', currentUserId);
      }
      if (eventKey === 'simulator:winners:example-11plus') {
        return buildSimulatorWinnersPayload('11plus', currentUserId);
      }
      if (eventKey === 'simulator:winners:example-20each') {
        return buildSimulatorWinnersPayload('20each', currentUserId);
      }
      if (eventKey === 'simulator:winners:example-with-me') {
        return buildSimulatorWinnersPayload('withMe', currentUserId);
      }

      let gw = parseGwFromEventKey(eventKey);
      if (!gw) {
        const { data: latestGwRow, error: latestGwErr } = await supabase
          .from('app_gw_results')
          .select('gw')
          .order('gw', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestGwErr) throw latestGwErr;
        gw = typeof latestGwRow?.gw === 'number' ? latestGwRow.gw : null;
      }
      if (!gw) return null;

      const gwRows = await fetchAllSupabaseRows<GwPointsRow>((from, to) =>
        supabase
          .from('app_v_gw_points')
          .select('user_id, gw, points')
          .eq('gw', gw)
          .order('user_id', { ascending: true })
          .range(from, to)
      );
      if (!gwRows.length) return null;

      const gwWinningPoints = Math.max(...gwRows.map((row) => Number(row.points ?? 0)));
      const gwWinnerIds = gwRows
        .filter((row) => Number(row.points ?? 0) === gwWinningPoints)
        .map((row) => String(row.user_id));

      const month = getMonthForGw(gw);
      let monthlyData: WinnersCardPayload['monthly'] = null;
      let monthlyWinnerIds: string[] = [];
      if (month && gw === month.endGw) {
        const monthRows = await fetchAllSupabaseRows<GwPointsRow>((from, to) =>
          supabase
            .from('app_v_gw_points')
            .select('user_id, gw, points')
            .gte('gw', month.startGw)
            .lte('gw', month.endGw)
            .order('gw', { ascending: true })
            .order('user_id', { ascending: true })
            .range(from, to)
        );
        if (monthRows.length) {
          const monthlyTotalsByUser = new Map<string, number>();
          monthRows.forEach((row) => {
            const userId = String(row.user_id);
            monthlyTotalsByUser.set(userId, (monthlyTotalsByUser.get(userId) ?? 0) + Number(row.points ?? 0));
          });
          const monthlyTop = Math.max(...Array.from(monthlyTotalsByUser.values()));
          monthlyWinnerIds = Array.from(monthlyTotalsByUser.entries())
            .filter(([, score]) => score === monthlyTop)
            .map(([userId]) => userId);
          monthlyData = {
            label: month.label,
            winningPoints: monthlyTop,
            winners: [],
          };
        }
      }

      const allWinnerIds = Array.from(new Set([...gwWinnerIds, ...monthlyWinnerIds]));
      const usersMap = new Map<string, UserRow>();
      if (allWinnerIds.length > 0) {
        const { data: usersData, error: usersErr } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .in('id', allWinnerIds);
        if (usersErr) throw usersErr;
        (usersData ?? []).forEach((row: any) => {
          const id = String(row.id);
          usersMap.set(id, {
            id,
            name: typeof row.name === 'string' ? row.name : null,
            avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
          });
        });
      }

      const mapWinner = (userId: string): WinnerEntry => {
        const isCurrentUser = !!currentUserId && userId === currentUserId;
        return {
          user_id: userId,
          name: isCurrentUser ? 'You' : usersMap.get(userId)?.name ?? fallbackName(userId),
          avatar_url: usersMap.get(userId)?.avatar_url ?? null,
          isCurrentUser,
        };
      };

      const gwWinners = gwWinnerIds.map(mapWinner).sort((a, b) => a.name.localeCompare(b.name));
      const monthlyWinners = monthlyWinnerIds.map(mapWinner).sort((a, b) => a.name.localeCompare(b.name));

      if (monthlyData) {
        monthlyData = { ...monthlyData, winners: monthlyWinners };
      }

      return {
        gw,
        gwWinningPoints,
        gwWinners,
        monthly: monthlyData,
      };
    },
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
        <TotlText style={{ color: '#334155', textAlign: 'center', fontSize: 14, lineHeight: 18 }}>
          Loading this week&apos;s winners...
        </TotlText>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
        <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 18, lineHeight: 22 }}>
          Winners
        </TotlText>
        <TotlText style={{ color: '#475569', textAlign: 'center', marginTop: 8, fontSize: 13, lineHeight: 17 }}>
          Winners will appear here once results are final.
        </TotlText>
      </View>
    );
  }

  const gwJoint = data.gwWinners.length > 1;
  const hasMonthly = !!data.monthly;
  const monthJoint = (data.monthly?.winners.length ?? 0) > 1;
  const gwWinnerCount = data.gwWinners.length;
  const monthlyWinnerCount = data.monthly?.winners.length ?? 0;
  const titleToContentGap = 12;
  const copyGap = 8;
  const gwWinnersLabel = `${gwWinnerCount} ${gwWinnerCount === 1 ? 'winner' : 'winners'}`;
  const monthlyWinnersLabel = `${monthlyWinnerCount} ${monthlyWinnerCount === 1 ? 'winner' : 'winners'}`;

  if (!hasMonthly) {
    return (
      <View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
        <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 22, lineHeight: 26 }}>
          Gameweek {data.gw} Winners
        </TotlText>
        <View style={{ width: '100%', marginTop: titleToContentGap, alignItems: 'center' }}>
          <TotlText style={{ color: '#475569', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontSize: 13, lineHeight: 17, fontWeight: '900' }}>
            25/26 Leaderboard
          </TotlText>
          <TotlText style={{ color: '#0F172A', textAlign: 'center', marginTop: copyGap, marginBottom: titleToContentGap, fontSize: 13, lineHeight: 17, fontWeight: '700' }}>
            {gwJoint
              ? `${gwWinnersLabel} this week with ${data.gwWinningPoints} points!`
              : `1 winner this week with ${data.gwWinningPoints} points!`}
          </TotlText>
          <WinnerColumnsScroller winners={data.gwWinners} roomy />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, width: '100%', justifyContent: 'space-evenly', paddingTop: 12, paddingBottom: 12 }}>
      <View style={{ width: '100%', alignItems: 'center' }}>
        <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 22, lineHeight: 26 }}>
          Gameweek {data.gw} Winners
        </TotlText>
        <View style={{ width: '100%', marginTop: titleToContentGap, alignItems: 'center' }}>
          <TotlText style={{ color: '#475569', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontSize: 13, lineHeight: 17, fontWeight: '900' }}>
            25/26 Leaderboard
          </TotlText>
          <TotlText style={{ color: '#0F172A', textAlign: 'center', marginTop: copyGap, marginBottom: titleToContentGap, fontSize: 13, lineHeight: 17, fontWeight: '700' }}>
            {gwJoint
              ? `${gwWinnersLabel} this week with ${data.gwWinningPoints} points!`
              : `1 winner this week with ${data.gwWinningPoints} points!`}
          </TotlText>
          <WinnerColumnsScroller winners={data.gwWinners} />
        </View>
      </View>

      <View style={{ width: '100%', alignItems: 'center' }}>
        <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 22, lineHeight: 26 }}>
          Player of the Month
        </TotlText>
        <View style={{ width: '100%', marginTop: titleToContentGap, alignItems: 'center' }}>
          <TotlText style={{ color: '#475569', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '900' }}>
            {data.monthly?.label}
          </TotlText>
          <TotlText style={{ color: '#0F172A', textAlign: 'center', marginTop: copyGap, marginBottom: titleToContentGap, fontSize: 13, lineHeight: 17, fontWeight: '700' }}>
            {monthJoint
              ? `${monthlyWinnersLabel} this month with ${data.monthly?.winningPoints} points!`
              : `1 winner this month with ${data.monthly?.winningPoints} points!`}
          </TotlText>
          <WinnerColumnsScroller winners={data.monthly?.winners ?? []} />
        </View>
      </View>
    </View>
  );
}

function PersonalWinnerDetail({ data }: { data: PersonalWinnerCardPayload }) {
  const isMonthly = data.victoryType === 'monthly';
  const title = data.label;
  const subtitle = isMonthly
    ? data.joint
      ? `Joint Player of the Month with ${data.winnerCount - 1} other${data.winnerCount === 2 ? '' : 's'}`
      : 'Player of the Month'
    : data.joint
      ? `Joint winner with ${data.winnerCount - 1} other${data.winnerCount === 2 ? '' : 's'}`
      : 'Outright Gameweek winner';
  return (
    <View
      style={{
        width: '100%',
        paddingHorizontal: 18,
        paddingVertical: 4,
        alignItems: 'center',
      }}
    >
      <View style={{ marginBottom: 8 }}>
        <Ionicons name="trophy" size={30} color="#FFFFFF" />
      </View>
      <TotlText
        style={{
          color: 'rgba(255,255,255,0.90)',
          fontFamily: 'Gramatika-Bold',
          fontWeight: '900',
          fontSize: 17,
          lineHeight: 21,
          textAlign: 'center',
          textShadowColor: 'rgba(15,23,42,0.30)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 5,
        }}
      >
        {title}
      </TotlText>
      <TotlText
        style={{
          color: '#FFFFFF',
          fontFamily: 'Gramatika-Bold',
          fontWeight: '900',
          fontSize: 38,
          lineHeight: 41,
          textAlign: 'center',
          marginTop: 2,
          textShadowColor: 'rgba(15,23,42,0.34)',
          textShadowOffset: { width: 0, height: 3 },
          textShadowRadius: 7,
        }}
      >
        1st
      </TotlText>
      <TotlText
        style={{
          color: 'rgba(255,255,255,0.92)',
          fontWeight: '800',
          fontSize: 13,
          lineHeight: 17,
          textAlign: 'center',
          marginTop: 6,
          textShadowColor: 'rgba(15,23,42,0.22)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
      >
        {subtitle}
      </TotlText>
    </View>
  );
}

function PersonalWinnerHeader({ profile, data }: { profile?: ProfileSummary | null; data: PersonalWinnerCardPayload }) {
  const scoreText = data.victoryType === 'gameweek' ? `${data.points}/10` : `${data.points}`;
  const scoreLabel = data.victoryType === 'gameweek' ? null : data.points === 1 ? 'point' : 'points';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
      <ResultsUserPill profile={profile} />
      <View
        style={{
          marginLeft: 8,
          minHeight: 40,
          borderRadius: 999,
          paddingHorizontal: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.72)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.34)',
        }}
      >
        <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', fontWeight: '900', fontSize: 14, lineHeight: 17 }}>
          {scoreText}
        </TotlText>
        {scoreLabel ? (
          <TotlText style={{ color: '#0F172A', fontWeight: '800', fontSize: 9, lineHeight: 11 }}>
            {scoreLabel}
          </TotlText>
        ) : null}
      </View>
    </View>
  );
}

function PersonalWinnerCardBody({ eventKey }: { eventKey?: string }) {
  const { data: authUser } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },
    staleTime: 60_000,
  });
  const currentUserId = authUser?.id ? String(authUser.id) : null;

  const { data, isLoading } = useQuery({
    queryKey: ['popup-card', 'personalWinner', eventKey ?? 'none', currentUserId ?? 'anonymous'],
    enabled: true,
    staleTime: 60_000,
    queryFn: async (): Promise<PersonalWinnerCardPayload | null> => {
      if (eventKey === 'simulator:personalWinner:gw') return buildSimulatorPersonalWinnerPayload('gameweek');
      if (eventKey === 'simulator:personalWinner:monthly') return buildSimulatorPersonalWinnerPayload('monthly');
      return fetchPersonalWinnerPayload(eventKey, currentUserId);
    },
  });
  const { data: profileSummary } = useQuery<ProfileSummary>({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
        <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 18, lineHeight: 22 }}>
          Loading your win...
        </TotlText>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
        <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 18, lineHeight: 22 }}>
          Winner card
        </TotlText>
      </View>
    );
  }

  const isMonthly = data.victoryType === 'monthly';

  return (
    <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingTop: 4, paddingBottom: 4 }}>
      <View style={{ alignItems: 'center', marginBottom: 30, zIndex: 5, width: '100%' }}>
        <PersonalWinnerHeader profile={profileSummary} data={data} />
        <TotlText
          style={{
            color: '#FFFFFF',
            fontFamily: 'Gramatika-Bold',
            fontWeight: '900',
            fontSize: 48,
            lineHeight: 52,
            textAlign: 'center',
            textShadowColor: 'transparent',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 0,
          }}
        >
          You Win!
        </TotlText>
        <TotlText
          style={{
            color: '#FFFFFF',
            fontFamily: 'Gramatika-Bold',
            fontWeight: '900',
            fontSize: 16,
            lineHeight: 20,
            textAlign: 'center',
            marginTop: 8,
            textShadowColor: 'rgba(15,23,42,0.24)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 5,
          }}
        >
          Top of the league. Scenes!
        </TotlText>
        {isMonthly ? (
          <TotlText
            style={{
              color: '#E0E7FF',
              fontFamily: 'Gramatika-Bold',
              fontWeight: '900',
              fontSize: 13,
              lineHeight: 17,
              textAlign: 'center',
              marginTop: 6,
              textShadowColor: 'rgba(15,23,42,0.22)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 4,
            }}
          >
            Player of the Month
          </TotlText>
        ) : null}
      </View>

      <View style={{ width: '100%', zIndex: 5, marginTop: 2 }}>
        <PersonalWinnerDetail data={data} />
      </View>
    </View>
  );
}

function PersonalWinnerShinyBackground({ animated = true, variant = 'gameweek' }: { animated?: boolean; variant?: 'gameweek' | 'monthly' }) {
  const isMonthly = variant === 'monthly';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 28, overflow: 'hidden' }}>
      <LinearGradient
        colors={isMonthly ? ['#312E81', '#4F46E5', '#7C3AED', '#C084FC', '#60A5FA'] : ['#FACC15', '#FB7185', '#EC4899', '#A855F7', '#22D3EE', '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      {animated ? (
        <>
          <WinnerShimmer durationMs={1000} delayMs={0} opacity={0.96} tint="white" skipFirstDelay />
          <WinnerShimmer durationMs={1500} delayMs={260} opacity={0.62} tint="gold" />
        </>
      ) : null}
    </View>
  );
}

function WinnersAnimatedBorder({ animated = true }: { animated?: boolean }) {
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 28,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        {animated ? (
          <>
            <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" skipFirstDelay />
            <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
          </>
        ) : null}
      </View>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          bottom: 10,
          left: 10,
          borderRadius: 18,
          backgroundColor: '#FFFFFF',
        }}
      />
    </>
  );
}

function ResultsEmeraldBorder() {
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 28,
          backgroundColor: '#1C8376',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          bottom: 10,
          left: 10,
          borderRadius: 18,
          backgroundColor: '#FFFFFF',
        }}
      />
    </>
  );
}

export default function PopupInfoCard({
  kind,
  title,
  eventKey,
  isTopCard,
  isShareAsset = false,
  onClose,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  kind?: PopupCardKind;
  title: string;
  eventKey?: string;
  isTopCard: boolean;
  isShareAsset?: boolean;
  onClose?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) {
  const showWinnersFrame = kind === 'winners';
  const showPersonalWinnerFrame = kind === 'personalWinner';
  const showResultsFrame = false;
  const showNewGameweekFrame = kind === 'newGameweek';
  const showDoPredictionsCard = kind === 'doPredictions';
  const showInsetFrame = showWinnersFrame || showPersonalWinnerFrame || showResultsFrame;
  const showEmeraldCard = kind === 'newGameweek';
  const runDecorativeAnimations = isTopCard && !isShareAsset;
  const personalWinnerVariant = showPersonalWinnerFrame ? parsePersonalWinnerTypeFromEventKey(eventKey) : 'gameweek';
  const content = (
    <View
      style={{
        flex: 1,
        backgroundColor: showEmeraldCard ? '#1C8376' : showInsetFrame ? 'transparent' : '#FFFFFF',
        borderRadius: 28,
        paddingHorizontal: showDoPredictionsCard ? 0 : 24,
        paddingTop: showDoPredictionsCard ? 0 : kind === 'resultsScoreSheet' ? 18 : 24,
        paddingBottom: showDoPredictionsCard ? 0 : 22,
        justifyContent: 'space-between',
        overflow: showInsetFrame || showDoPredictionsCard ? 'hidden' : 'visible',
      }}
    >
      {showPersonalWinnerFrame ? <PersonalWinnerShinyBackground animated={runDecorativeAnimations} variant={personalWinnerVariant} /> : null}
      {showWinnersFrame ? <WinnersAnimatedBorder animated={runDecorativeAnimations} /> : null}
      {showResultsFrame ? <ResultsEmeraldBorder /> : null}
      {isTopCard && onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close popup"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => ({
            position: 'absolute',
            top: 20,
            right: 20,
            zIndex: 20,
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: showEmeraldCard ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.05)',
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Ionicons name="close" size={20} color={showEmeraldCard ? '#FFFFFF' : '#0F172A'} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1 }}>
        {kind === 'resultsScoreSheet' ? (
          <ResultsScoreSheetCardBody eventKey={eventKey} />
        ) : kind === 'results' ? (
          <ResultsCardBody eventKey={eventKey} onClose={onClose} isShareAsset={isShareAsset} />
        ) : kind === 'personalWinner' ? (
          <PersonalWinnerCardBody eventKey={eventKey} />
        ) : kind === 'winners' ? (
          <WinnersCardBody eventKey={eventKey} />
        ) : kind === 'newGameweek' ? (
          <NewGameweekCardBody eventKey={eventKey} onClose={onClose} />
        ) : kind === 'doPredictions' ? (
          <DoPredictionsCardBody eventKey={eventKey} onClose={onClose} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <TotlText
              style={{
                color: '#0F172A',
                fontFamily: 'Gramatika-Bold',
                fontWeight: '900',
                fontSize: 28,
                lineHeight: 32,
                textAlign: 'center',
              }}
            >
              {title}
            </TotlText>
          </View>
        )}
      </View>

      <View style={{ minHeight: showDoPredictionsCard ? 0 : 26, alignItems: 'center', justifyContent: 'flex-end' }}>
        {isTopCard && secondaryActionLabel && onSecondaryAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={secondaryActionLabel}
            onPress={onSecondaryAction}
            style={({ pressed }) => ({
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <TotlText
              style={{
                color: '#1C8376',
                fontFamily: 'Gramatika-Medium',
                fontWeight: '700',
                fontSize: 14,
                lineHeight: 18,
              }}
            >
              {secondaryActionLabel}
            </TotlText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  if (!showWinnersFrame) return content;

  return content;
}
