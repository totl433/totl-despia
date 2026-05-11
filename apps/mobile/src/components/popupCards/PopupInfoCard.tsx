import React from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { DimensionValue, ImageSourcePropType } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Mask,
  Path,
  Pattern,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { TotlText } from '@totl/ui';
import type { Fixture, GwResults, HomeSnapshot, LiveScore, Pick, ProfileSummary } from '@totl/domain';

import {
  fetchMiniLeagueChampionSummaryForUserAndLeague,
  fetchOverallChampionSummaryForUser,
  type MiniLeagueChampionSummary,
  type OverallChampionSummary,
} from '../../lib/championEligibility';

import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { getDefaultMlAvatarFilename, resolveLeagueAvatarUri } from '../../lib/leagueAvatars';
import { getMonthForGw, SEASON_LAST_GW } from '../../lib/leaderboardMonths';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { navigationRef } from '../../navigation/AppNavigator';
import WinnerShimmer from '../WinnerShimmer';
import type { PopupCardKind } from './types';
import { getMediumName } from '../../../../../src/lib/teamNames';
import {
  buildLiveScoreMapForFixtures,
  hydrateLiveScoreFromDb,
  liveScoreHasNumericLine,
  scoreStringsForFixtureRow,
} from '../../lib/scoreSheetLiveScores';

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

/** Overall champion card backdrop trophy (SVG matches Ionicons 7 `trophy` glyph). */
const TROPHY_WATERMARK_SIZE = 260;
/** Mini-league champion watermark — larger silhouette than overall silver card. */
const MINI_LEAGUE_TROPHY_WATERMARK_SIZE = 336;
/** Nudge watermark down so it matches visual center of the card (body shares space with footer strip). */
const TROPHY_VERTICAL_ALIGN_OFFSET = 14;
/** Ionicons 7 trophy.svg — silhouette mask for interior holo. */
const IONICON_TROPHY_PATH =
  'M464 80h-60.1a4 4 0 01-4-4V63.92a32 32 0 00-32-31.92l-223.79.26a32 32 0 00-31.94 31.93V76a4 4 0 01-4 4H48a16 16 0 00-16 16v16c0 54.53 30 112.45 76.52 125.35a7.82 7.82 0 015.55 5.9c5.77 26.89 23.52 52.5 51.41 73.61 20.91 15.83 45.85 27.5 68.27 32.48a8 8 0 016.25 7.8V444a4 4 0 01-4 4h-59.55c-8.61 0-16 6.62-16.43 15.23A16 16 0 00176 480h159.55c8.61 0 16-6.62 16.43-15.23A16 16 0 00336 448h-60a4 4 0 01-4-4v-86.86a8 8 0 016.25-7.8c22.42-5 47.36-16.65 68.27-32.48 27.89-21.11 45.64-46.72 51.41-73.61a7.82 7.82 0 015.55-5.9C450 224.45 480 166.53 480 112V96a16 16 0 00-16-16zM112 198.22a4 4 0 01-6 3.45c-10.26-6.11-17.75-15.37-22.14-21.89-11.91-17.69-19-40.67-19.79-63.63a4 4 0 014-4.15h40a4 4 0 014 4c-.02 27.45-.07 58.87-.07 82.22zm316.13-18.44c-4.39 6.52-11.87 15.78-22.13 21.89a4 4 0 01-6-3.46c0-26.51 0-56.63-.05-82.21a4 4 0 014-4h40a4 4 0 014 4.15c-.79 22.96-7.9 45.94-19.81 63.63z';
/** Heroicons-style cup (matches profile trophy cabinet) — distinct from overall Ionicons watermark. viewBox 24×24. */
const MINI_LEAGUE_HERO_TROPHY_PATH =
  'M16 3c1.1046 0 2 0.89543 2 2h2c1.1046 0 2 0.89543 2 2v1c0 2.695-2.1323 4.89-4.8018 4.9941-.8777 1.5207-2.4019 2.6195-4.1982 2.9209V19h3c.5523 0 1 .4477 1 1s-.4477 1-1 1H8c-.55228 0-1-.4477-1-1s.44772-1 1-1h3v-3.085c-1.7965-.3015-3.32148-1.4-4.19922-2.9209C4.13175 12.8895 2 10.6947 2 8V7c0-1.10457.89543-2 2-2h2c0-1.10457.89543-2 2-2zm-8 7c0 2.2091 1.79086 4 4 4 2.2091 0 4-1.7909 4-4V5H8zM4 8c0 1.32848.86419 2.4532 2.06055 2.8477C6.02137 10.5707 6 10.2878 6 10V7H4zm14 2c0 .2878-.0223.5706-.0615.8477C19.1353 10.4535 20 9.32881 20 8V7h-2z';
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

function MiniLeagueVictoryPill({
  league,
  fullWidth,
}: {
  league: GwResults['mlVictoryData'][number];
  /** When set, pill fills its grid cell (see `MiniLeagueVictoryGrid`). */
  fullWidth?: boolean;
}) {
  const id = String(league.id);
  const name = String(league.name ?? 'League');
  const avatarUri = resolveLeagueAvatarUri(league.avatar ?? null) ?? resolveLeagueAvatarUri(getDefaultMlAvatarFilename(id));

  return (
    <View
      style={{
        height: 28,
        width: fullWidth ? '100%' : undefined,
        minWidth: fullWidth ? 0 : 112,
        maxWidth: fullWidth ? undefined : 148,
        alignSelf: fullWidth ? 'stretch' : undefined,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        paddingHorizontal: fullWidth ? 6 : 8,
        marginHorizontal: fullWidth ? 0 : 3,
        marginTop: fullWidth ? 0 : 6,
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

/** Rows of three — matches static `WinnerColumnsScroller` grid so many ML wins stay inside the card. */
function MiniLeagueVictoryGrid({ leagues }: { leagues: GwResults['mlVictoryData'] }) {
  const COLS = 3;
  const GAP = 6;
  const PAD = 18;
  const rows = React.useMemo(() => chunkItems(leagues, COLS), [leagues]);

  return (
    <View style={{ width: '100%', marginTop: 8, paddingHorizontal: PAD }}>
      {rows.map((row, rowIndex) => (
        <View
          key={`ml-win-row-${rowIndex}`}
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-start',
            marginTop: rowIndex === 0 ? 0 : GAP,
          }}
        >
          {Array.from({ length: COLS }, (_, colIndex) => {
            const league = row[colIndex];
            return (
              <View key={`ml-win-${rowIndex}-${colIndex}`} style={{ flex: 1, minWidth: 0, marginLeft: colIndex === 0 ? 0 : GAP }}>
                {league ? <MiniLeagueVictoryPill league={league} fullWidth /> : null}
              </View>
            );
          })}
        </View>
      ))}
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

type ResultsScoreSheetQueryData = { gw: number; results: GwResults; snapshot: HomeSnapshot; liveByFixture: Map<number, LiveScore> };

async function hydrateScoreSheetLiveByFixture(snapshot: HomeSnapshot, gw: number): Promise<Map<number, LiveScore>> {
  const fixtures = snapshot.fixtures;
  const baseRows = snapshot.liveScores;
  let liveByFixture = buildLiveScoreMapForFixtures(fixtures, baseRows);

  const resultByFx = new Map<number, Pick>();
  for (const row of snapshot.gwResults) resultByFx.set(row.fixture_index, row.result);

  const needsSupplement = fixtures.some((fx) => {
    const fi = Number(fx.fixture_index);
    if (!Number.isFinite(fi)) return false;
    if (!resultByFx.has(fi)) return false;
    return !liveScoreHasNumericLine(liveByFixture.get(fi));
  });

  if (!needsSupplement) return liveByFixture;

  const { data, error } = await supabase.from('live_scores').select('*').eq('gw', gw);
  if (error || !data?.length) return liveByFixture;

  const extra: LiveScore[] = [];
  for (const raw of data) {
    const row = hydrateLiveScoreFromDb(raw as Record<string, unknown>);
    if (row) extra.push(row);
  }
  liveByFixture = buildLiveScoreMapForFixtures(fixtures, [...baseRows, ...extra]);
  return liveByFixture;
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
  const winningPick = result ?? null;
  const { home: homeScore, away: awayScore } = scoreStringsForFixtureRow(liveScore, winningPick);
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
    queryFn: async (): Promise<ResultsScoreSheetQueryData | null> => {
      if (eventKey === 'simulator:resultsScoreSheet:example') {
        const p = buildSimulatorResultsScoreSheetPayload();
        const liveByFixture = await hydrateScoreSheetLiveByFixture(p.snapshot, p.gw);
        return { ...p, liveByFixture };
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
      const liveByFixture = await hydrateScoreSheetLiveByFixture(snapshot, gw);
      return { gw, results, snapshot, liveByFixture };
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

  const resultByFixture = new Map<number, Pick>();
  data.snapshot.gwResults.forEach((row) => resultByFixture.set(row.fixture_index, row.result));
  const fixtures = [...data.snapshot.fixtures].sort((a, b) => Number(a.fixture_index) - Number(b.fixture_index));
  const hasUnfinishedFixtures = fixtures.some((fixture) => !resultByFixture.has(Number(fixture.fixture_index)));
  const { liveByFixture } = data;

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
              <MiniLeagueVictoryGrid
                leagues={
                  results.mlVictoryData.length > 0
                    ? results.mlVictoryData
                    : results.mlVictoryNames.map((name, index) => ({ id: `ml-win-${index}`, name, avatar: null }))
                }
              />
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

function parseChampionMiniLeagueEventKey(eventKey?: string | null): { leagueId: string; gw: number } | null {
  if (!eventKey) return null;
  if (eventKey === 'simulator:championMiniLeague') return { leagueId: '__sim__', gw: SEASON_LAST_GW };
  const m = /^championMiniLeague:([^:]+):gw(\d+)$/.exec(eventKey);
  if (!m) return null;
  return { leagueId: m[1], gw: Number(m[2]) };
}

function parseChampionOverallEventKey(eventKey?: string | null): boolean {
  if (!eventKey) return false;
  return eventKey === 'simulator:championOverall' || /^championOverall:gw\d+$/.test(eventKey);
}

function buildSimulatorMiniLeagueChampionPayload(): MiniLeagueChampionSummary {
  return {
    leagueId: '__sim__',
    leagueName: 'Sunday League Legends',
    jointChampions: 1,
    mltPts: 87,
    unicorns: 12,
    ocp: 241,
  };
}

function buildSimulatorOverallChampionPayload(): OverallChampionSummary {
  return { jointChampions: 1, ocp: 412 };
}

/**
 * Broken-glass / foil micro texture — jagged diagonal shards + crossing scratches (no axis-aligned checker blocks).
 */
function ChampionJaggedDiagonalFoilMicro({ tone }: { tone: 'warm' | 'cool' }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '') || 'jd';
  const fills =
      tone === 'cool'
      ? {
          a: 'rgba(248,250,252,0.38)',
          b: 'rgba(226,232,240,0.22)',
          c: 'rgba(186,230,253,0.15)',
          edge: 'rgba(255,255,255,0.09)',
          scratch: 'rgba(224,231,255,0.22)',
        }
      : {
          a: 'rgba(255,255,255,0.42)',
          b: 'rgba(254,243,199,0.26)',
          c: 'rgba(255,251,235,0.2)',
          edge: 'rgba(255,255,255,0.11)',
          scratch: 'rgba(255,255,255,0.28)',
        };
  const baseOpacity = tone === 'cool' ? 0.13 : 0.17;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: baseOpacity }]}>
      <Svg width="100%" height="100%" viewBox="0 0 120 120" preserveAspectRatio="none">
        <Defs>
          <Pattern id={`${id}-m`} patternUnits="userSpaceOnUse" width={56} height={56}>
            <Path
              d="M0 56 L0 29 L6.5 19 L17 27 L28 15 L40 24 L52 11 L56 8 L56 56 L41 49 L28 56 L14 47 L4 52 Z"
              fill={fills.a}
              stroke={fills.edge}
              strokeWidth={0.45}
            />
            <Path
              d="M56 0 L56 27 L49.5 37 L39 29 L27 41 L16 32 L4 45 L0 38 L0 6 L11 0 L26 9 L39 0 L52 6 Z"
              fill={fills.b}
              stroke={fills.edge}
              strokeWidth={0.45}
            />
            <Path d="M0 0 L24 0 L12 14 L0 8 Z" fill={fills.c} stroke={fills.edge} strokeWidth={0.25} />
            <Path d="M56 56 L32 56 L44 42 L56 48 Z" fill={fills.c} stroke={fills.edge} strokeWidth={0.25} />
            <Path d="M0 40 L22 56 L8 56 Z" fill={fills.c} opacity={0.75} />
            <Path d="M56 16 L34 0 L48 0 Z" fill={fills.c} opacity={0.75} />
            <Path d="M4 0 L56 48" stroke={fills.scratch} strokeWidth={0.35} opacity={0.55} />
            <Path d="M0 52 L48 4" stroke={fills.scratch} strokeWidth={0.28} opacity={0.45} />
          </Pattern>
          <Pattern
            id={`${id}-x`}
            patternUnits="userSpaceOnUse"
            width={56}
            height={56}
            patternTransform="rotate(38 28 28)"
          >
            <Path d="M-8 28 L64 28" stroke={fills.edge} strokeWidth={0.22} opacity={0.65} />
            <Path d="M14 -8 L14 64" stroke={fills.scratch} strokeWidth={0.18} opacity={0.4} />
            <Path d="M0 0 L56 56" stroke={fills.scratch} strokeWidth={0.15} opacity={0.35} />
          </Pattern>
        </Defs>
        <Rect width={120} height={120} fill={`url(#${id}-m)`} />
        <Rect width={120} height={120} fill={`url(#${id}-x)`} opacity={tone === 'cool' ? 0.52 : 0.85} />
      </Svg>
    </View>
  );
}

/** Wide holo sweep — cyan / magenta / violet / silver (overall champion, distinct from gold ML card). */
function OverallSilverHoloRainbowSweep({ animated }: { animated: boolean }) {
  const x = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 1,
          duration: 3800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(x, {
          toValue: 0,
          duration: 3800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      x.stopAnimation();
    };
  }, [animated, x]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-200, 200] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -36,
        bottom: -36,
        left: '-42%',
        width: '185%',
        opacity: 0.46,
        transform: [{ translateX }, { rotate: '19deg' }],
      }}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,255,0)',
          'rgba(34,211,238,0.26)',
          'rgba(167,139,250,0.24)',
          'rgba(241,245,249,0.4)',
          'rgba(148,163,184,0.22)',
          'rgba(125,211,252,0.26)',
          'rgba(226,232,240,0.22)',
          'rgba(255,255,255,0)',
        ]}
        locations={[0, 0.1, 0.26, 0.42, 0.55, 0.72, 0.88, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

/** Second sweep axis for depth — pearlescent vertical drift. */
function OverallSilverHoloCounterSweep({ animated }: { animated: boolean }) {
  const y = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      y.stopAnimation();
    };
  }, [animated, y]);
  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [-140, 140] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: '-30%',
        bottom: '-30%',
        left: 0,
        right: 0,
        opacity: 0.3,
        transform: [{ translateY }, { rotate: '-13deg' }],
      }}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,255,0)',
          'rgba(196,181,253,0.26)',
          'rgba(241,245,249,0.38)',
          'rgba(148,163,184,0.2)',
          'rgba(226,232,240,0.28)',
          'rgba(255,255,255,0)',
        ]}
        locations={[0, 0.22, 0.45, 0.58, 0.78, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

type CoolShardTri = { key: string; points: string; fill: string };

/** Card-wide silver foil (overall champion bg) — kept softer than trophy interior. */
const COOL_HOLO_SHARD_PALETTE = [
  'rgba(224,231,255,0.3)',
  'rgba(165,243,252,0.26)',
  'rgba(233,213,255,0.24)',
  'rgba(241,245,249,0.34)',
  'rgba(186,230,253,0.22)',
  'rgba(196,181,253,0.2)',
  'rgba(207,250,254,0.2)',
  'rgba(248,250,252,0.3)',
  'rgba(125,211,252,0.22)',
];

/** Silver/chrome prism shards inside trophy — softer alpha so watermark blends into bg. */
const COOL_HOLO_SHARD_PALETTE_INTERIOR = [
  'rgba(241,245,249,0.38)',
  'rgba(226,232,240,0.36)',
  'rgba(203,213,225,0.34)',
  'rgba(248,250,252,0.42)',
  'rgba(148,163,184,0.28)',
  'rgba(203,213,225,0.32)',
  'rgba(226,232,240,0.38)',
  'rgba(186,230,253,0.26)',
  'rgba(215,226,239,0.34)',
];

/** Card-wide warm gold prism foil — mirrors overall silver mesh palette roles. */
const WARM_GOLD_HOLO_SHARD_PALETTE = [
  'rgba(254,243,199,0.34)',
  'rgba(251,191,36,0.32)',
  'rgba(245,158,11,0.28)',
  'rgba(253,224,71,0.3)',
  'rgba(255,251,235,0.36)',
  'rgba(234,179,8,0.26)',
  'rgba(252,211,77,0.28)',
  'rgba(254,215,170,0.26)',
  'rgba(250,204,21,0.3)',
];

/** Gold foil shards inside mini-league trophy watermark. */
const WARM_GOLD_HOLO_SHARD_PALETTE_INTERIOR = [
  'rgba(255,251,235,0.42)',
  'rgba(254,243,199,0.4)',
  'rgba(251,191,36,0.38)',
  'rgba(245,158,11,0.34)',
  'rgba(253,224,71,0.36)',
  'rgba(234,179,8,0.32)',
  'rgba(252,211,77,0.34)',
  'rgba(254,215,170,0.3)',
  'rgba(250,204,21,0.36)',
];

const AnimatedSvgG = Animated.createAnimatedComponent(G);
/** Animated `G` loses usable merged props in RN typings — cast for holo sweep transforms. */
const AnimatedTrophyHoloG = AnimatedSvgG as unknown as React.ComponentType<{
  children?: React.ReactNode;
  style?: object;
}>;

function buildCoolTriangularShardMesh(
  keyPrefix: string,
  viewW: number,
  viewH: number,
  cols: number,
  rows: number,
  palette: readonly string[] = COOL_HOLO_SHARD_PALETTE
): CoolShardTri[] {
  const cw = viewW / cols;
  const rh = viewH / rows;
  const out: CoolShardTri[] = [];
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw;
      const y = r * rh;
      const idx = r * cols + c;
      const fill = palette[idx % palette.length];
      if ((r + c) % 2 === 0) {
        out.push({
          key: `${keyPrefix}-t${k++}`,
          points: `${x},${y} ${x + cw},${y} ${x},${y + rh}`,
          fill,
        });
        out.push({
          key: `${keyPrefix}-t${k++}`,
          points: `${x + cw},${y} ${x + cw},${y + rh} ${x},${y + rh}`,
          fill,
        });
      } else {
        out.push({
          key: `${keyPrefix}-t${k++}`,
          points: `${x},${y} ${x + cw},${y} ${x + cw},${y + rh}`,
          fill,
        });
        out.push({
          key: `${keyPrefix}-t${k++}`,
          points: `${x},${y} ${x + cw},${y + rh} ${x},${y + rh}`,
          fill,
        });
      }
    }
  }
  return out;
}

/** Shard mesh tuned for cool chrome / prism foil (overall only). */
function OverallSilverTriangularShardFoil() {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '') || 'ovsil';
  const shards = React.useMemo(() => buildCoolTriangularShardMesh(uid, 100, 100, 10, 12), [uid]);

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          opacity: 0.46,
          transform: [{ skewX: '-5deg' }],
        },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {shards.map((s) => (
          <Polygon key={s.key} points={s.points} fill={s.fill} stroke="rgba(255,255,255,0.1)" strokeWidth={0.22} />
        ))}
      </Svg>
    </View>
  );
}

function OverallSilverBaseGradients() {
  return (
    <>
      <LinearGradient
        colors={['#1e293b', '#334155', '#3d5166', '#64748b', '#cbd5e1', '#e8eef4']}
        start={{ x: 0.15, y: 1 }}
        end={{ x: 0.92, y: 0.08 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <LinearGradient
        colors={['rgba(30,41,59,0.28)', 'rgba(255,255,255,0)', 'rgba(241,245,249,0.42)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
    </>
  );
}

function MiniLeagueGoldBaseGradients() {
  return (
    <>
      <LinearGradient
        colors={['#422006', '#713f12', '#a16207', '#ca8a04', '#eab308', '#fef9c3']}
        start={{ x: 0.15, y: 1 }}
        end={{ x: 0.92, y: 0.08 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <LinearGradient
        colors={['rgba(69,26,3,0.38)', 'rgba(255,255,255,0)', 'rgba(254,243,199,0.42)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
    </>
  );
}

/** Shard mesh for mini-league gold holo — parallel to `OverallSilverTriangularShardFoil`. */
function MiniLeagueGoldTriangularShardFoil() {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '') || 'mlg';
  const shards = React.useMemo(
    () => buildCoolTriangularShardMesh(uid, 100, 100, 10, 12, WARM_GOLD_HOLO_SHARD_PALETTE),
    [uid]
  );

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          opacity: 0.46,
          transform: [{ skewX: '-5deg' }],
        },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {shards.map((s) => (
          <Polygon key={s.key} points={s.points} fill={s.fill} stroke="rgba(255,251,235,0.12)" strokeWidth={0.22} />
        ))}
      </Svg>
    </View>
  );
}

/** Horizontal warm gold / amber holo sweep — mirrors `OverallSilverHoloRainbowSweep`. */
function MiniLeagueGoldHoloRainbowSweep({ animated }: { animated: boolean }) {
  const x = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 1,
          duration: 3800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(x, {
          toValue: 0,
          duration: 3800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      x.stopAnimation();
    };
  }, [animated, x]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-200, 200] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -36,
        bottom: -36,
        left: '-42%',
        width: '185%',
        opacity: 0.44,
        transform: [{ translateX }, { rotate: '19deg' }],
      }}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,255,0)',
          'rgba(251,191,36,0.34)',
          'rgba(254,215,170,0.28)',
          'rgba(253,224,71,0.4)',
          'rgba(245,158,11,0.26)',
          'rgba(254,243,199,0.36)',
          'rgba(234,179,8,0.24)',
          'rgba(255,255,255,0)',
        ]}
        locations={[0, 0.1, 0.26, 0.42, 0.55, 0.72, 0.88, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

/** Vertical pearlescent drift — mirrors `OverallSilverHoloCounterSweep`. */
function MiniLeagueGoldHoloCounterSweep({ animated }: { animated: boolean }) {
  const y = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      y.stopAnimation();
    };
  }, [animated, y]);
  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [-140, 140] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: '-30%',
        bottom: '-30%',
        left: 0,
        right: 0,
        opacity: 0.32,
        transform: [{ translateY }, { rotate: '-13deg' }],
      }}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,255,0)',
          'rgba(251,146,60,0.28)',
          'rgba(254,243,199,0.38)',
          'rgba(217,119,6,0.22)',
          'rgba(253,224,71,0.3)',
          'rgba(255,255,255,0)',
        ]}
        locations={[0, 0.22, 0.45, 0.58, 0.78, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

/** Amber → gold foil + dual holo sweeps; structure matches `ChampionOverallSilverHoloBackground`. */
function ChampionMiniLeagueGoldHoloBackground({ animated = true }: { animated?: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 28, overflow: 'hidden' }}>
      <MiniLeagueGoldBaseGradients />
      {animated ? (
        <>
          <ChampionJaggedDiagonalFoilMicro tone="warm" />
          <MiniLeagueGoldTriangularShardFoil />
          <MiniLeagueGoldHoloCounterSweep animated />
          <MiniLeagueGoldHoloRainbowSweep animated />
          <WinnerShimmer durationMs={1100} delayMs={0} opacity={0.56} tint="gold" skipFirstDelay />
          <WinnerShimmer durationMs={1600} delayMs={140} opacity={0.4} tint="gold" />
          <WinnerShimmer durationMs={2100} delayMs={280} opacity={0.32} tint="white" />
        </>
      ) : null}
    </View>
  );
}

/** Slate → chrome → silver highlight; triangular foil + dual holo sweeps (trophy interior uses separate masked fill in body). */
function ChampionOverallSilverHoloBackground({ animated = true }: { animated?: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 28, overflow: 'hidden' }}>
      <OverallSilverBaseGradients />
      {animated ? (
        <>
          <ChampionJaggedDiagonalFoilMicro tone="cool" />
          <OverallSilverTriangularShardFoil />
          <OverallSilverHoloCounterSweep animated />
          <OverallSilverHoloRainbowSweep animated />
          <WinnerShimmer durationMs={1100} delayMs={0} opacity={0.56} tint="silver" skipFirstDelay />
          <WinnerShimmer durationMs={1600} delayMs={140} opacity={0.4} tint="silver" />
          <WinnerShimmer durationMs={2100} delayMs={280} opacity={0.32} tint="white" />
        </>
      ) : null}
    </View>
  );
}

/** Triangular prism mesh + animated silver/chrome sweeps, clipped to trophy. */
function ChampionOverallTrophyWatermark() {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '') || 'ovTr';
  const maskId = `${uid}m`;
  const gidRb = `${uid}hol_rb`;
  const gidPr = `${uid}hol_pr`;
  const gidRad = `${uid}hol_rad`;
  const sz = TROPHY_WATERMARK_SIZE;
  const half = sz / 2;
  const shards = React.useMemo(
    () => buildCoolTriangularShardMesh(`${uid}tw`, 512, 512, 14, 17, COOL_HOLO_SHARD_PALETTE_INTERIOR),
    [uid]
  );
  const shardStroke = 0.22 * (512 / 100);

  const sweepX = React.useRef(new Animated.Value(0)).current;
  const sweepY = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const lx = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepX, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(sweepX, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    const ly = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepY, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(sweepY, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );
    lx.start();
    ly.start();
    return () => {
      lx.stop();
      ly.stop();
      sweepX.stopAnimation();
      sweepY.stopAnimation();
    };
  }, [sweepX, sweepY]);

  const tx = sweepX.interpolate({ inputRange: [0, 1], outputRange: [-150, 150] });
  const ty = sweepY.interpolate({ inputRange: [0, 1], outputRange: [-110, 110] });

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: sz,
        height: sz,
        marginLeft: -half,
        marginTop: -half + TROPHY_VERTICAL_ALIGN_OFFSET,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={sz} height={sz} viewBox="0 0 512 512" opacity={0.68}>
        <Defs>
          <Mask id={maskId}>
            <Rect width="512" height="512" fill="#000" />
            <Path d={IONICON_TROPHY_PATH} fill="#fff" />
          </Mask>
          <SvgLinearGradient id={gidRb} x1="0" y1="0.5" x2="1" y2="0.5">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="0.12" stopColor="#cbd5e1" stopOpacity={0.38} />
            <Stop offset="0.28" stopColor="#f8fafc" stopOpacity={0.48} />
            <Stop offset="0.42" stopColor="#94a3b8" stopOpacity={0.34} />
            <Stop offset="0.55" stopColor="#e2e8f0" stopOpacity={0.45} />
            <Stop offset="0.68" stopColor="#64748b" stopOpacity={0.28} />
            <Stop offset="0.82" stopColor="#bae6fd" stopOpacity={0.24} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </SvgLinearGradient>
          <SvgLinearGradient id={gidPr} x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="0.24" stopColor="#e2e8f0" stopOpacity={0.42} />
            <Stop offset="0.46" stopColor="#f1f5f9" stopOpacity={0.46} />
            <Stop offset="0.58" stopColor="#94a3b8" stopOpacity={0.32} />
            <Stop offset="0.76" stopColor="#cbd5e1" stopOpacity={0.38} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </SvgLinearGradient>
          <RadialGradient id={gidRad} cx="40%" cy="34%" rx="72%" ry="78%" fy="30%">
            <Stop offset="0" stopColor="#f8fafc" stopOpacity={0.38} />
            <Stop offset="0.32" stopColor="#cbd5e1" stopOpacity={0.28} />
            <Stop offset="0.58" stopColor="#94a3b8" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#f1f5f9" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <G mask={`url(#${maskId})`}>
          <Rect x="0" y="0" width="512" height="512" fill="rgba(248,250,252,0.14)" />
          <Rect x="0" y="0" width="512" height="512" fill={`url(#${gidRad})`} opacity={0.55} />
          <G opacity={0.72} transform="translate(256 255) skewX(-5) translate(-256 -255)">
            {shards.map((s) => (
              <Polygon
                key={s.key}
                points={s.points}
                fill={s.fill}
                stroke="rgba(248,250,252,0.22)"
                strokeWidth={shardStroke}
              />
            ))}
          </G>
          <AnimatedTrophyHoloG style={{ opacity: 0.48, transform: [{ translateX: tx }, { rotate: '19deg' }] }}>
            <Rect x="-300" y="-120" width="1150" height="780" fill={`url(#${gidRb})`} />
          </AnimatedTrophyHoloG>
          <AnimatedTrophyHoloG style={{ opacity: 0.38, transform: [{ translateY: ty }, { rotate: '-13deg' }] }}>
            <Rect x="-160" y="-320" width="960" height="1180" fill={`url(#${gidPr})`} />
          </AnimatedTrophyHoloG>
        </G>
      </Svg>
    </View>
  );
}

/** Heroicons cup silhouette + warm gold holo — paired with `ChampionMiniLeagueGoldHoloBackground`. */
function ChampionMiniLeagueTrophyWatermark() {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '') || 'mlTr';
  const maskId = `${uid}m`;
  const gidRb = `${uid}hol_rb`;
  const gidPr = `${uid}hol_pr`;
  const gidRad = `${uid}hol_rad`;
  const sz = MINI_LEAGUE_TROPHY_WATERMARK_SIZE;
  const half = sz / 2;
  const shards = React.useMemo(
    () => buildCoolTriangularShardMesh(`${uid}tw`, 512, 512, 14, 17, WARM_GOLD_HOLO_SHARD_PALETTE_INTERIOR),
    [uid]
  );
  const shardStroke = 0.22 * (512 / 100);

  const sweepX = React.useRef(new Animated.Value(0)).current;
  const sweepY = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const lx = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepX, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(sweepX, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    const ly = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepY, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(sweepY, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );
    lx.start();
    ly.start();
    return () => {
      lx.stop();
      ly.stop();
      sweepX.stopAnimation();
      sweepY.stopAnimation();
    };
  }, [sweepX, sweepY]);

  const tx = sweepX.interpolate({ inputRange: [0, 1], outputRange: [-150, 150] });
  const ty = sweepY.interpolate({ inputRange: [0, 1], outputRange: [-110, 110] });

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: sz,
        height: sz,
        marginLeft: -half,
        marginTop: -half + TROPHY_VERTICAL_ALIGN_OFFSET,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={sz} height={sz} viewBox="0 0 512 512" opacity={0.66}>
        <Defs>
          <Mask id={maskId}>
            <Rect width="512" height="512" fill="#000" />
            <G transform="translate(256 266) scale(14.25) translate(-12 -12)">
              <Path d={MINI_LEAGUE_HERO_TROPHY_PATH} fill="#fff" />
            </G>
          </Mask>
          <SvgLinearGradient id={gidRb} x1="0" y1="0.5" x2="1" y2="0.5">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="0.12" stopColor="#fcd34d" stopOpacity={0.42} />
            <Stop offset="0.28" stopColor="#fef3c7" stopOpacity={0.5} />
            <Stop offset="0.42" stopColor="#d97706" stopOpacity={0.36} />
            <Stop offset="0.55" stopColor="#fde68a" stopOpacity={0.44} />
            <Stop offset="0.68" stopColor="#b45309" stopOpacity={0.28} />
            <Stop offset="0.82" stopColor="#fbbf24" stopOpacity={0.34} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </SvgLinearGradient>
          <SvgLinearGradient id={gidPr} x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="0.24" stopColor="#fde68a" stopOpacity={0.44} />
            <Stop offset="0.46" stopColor="#fef9c3" stopOpacity={0.46} />
            <Stop offset="0.58" stopColor="#d97706" stopOpacity={0.34} />
            <Stop offset="0.76" stopColor="#fcd34d" stopOpacity={0.4} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </SvgLinearGradient>
          <RadialGradient id={gidRad} cx="40%" cy="34%" rx="72%" ry="78%" fy="30%">
            <Stop offset="0" stopColor="#fffbeb" stopOpacity={0.4} />
            <Stop offset="0.32" stopColor="#fcd34d" stopOpacity={0.3} />
            <Stop offset="0.58" stopColor="#ca8a04" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#fef3c7" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <G mask={`url(#${maskId})`}>
          <Rect x="0" y="0" width="512" height="512" fill="rgba(255,251,235,0.15)" />
          <Rect x="0" y="0" width="512" height="512" fill={`url(#${gidRad})`} opacity={0.55} />
          <G opacity={0.72} transform="translate(256 255) skewX(-5) translate(-256 -255)">
            {shards.map((s) => (
              <Polygon
                key={s.key}
                points={s.points}
                fill={s.fill}
                stroke="rgba(255,251,235,0.24)"
                strokeWidth={shardStroke}
              />
            ))}
          </G>
          <AnimatedTrophyHoloG style={{ opacity: 0.48, transform: [{ translateX: tx }, { rotate: '19deg' }] }}>
            <Rect x="-300" y="-120" width="1150" height="780" fill={`url(#${gidRb})`} />
          </AnimatedTrophyHoloG>
          <AnimatedTrophyHoloG style={{ opacity: 0.38, transform: [{ translateY: ty }, { rotate: '-13deg' }] }}>
            <Rect x="-160" y="-320" width="960" height="1180" fill={`url(#${gidPr})`} />
          </AnimatedTrophyHoloG>
        </G>
      </Svg>
    </View>
  );
}

function ChampionMiniLeagueCardBody({ eventKey }: { eventKey?: string }) {
  const { data: authUser } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },
    staleTime: 60_000,
  });
  const userId = authUser?.id ? String(authUser.id) : null;

  const { data: homeSnap } = useQuery<HomeSnapshot>({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
    staleTime: 60_000,
  });

  const parsed = parseChampionMiniLeagueEventKey(eventKey);

  const { data, isLoading } = useQuery({
    queryKey: ['popup-card', 'championMiniLeague', eventKey ?? 'none', userId ?? 'anon', homeSnap?.currentGw ?? null],
    enabled: !!userId && !!parsed,
    staleTime: 60_000,
    queryFn: async (): Promise<MiniLeagueChampionSummary | null> => {
      if (!parsed || !userId) return null;
      if (parsed.leagueId === '__sim__') return buildSimulatorMiniLeagueChampionPayload();
      const resolverGw =
        typeof homeSnap?.currentGw === 'number' && Number.isFinite(homeSnap.currentGw)
          ? Math.max(homeSnap.currentGw, SEASON_LAST_GW)
          : SEASON_LAST_GW;
      return fetchMiniLeagueChampionSummaryForUserAndLeague({
        userId,
        leagueId: parsed.leagueId,
        currentGwMeta: resolverGw,
        latestGw: parsed.gw,
      });
    },
  });

  const { data: profileSummary } = useQuery<ProfileSummary>({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });

  if (isLoading || !parsed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
        <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 18, lineHeight: 22 }}>
          Loading…
        </TotlText>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
        <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 18, lineHeight: 22 }}>
          Champion
        </TotlText>
      </View>
    );
  }

  const joint = data.jointChampions > 1;

  return (
    <View style={{ flex: 1, width: '100%' }}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}>
        <ChampionMiniLeagueTrophyWatermark />
      </View>
      <View
        style={{
          flex: 1,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 4,
          paddingBottom: 4,
          zIndex: 1,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 22, width: '100%' }}>
          <PersonalWinnerHeader
            profile={profileSummary}
            data={{
              gw: SEASON_LAST_GW,
              victoryType: 'monthly',
              label: `GW${SEASON_LAST_GW} • Mini league`,
              points: data.mltPts,
              winnerCount: data.jointChampions,
              joint,
            }}
          />
          <TotlText
            style={{
              color: '#FFFBEB',
              fontFamily: 'Gramatika-Bold',
              fontWeight: '900',
              fontSize: 17,
              letterSpacing: 1.4,
              lineHeight: 22,
              textAlign: 'center',
              marginTop: 6,
            }}
          >
            2025/26
          </TotlText>
          <TotlText
            style={{
              color: '#FFFFFF',
              fontFamily: 'Gramatika-Bold',
              fontWeight: '900',
              fontSize: 26,
              letterSpacing: 2.4,
              lineHeight: 30,
              textAlign: 'center',
              marginTop: 6,
              paddingHorizontal: 6,
            }}
          >
            {joint ? 'MINI LEAGUE CHAMPIONS' : 'MINI LEAGUE CHAMPION'}
          </TotlText>
        </View>

        <View style={{ width: '100%', alignItems: 'center', paddingHorizontal: 16, gap: 8 }}>
          <TotlText
            style={{
              color: 'rgba(255,255,255,0.92)',
              fontWeight: '800',
              fontSize: 14,
              lineHeight: 20,
              textAlign: 'center',
            }}
          >
            {joint ? 'Joint first place in' : 'First place in'}
          </TotlText>
          <TotlText
            style={{
              color: '#FFFFFF',
              fontFamily: 'Gramatika-Bold',
              fontWeight: '900',
              fontSize: 14,
              lineHeight: 20,
              textAlign: 'center',
              textTransform: 'uppercase',
              paddingHorizontal: 8,
            }}
          >
            {data.leagueName}
          </TotlText>
          <TotlText
            style={{
              color: 'rgba(255,255,255,0.92)',
              fontWeight: '800',
              fontSize: 14,
              lineHeight: 20,
              textAlign: 'center',
            }}
          >
            {joint
              ? `${data.jointChampions} of you tied at the top on mini-league table points — football heritage among friends.`
              : `${data.mltPts} table pts, ${data.unicorns} unicorns, ${data.ocp} OCP — elite among friends this season.`}
          </TotlText>
        </View>
      </View>
    </View>
  );
}

function ChampionOverallCardBody({ eventKey }: { eventKey?: string }) {
  const { data: authUser } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },
    staleTime: 60_000,
  });
  const userId = authUser?.id ? String(authUser.id) : null;
  const looksValid = parseChampionOverallEventKey(eventKey);

  const { data, isLoading } = useQuery({
    queryKey: ['popup-card', 'championOverall', eventKey ?? 'none', userId ?? 'anon'],
    enabled: !!userId && looksValid,
    staleTime: 60_000,
    queryFn: async (): Promise<OverallChampionSummary | null> => {
      if (!userId) return null;
      if (eventKey === 'simulator:championOverall') return buildSimulatorOverallChampionPayload();
      return fetchOverallChampionSummaryForUser(userId);
    },
  });

  const { data: profileSummary } = useQuery<ProfileSummary>({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });

  if (isLoading || !looksValid) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
        <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 18, lineHeight: 22 }}>
          Loading…
        </TotlText>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
        <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Bold', textAlign: 'center', fontWeight: '900', fontSize: 18, lineHeight: 22 }}>
          Champion
        </TotlText>
      </View>
    );
  }

  const joint = data.jointChampions > 1;

  return (
    <View style={{ flex: 1, width: '100%' }}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}>
        <ChampionOverallTrophyWatermark />
      </View>
      <View
        style={{
          flex: 1,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 4,
          paddingBottom: 4,
          zIndex: 1,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 22, width: '100%' }}>
          <PersonalWinnerHeader
            profile={profileSummary}
            data={{
              gw: SEASON_LAST_GW,
              victoryType: 'monthly',
              label: 'Overall table',
              points: data.ocp,
              winnerCount: data.jointChampions,
              joint,
            }}
          />
          <TotlText
            style={{
              color: '#F1F5F9',
              fontFamily: 'Gramatika-Bold',
              fontWeight: '900',
              fontSize: 17,
              letterSpacing: 1.4,
              lineHeight: 22,
              textAlign: 'center',
              marginTop: 6,
            }}
          >
            2025/26
          </TotlText>
          <TotlText
            style={{
              color: '#FFFFFF',
              fontFamily: 'Gramatika-Bold',
              fontWeight: '900',
              fontSize: 26,
              letterSpacing: 2.4,
              lineHeight: 30,
              textAlign: 'center',
              marginTop: 6,
              paddingHorizontal: 6,
            }}
          >
            {joint ? 'OVERALL CHAMPIONS' : 'OVERALL CHAMPION'}
          </TotlText>
        </View>

        <View style={{ width: '100%', alignItems: 'center', paddingHorizontal: 16 }}>
          <TotlText
            style={{
              color: 'rgba(255,255,255,0.92)',
              fontWeight: '800',
              fontSize: 14,
              lineHeight: 20,
              textAlign: 'center',
            }}
          >
            {joint
              ? `The best predictors in TOTL this season — ${data.jointChampions} of you tied on overall OCP. Football heritage secured.`
              : 'The best predictor in TOTL this season. Football heritage secured.'}
          </TotlText>
        </View>
      </View>
    </View>
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
  const showChampionWinner = kind === 'championMiniLeague' || kind === 'championOverall';
  const showResultsFrame = false;
  const showNewGameweekFrame = kind === 'newGameweek';
  const showDoPredictionsCard = kind === 'doPredictions';
  const showInsetFrame = showWinnersFrame || showPersonalWinnerFrame || showResultsFrame || showChampionWinner;
  const showEmeraldCard = kind === 'newGameweek';
  const runDecorativeAnimations = isTopCard && !isShareAsset;
  const personalWinnerVariant = showPersonalWinnerFrame ? parsePersonalWinnerTypeFromEventKey(eventKey) : 'gameweek';
  const lightCloseButton = showEmeraldCard || showPersonalWinnerFrame || showChampionWinner;
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
      {showChampionWinner ? (
        kind === 'championOverall' ? (
          <ChampionOverallSilverHoloBackground animated={runDecorativeAnimations} />
        ) : (
          <ChampionMiniLeagueGoldHoloBackground animated={runDecorativeAnimations} />
        )
      ) : null}
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
            backgroundColor: lightCloseButton ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.05)',
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Ionicons name="close" size={20} color={lightCloseButton ? '#FFFFFF' : '#0F172A'} />
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
        ) : kind === 'championMiniLeague' ? (
          <ChampionMiniLeagueCardBody eventKey={eventKey} />
        ) : kind === 'championOverall' ? (
          <ChampionOverallCardBody eventKey={eventKey} />
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

  return content;
}
