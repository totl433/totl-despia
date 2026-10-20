import React from 'react';
import { ActivityIndicator, Alert, Animated, AppState, Easing, FlatList, Image, Pressable, RefreshControl, StyleSheet, TextInput, useWindowDimensions, View, type StyleProp, type TextStyle } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Reanimated, {
  cancelAnimation,
  Easing as ReEasing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { Fixture, LiveScore, Pick } from '@totl/domain';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';
import { TEAM_BADGES } from '../lib/teamBadges';

import AppTopHeader from '../components/AppTopHeader';
import HeaderLiveScore from '../components/HeaderLiveScore';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useLiveScores } from '../hooks/useLiveScores';
import { env } from '../env';
import { useGameCentrePosts } from '../hooks/useGameCentrePosts';
import { useGameCentreReactions } from '../hooks/useGameCentreReactions';
import { postCardComment, useCardCommentCounts } from '../hooks/useCardComments';
import EmojiPicker from 'rn-emoji-keyboard';
import { useLeagueChatReactions, type ReactionSummary } from '../hooks/useLeagueChatReactions';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import {
  applySingleCardReaction,
  MATCH_CENTER_CARD_REACTS,
  useMatchCenterCardReactions,
} from '../hooks/useMatchCenterCardReactions';
import usePopupCards from '../hooks/usePopupCards';
import { useConfetti } from '../lib/confetti';
import { formatLocalTimeHHmm } from '../lib/dateTime';
import { formToDotColors, normalizeTeamForms, ordinalLabel } from '../lib/homeFixtureUi';
import { fetchTeamPositionsWithFallback, normalizeTeamPositions } from '../lib/teamPositions';
import { gameweekPin, getGameweekStateFromSnapshot, type GameweekPin } from '../lib/gameweekState';
import GameCentrePinnedCard from '../components/gameCentre/GameCentrePinnedCard';
import GameweekAdvanceTransition from '../components/transitions/GameweekAdvanceTransition';
import { useGameweekAdvanceTransition } from '../hooks/useGameweekAdvanceTransition';
import { pinDismissKey, pinDismissible, type PinnedCardAction } from '../features/gameCentre/cards';
import {
  buildHeaderExpandedStats,
  buildHeaderScoreSummary,
  buildHeaderTickerEvent,
  formatHeaderScoreLabel,
} from '../lib/headerLiveScore';
import EmojiGlyph, { hasEmojiBitmap } from '../features/matchCenter/EmojiGlyph';
import { gameCentreCardHeader, gameCentreCardType, gameCentreReactionChips } from '../features/gameCentre/cards';
import GameCentreCard, {
  GameCentreAuthorHeader,
  GameCentreCardHeader,
  GameCentreReactionBar,
  GameCentreReplyInput,
} from '../components/gameCentre/GameCentreCard';
import { GameCentreMenuButton, useGameCentreMenu } from '../components/gameCentre/GameCentreDrawer';
import { getDefaultMlAvatarFilename, resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import { getMonthForGw, SEASON_2026_27_LABEL, type LeaderboardSeasonKey } from '../lib/leaderboardMonths';
import { LEGACY_PILE_TABLES, SEASON_PILE_TABLES } from '../lib/leagueSeasonPile';
import { fetchAllSupabaseRows } from '../lib/profileStreakRows';
import { useViewerSeason } from '../lib/useViewerSeason';
import { VOLLEY_USER_ID } from '../lib/volley';
import {
  alignChatSortAtMs,
  buildMatchFeed,
  buildRoundUp,
  chatMessageItem,
  firstKickoffMs,
  fixtureEngagementId,
  fixtureIndexOfCard,
  fixtureSides,
  lastKickoffMs,
  matchCenterClosesAtMs,
  matchCenterReactionCardId,
  rankChangeItem,
  rankOf,
  sampleFeed,
  type FeedItem,
  type FeedMatch,
  type FeedXiPlayer,
  type LeaguePickSnap,
  type LeagueStandingLine,
  type LeagueTableSnap,
  type OverallReplay,
} from '../features/matchCenter/feed';

type Mode = 'live' | 'sample' | 'play';

/** Match Center data cadence — Realtime for scores/chat; BFF polls stay sparse. */
const MC_TABLE_MS = 60_000;
const MC_LIVE_BOARD_MS = 60_000;
const MC_CHAT_POLL_MS = 60_000; // backup; INSERT Realtime invalidates sooner
const MC_TICKER_MS = 60_000;
const MC_HEAVY_STALE_MS = 5 * 60_000;

function Crest({ code, size }: { code: string; size: number }) {
  const badge = TEAM_BADGES[code];
  if (!badge) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <TotlText style={{ fontWeight: '800', fontSize: 12 }}>{code || '—'}</TotlText>
      </View>
    );
  }
  return <Image source={badge} style={{ width: size, height: size }} resizeMode="contain" />;
}

function pickOutcome(home: number | null, away: number | null): Pick | null {
  if (home === null || away === null) return null;
  if (home > away) return 'H';
  if (away > home) return 'A';
  return 'D';
}

function FormDots({ form }: { form: string | null }) {
  const colors = formToDotColors(form);
  return (
    <View style={{ width: 56, height: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {colors.map((color, index) => (
        <View key={`${color}-${index}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      ))}
    </View>
  );
}

function LineupTop({ item }: { item: FeedItem }) {
  const t = useTokens();
  const top = item.lineupTop;
  const match = item.match;
  if (!top || !match) return null;
  const side = (code: string, name: string, form: string | null, rank: number | null) => (
    <View style={{ width: '37%', alignItems: 'center' }}>
      <Crest code={code} size={54} />
      <TotlText numberOfLines={1} style={{ marginTop: 8, width: '100%', fontSize: 15, lineHeight: 18, fontWeight: '600', textAlign: 'center', color: t.color.text }}>
        {name}
      </TotlText>
      <View style={{ marginTop: 10 }}>
        <FormDots form={form} />
      </View>
      <TotlText style={{ marginTop: 8, fontSize: 13, lineHeight: 16, fontWeight: '600', color: t.color.text }}>{ordinalLabel(rank)}</TotlText>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
      {side(match.homeCode, top.homeName, top.homeForm, top.homeRank)}
      <View style={{ width: '26%', alignItems: 'center', paddingTop: 10 }}>
        <TotlText style={{ fontSize: 30, lineHeight: 34, fontWeight: '600', letterSpacing: 0.4, color: t.color.text }}>{top.kickoffLabel}</TotlText>
      </View>
      {side(match.awayCode, top.awayName, top.awayForm, top.awayRank)}
    </View>
  );
}

function LineupBoard({ item }: { item: FeedItem }) {
  const t = useTokens();
  const xi = item.xi;
  if (!xi) return null;
  const column = (code: string, name: string, formation: string | null, players: FeedXiPlayer[]) => (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, minHeight: 22 }}>
        {code ? <Crest code={code} size={22} /> : null}
        <TotlText numberOfLines={1} style={{ flex: 1, marginLeft: code ? 6 : 0, fontSize: 14, lineHeight: 18, fontWeight: '700', color: t.color.text }}>
          {name}
        </TotlText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 18 }}>
        <View style={{ width: 22 }} />
        <TotlText style={{ flex: 1, marginLeft: 8, fontSize: 12, lineHeight: 18, fontWeight: '800', color: t.color.brand }} numberOfLines={1}>
          {formation ?? ''}
        </TotlText>
      </View>
      {players.map((player, index) => (
        <View key={`${code}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, height: 18 }}>
          <TotlText style={{ width: 22, fontSize: 12, lineHeight: 18, fontWeight: '800', textAlign: 'right', color: t.color.muted }}>
            {player.number ?? ''}
          </TotlText>
          <TotlText style={{ flex: 1, marginLeft: 8, fontSize: 14, lineHeight: 18, fontWeight: '700', color: t.color.text }} numberOfLines={1}>
            {player.name}
          </TotlText>
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      {column(xi.homeCode ?? '', xi.homeName ?? '', xi.homeFormation, xi.home)}
      {column(xi.awayCode ?? '', xi.awayName ?? '', xi.awayFormation, xi.away)}
    </View>
  );
}

function PickSplit({ match }: { match: FeedMatch }) {
  const t = useTokens();
  if (!match.pick && !match.percents) return null;
  const outcome = pickOutcome(match.homeScore, match.awayScore);
  // Rainbow whenever the score on the card matches your pick, as the card's rainbow border.
  const shinySide = match.pick && outcome && match.pick === outcome ? outcome : null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
      {(['H', 'D', 'A'] as const).map((side) => {
        const active = match.pick === side;
        const shiny = shinySide === side;
        const code = side === 'H' ? match.homeCode : side === 'A' ? match.awayCode : '';
        const pct = match.percents?.[side];
        const label = pct != null ? (side === 'D' ? `Draw ${pct}%` : `${pct}%`) : side === 'D' ? 'Draw' : 'Win';
        const light = shiny || active;
        return (
          <View
            key={side}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 11,
              borderWidth: shiny ? 0 : 1,
              borderColor: shiny ? 'transparent' : active ? 'rgba(28,131,118,0.4)' : t.color.border,
              backgroundColor: shiny ? 'transparent' : active ? t.color.brand : t.color.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              overflow: 'hidden',
              paddingHorizontal: 4,
            }}
          >
            {shiny ? (
              <LinearGradient
                colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
              />
            ) : null}
            {code ? <Crest code={code} size={18} /> : null}
            {label ? (
              <TotlText style={{ marginLeft: code ? 5 : 0, fontSize: 13, fontWeight: '700', color: light ? '#FFFFFF' : t.color.text }} numberOfLines={1}>
                {label}
              </TotlText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Scoreboard({ item }: { item: FeedItem }) {
  const t = useTokens();
  const match = item.match;
  if (!match && !item.slot?.length) return null;
  if (item.slot?.length) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18, marginBottom: 16 }}>
        {item.slot.map((pair) => (
          <View
            key={`${pair.homeCode}-${pair.awayCode}`}
            style={{ width: '46%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            <Crest code={pair.homeCode} size={36} />
            <TotlText variant="muted" style={{ fontWeight: '800', fontSize: 13 }}>v</TotlText>
            <Crest code={pair.awayCode} size={36} />
          </View>
        ))}
      </View>
    );
  }
  if (!match) return null;
  const kickoff = item.kind === 'kickoff';
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const homeScorers = match.homeScorers ?? [];
  const awayScorers = match.awayScorers ?? [];
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Crest code={match.homeCode} size={48} />
        </View>
        <View style={{ width: 92, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          {kickoff || hasScore ? (
            <TotlText style={{ fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: 0.6, color: t.color.text }}>
              {kickoff ? '0 - 0' : `${match.homeScore} - ${match.awayScore}`}
            </TotlText>
          ) : (
            <TotlText style={{ fontSize: 22, fontWeight: '800', color: t.color.text }}>v</TotlText>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            {match.live ? (
              <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: '#DC2626', marginRight: 5 }} />
            ) : null}
            <TotlText variant="muted" style={{ fontWeight: '700', fontSize: 12 }}>{item.timeLabel}</TotlText>
          </View>
        </View>
        <View style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Crest code={match.awayCode} size={48} />
        </View>
      </View>
      {homeScorers.length || awayScorers.length ? (
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 6 }}>
            {homeScorers.map((line) => (
              <TotlText key={line} numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, fontWeight: '700', textAlign: 'right', color: t.color.text }}>
                {line}
              </TotlText>
            ))}
          </View>
          <View style={{ width: 92 }} />
          <View style={{ flex: 1, alignItems: 'flex-start', paddingLeft: 6 }}>
            {awayScorers.map((line) => (
              <TotlText key={line} numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, fontWeight: '700', textAlign: 'left', color: t.color.text }}>
                {line}
              </TotlText>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function isEmojiCodePoint(codePoint: number): boolean {
  if (codePoint === 0xfe0f || codePoint === 0x200d) return true;
  if (codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff) return true;
  if (codePoint >= 0x1f300 && codePoint <= 0x1faff) return true;
  if (codePoint >= 0x2600 && codePoint <= 0x27bf) return true;
  if (codePoint >= 0x2300 && codePoint <= 0x23ff) return true;
  return false;
}

function tokenizeLine(value: string): Array<{ emoji: boolean; text: string }> {
  const parts: Array<{ emoji: boolean; text: string }> = [];
  let buffer = '';
  let bufferIsEmoji = false;
  const flush = () => {
    if (!buffer) return;
    parts.push({ emoji: bufferIsEmoji, text: buffer });
    buffer = '';
  };
  for (const char of Array.from(value)) {
    const emoji = isEmojiCodePoint(char.codePointAt(0) ?? 0);
    if (buffer && emoji !== bufferIsEmoji) flush();
    bufferIsEmoji = emoji;
    buffer += char;
  }
  flush();
  return parts;
}

/**
 * Gramatika has no emoji glyphs, and simulator Text draws them as "?".
 * Known emoji are bitmap images beside the words.
 */
function MixedText({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const flat = StyleSheet.flatten(style) ?? {};
  const marginTop = typeof flat.marginTop === 'number' ? flat.marginTop : undefined;
  const marginBottom = typeof flat.marginBottom === 'number' ? flat.marginBottom : undefined;
  const marginLeft = typeof flat.marginLeft === 'number' ? flat.marginLeft : undefined;
  const marginRight = typeof flat.marginRight === 'number' ? flat.marginRight : undefined;
  const textStyle = { ...flat, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, marginVertical: 0, marginHorizontal: 0 };
  const lines = children.split('\n');
  return (
    <View style={{ marginTop, marginBottom, marginLeft, marginRight }}>
      {lines.map((line, lineIndex) => {
        const parts = tokenizeLine(line);
        const hasEmoji = parts.some((part) => part.emoji);
        if (!hasEmoji) {
          return (
            <TotlText key={`${lineIndex}-${line}`} style={textStyle}>
              {line}
            </TotlText>
          );
        }
        const flat = StyleSheet.flatten(style) ?? {};
        const glyphSize = typeof flat.fontSize === 'number' ? flat.fontSize : 16;
        return (
          <View key={`${lineIndex}-${line}`} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            {parts.map((part, index) =>
              part.emoji ? (
                <View key={`${index}-emoji`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {Array.from(part.text).map((char, charIndex) => {
                    const codePoint = char.codePointAt(0) ?? 0;
                    if (!hasEmojiBitmap(codePoint)) return null;
                    return <EmojiGlyph key={`${charIndex}-${codePoint}`} codePoint={codePoint} size={glyphSize} />;
                  })}
                </View>
              ) : (
                <TotlText key={`${index}-${part.text}`} style={textStyle}>
                  {part.text}
                </TotlText>
              )
            )}
          </View>
        );
      })}
    </View>
  );
}

function MoveMark({ move }: { move: LeagueStandingLine['move'] }) {
  if (move === 'up') return <Ionicons name="caret-up" size={16} color="#16A34A" />;
  if (move === 'down') return <Ionicons name="caret-down" size={16} color="#DC2626" />;
  return null;
}

function StandingRows({ rows, onDark }: { rows: LeagueStandingLine[]; onDark: boolean }) {
  const t = useTokens();
  const marked = rows.some((row) => row.move !== 'same');
  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      {rows.map((row) => (
        <View key={row.name} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {marked ? (
            <View style={{ width: 18, alignItems: 'center', marginRight: 8 }}>
              <MoveMark move={row.move} />
            </View>
          ) : null}
          {row.avatarUrl ? (
            <Image source={{ uri: row.avatarUrl }} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }} />
          ) : (
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                marginRight: 8,
                backgroundColor: '#1C1408',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TotlText style={{ color: '#F6C445', fontWeight: '800', fontSize: 12 }}>{row.name.slice(0, 1)}</TotlText>
            </View>
          )}
          <TotlText style={{ flex: 1, fontWeight: '700', color: onDark ? '#FFFFFF' : t.color.text }}>{row.name}</TotlText>
          <TotlText style={{ fontWeight: '800', color: onDark ? '#FDE68A' : t.color.text }}>{row.place}</TotlText>
        </View>
      ))}
    </View>
  );
}

function BoardStrip({
  boards,
  avatar,
  onDark,
}: {
  boards: FeedItem['boards'];
  avatar?: string | null;
  onDark: boolean;
}) {
  if (!boards?.length) return null;
  return (
    <View
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: onDark ? 'rgba(255,255,255,0.18)' : '#E2E8F0',
        flexDirection: 'row',
      }}
    >
      {boards.map((board) => {
        const yours = board.label === 'Overall';
        return (
          <View key={board.label} style={{ flex: 1, alignItems: 'center' }}>
            <TotlText style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.3, color: onDark ? '#FDE68A' : '#64748B' }}>
              {board.label}
            </TotlText>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              {yours && avatar ? (
                <Image source={{ uri: avatar }} style={{ width: 18, height: 18, borderRadius: 9, marginRight: 4 }} />
              ) : null}
              <TotlText style={{ fontWeight: '800', fontSize: 15, color: onDark ? '#FFFFFF' : '#0F172A' }}>{board.place}</TotlText>
              {board.move !== 'same' ? (
                <View style={{ marginLeft: 2 }}>
                  <MoveMark move={board.move} />
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function cardWasCorrect(item: FeedItem): boolean {
  if (item.kind === 'round-up' && (item.title === 'You win' || item.title === 'Take a bow' || item.title === 'Swept the day' || item.title === 'Job done')) return true;
  const match = item.match;
  if (!match?.pick || match.homeScore === null || match.awayScore === null) return false;
  return match.pick === pickOutcome(match.homeScore, match.awayScore);
}

/** Space between Game Centre cards (Figma 272:32628). */
const CARD_GAP = 20;

/** No reactions yet. One shared array so memoised cards see the same value each time. */
const NO_REACTIONS: ReactionSummary[] = [];

// Cards are memoised, and their handlers take the item, so the parent can pass the same
// functions to every card: a feed of 100+ cards only redraws the ones that changed.
function FeedCardView({
  item,
  onOpen,
  celebrate,
  arriveDelay = 0,
  reactions = NO_REACTIONS,
  onReact: reactFor,
  social,
}: {
  item: FeedItem;
  onOpen: (item: FeedItem) => void;
  celebrate: boolean;
  arriveDelay?: number;
  reactions?: ReactionSummary[];
  onReact?: (item: FeedItem, emoji: string) => void;
  /** Public cards on stored posts: any emoji, a comment box, and a comments screen. */
  social?: {
    commentCount: number;
    onMore: (item: FeedItem) => void;
    onComment: (item: FeedItem, text: string) => Promise<boolean>;
    onOpenComments: (item: FeedItem) => void;
  } | null;
}) {
  const onReact = reactFor ? (emoji: string) => reactFor(item, emoji) : undefined;
  const [commentDraft, setCommentDraft] = React.useState('');
  const [sendingComment, setSendingComment] = React.useState(false);
  const t = useTokens();
  const confetti = useConfetti();
  const confettiFired = React.useRef(false);
  const rise = React.useRef(new Animated.Value(celebrate ? 0 : 1)).current;
  const pulse = React.useRef(new Animated.Value(1)).current;
  const shouldCelebrate = React.useRef(celebrate).current;
  const bigGoal = item.kind === 'goal';
  const voice = item.kind === 'rank' || item.kind === 'overall' || item.kind === 'round-up' || item.kind === 'waiting' || item.kind === 'opener';
  const youWin = item.kind === 'round-up' && (item.title === 'You win' || item.title === 'Take a bow');
  const rainbow = cardWasCorrect(item);
  const canOpen = Boolean(item.link && (item.link.to === 'overall' || item.link.leagueId));
  const canReact = gameCentreCardType(item.kind) === 'public' && typeof onReact === 'function';
  const onDark = youWin || item.kind === 'round-up';
  const shell = youWin
    ? { backgroundColor: '#0F766E' }
    : item.kind === 'round-up'
      ? { backgroundColor: '#1E293B' }
      : item.kind === 'rank'
        ? { backgroundColor: t.color.surface }
        : item.kind === 'overall'
          ? { backgroundColor: 'rgba(28,131,118,0.12)' }
          : { backgroundColor: t.color.surface };

  React.useEffect(() => {
    pulse.setValue(1);
    if (!shouldCelebrate) {
      rise.setValue(1);
      return;
    }
    rise.setValue(0);
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      Animated.spring(rise, {
        toValue: 1,
        speed: 16,
        bounciness: bigGoal ? 18 : item.kind === 'rank' ? 16 : 12,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (cancelled || !finished || !bigGoal) return;
        const beat = Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(pulse, { toValue: 1, speed: 18, bounciness: 8, useNativeDriver: true }),
        ]);
        loop = Animated.loop(beat, { iterations: 3 });
        loop.start();
      });
    }, arriveDelay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      loop?.stop();
    };
  }, [arriveDelay, bigGoal, item.kind, pulse, rise]);

  React.useEffect(() => {
    if (confettiFired.current || !shouldCelebrate || item.kind !== 'full-time' || !rainbow) return;
    const timer = setTimeout(() => {
      if (confettiFired.current) return;
      confettiFired.current = true;
      confetti.fire({ count: 180, explosionSpeed: 360, fallSpeed: 3000, ttlMs: 4600 });
    }, arriveDelay + 160);
    return () => clearTimeout(timer);
  }, [arriveDelay, confetti, item.kind, rainbow]);

  const header = gameCentreCardHeader(item);
  const content: React.ReactNode[] = [];
  if (header.body) {
    content.push(
      <MixedText key="body" style={{ fontSize: 16, lineHeight: 21, marginBottom: 12, color: onDark ? 'rgba(255,255,255,0.88)' : t.color.text }}>
        {header.body}
      </MixedText>
    );
  }
  if (item.kind === 'lineup') content.push(<LineupTop key="lineup" item={item} />);
  else if (item.kind === 'xi') content.push(<LineupBoard key="xi" item={item} />);
  else if (item.match) content.push(<Scoreboard key="score" item={item} />);
  if (item.match) {
    content.push(
      <View key="split" style={{ marginTop: item.kind === 'lineup' ? 14 : 0 }}>
        <PickSplit match={item.match} />
      </View>
    );
  }
  if (item.honours?.length) {
    content.push(
      <View key="honours" style={{ gap: 10 }}>
        {item.honours.map((line, index) => {
          const faceUri = line.tie ? line.leagueAvatar ?? null : line.userAvatar ?? null;
          return (
            <View key={`${line.text}-${index}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Face uri={faceUri} label={line.faceLabel || line.text} size={28} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <MixedText style={{ color: onDark ? 'rgba(255,255,255,0.92)' : t.color.text, fontSize: 15, lineHeight: 20, fontWeight: '700' }}>
                  {line.trophy ? `${line.text} 🏆` : line.text}
                </MixedText>
              </View>
            </View>
          );
        })}
      </View>
    );
  }
  if (item.standings?.length) content.push(<StandingRows key="standings" rows={item.standings} onDark={onDark} />);
  if (item.boards?.length) content.push(<BoardStrip key="boards" boards={item.boards} avatar={item.boardAvatar} onDark={onDark} />);
  if (item.personal) {
    content.push(
      <MixedText
        key="personal"
        style={{
          marginTop: 8,
          fontWeight: '800',
          color: youWin ? '#FDE68A' : item.personal.includes('way') || item.personal.includes('close') ? '#64748B' : t.color.brand,
        }}
      >
        {item.personal}
      </MixedText>
    );
  }
  if (canOpen && item.link) {
    content.push(
      <Pressable key="link" accessibilityRole="button" onPress={() => onOpen(item)} style={{ marginTop: 12 }}>
        <TotlText style={{ fontWeight: '800', color: onDark ? '#FDE68A' : t.color.brand }}>{item.link.label}</TotlText>
      </Pressable>
    );
  }
  if (item.kind === 'waiting') {
    content.push(
      <View key="waiting">
        <TotlText style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: t.color.muted, marginBottom: 2 }}>
          FIRST TEAMS IN
        </TotlText>
        <TotlText style={{ fontSize: 16, lineHeight: 20, fontWeight: '700', color: t.color.text, fontVariant: ['tabular-nums'] }}>
          {item.stamp || item.timeLabel}
        </TotlText>
      </View>
    );
  }

  const card = (
    <GameCentreCard
      backgroundColor={shell.backgroundColor}
      header={
        <GameCentreCardHeader
          title={header.title}
          subtitle={header.subtitle}
          stamp={item.kind === 'waiting' ? null : item.stamp || item.timeLabel}
          onDark={onDark}
        />
      }
      footer={
        canReact && social ? (
          <>
            <GameCentreReactionBar
              chips={gameCentreReactionChips(reactions)}
              onReact={(emoji) => onReact?.(emoji)}
              onMore={() => social.onMore(item)}
            />
            {social.commentCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => social.onOpenComments(item)}
                hitSlop={6}
                style={{ paddingHorizontal: 16 }}
              >
                <TotlText style={{ fontSize: 14, lineHeight: 18, color: 'rgba(60,60,67,0.6)' }}>
                  {social.commentCount === 1 ? 'View 1 comment' : `View all ${social.commentCount} comments`}
                </TotlText>
              </Pressable>
            ) : null}
            <GameCentreReplyInput
              placeholder="Add your comment"
              value={commentDraft}
              onChangeText={setCommentDraft}
              sending={sendingComment}
              onSend={() => {
                const text = commentDraft.trim();
                if (!text || sendingComment) return;
                setSendingComment(true);
                void social.onComment(item, text).then((sent) => {
                  if (sent) setCommentDraft('');
                  setSendingComment(false);
                });
              }}
            />
          </>
        ) : canReact ? (
          <View style={{ paddingBottom: 20 }}>
            <GameCentreReactionBar chips={gameCentreReactionChips(reactions)} onReact={(emoji) => onReact?.(emoji)} />
          </View>
        ) : null
      }
    >
      {content}
    </GameCentreCard>
  );
  // Tapping a public card opens its comments (its buttons and comment box keep their own taps).
  const tappable =
    canReact && social ? (
      <Pressable accessibilityRole="button" accessibilityHint="Opens the comments" onPress={() => social.onOpenComments(item)}>
        {card}
      </Pressable>
    ) : (
      card
    );

  const framed = rainbow ? (
    <LinearGradient
      colors={['#FACC15', '#FB7185', '#EC4899', '#A855F7', '#22D3EE', '#34D399']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 20, padding: 4 }}
    >
      {tappable}
    </LinearGradient>
  ) : (
    tappable
  );

  const tilt = item.kind === 'rank' ? '8deg' : bigGoal ? '-8deg' : '4deg';
  return (
    <Animated.View
      style={{
        marginBottom: CARD_GAP,
        opacity: rise.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
        transform: [
          { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [item.kind === 'rank' ? 36 : 64, 0], extrapolate: 'clamp' }) },
          { translateX: rise.interpolate({ inputRange: [0, 1], outputRange: [item.kind === 'rank' ? 28 : 0, 0], extrapolate: 'clamp' }) },
          { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [bigGoal ? 0.35 : 0.55, 1] }) },
          { scale: pulse },
          { rotate: rise.interpolate({ inputRange: [0, 1], outputRange: [tilt, '0deg'] }) },
        ],
      }}
    >
      {framed}
    </Animated.View>
  );
}

const FeedCard = React.memo(FeedCardView);

function Face({ uri, label, size }: { uri?: string | null; label: string; size: number }) {
  const letter = label.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: '#1C1408',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <TotlText style={{ color: '#FFE08A', fontWeight: '800', fontSize: Math.round(size * 0.42) }}>{letter}</TotlText>
      )}
    </View>
  );
}

const MESSAGE_REACTS = ['👍', '❤️', '😂', '🔥', '😮', '😢'] as const;

const REACT_GLYPH: Record<string, number> = {
  '👍': 0x1f44d,
  '❤': 0x2764,
  '❤️': 0x2764,
  '😂': 0x1f602,
  '🔥': 0x1f525,
  '😮': 0x1f62e,
  '😢': 0x1f622,
  '😊': 0x1f60a,
  '😎': 0x1f60e,
  '🫠': 0x1fae0,
};

function ReactGlyph({ emoji, size }: { emoji: string; size: number }) {
  const codePoint = REACT_GLYPH[emoji] ?? emoji.codePointAt(0);
  if (codePoint != null && hasEmojiBitmap(codePoint)) {
    return <EmojiGlyph codePoint={codePoint} size={size} />;
  }
  // Happy (😊) and any missing bitmaps still render on device emoji fonts.
  return <TotlText style={{ fontSize: size, lineHeight: size + 2 }}>{emoji}</TotlText>;
}

function chatRecordId(itemId: string): string | null {
  if (!itemId.startsWith('chat:')) return null;
  const id = itemId.slice(5);
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

function toggleReactionList(current: ReactionSummary[] | undefined, emoji: string): ReactionSummary[] {
  const list = current ? [...current] : [];
  const index = list.findIndex((row) => row.emoji === emoji);
  const mine = index >= 0 && list[index].hasUserReacted;
  if (mine) {
    const nextCount = list[index].count - 1;
    if (nextCount <= 0) list.splice(index, 1);
    else list[index] = { ...list[index], count: nextCount, hasUserReacted: false };
    return list;
  }
  if (index >= 0) {
    list[index] = { ...list[index], count: list[index].count + 1, hasUserReacted: true };
    return list;
  }
  list.push({ emoji, count: 1, hasUserReacted: true });
  return list;
}

function MessageRowView({
  item,
  onOpen,
  celebrate,
  arriveDelay = 0,
  replying,
  replyDraft,
  sendingReply,
  reacting,
  reactions,
  youAvatar,
  onToggleReply: toggleReplyFor,
  onChangeReply,
  onSendReply: sendReplyFor,
  onToggleReact: toggleReactFor,
  onReact: reactFor,
}: {
  item: FeedItem;
  onOpen: (item: FeedItem) => void;
  celebrate: boolean;
  arriveDelay?: number;
  replying: boolean;
  replyDraft: string;
  sendingReply: boolean;
  reacting: boolean;
  reactions: ReactionSummary[];
  youAvatar?: string | null;
  onToggleReply: (item: FeedItem) => void;
  onChangeReply: (value: string) => void;
  onSendReply: (item: FeedItem) => void;
  onToggleReact: (item: FeedItem) => void;
  onReact: (item: FeedItem, emoji: string) => void;
}) {
  const onToggleReply = () => toggleReplyFor(item);
  const onSendReply = () => sendReplyFor(item);
  const onToggleReact = () => toggleReactFor(item);
  const onReact = (emoji: string) => reactFor(item, emoji);
  const mine = Boolean(item.mine);
  const authorAvatar = item.authorAvatar || (mine ? youAvatar : null);
  const rise = React.useRef(new Animated.Value(celebrate ? 0 : 1)).current;
  const shouldCelebrate = React.useRef(celebrate).current;

  React.useEffect(() => {
    if (!shouldCelebrate) {
      rise.setValue(1);
      return;
    }
    rise.setValue(0);
    const timer = setTimeout(() => {
      Animated.spring(rise, {
        toValue: 1,
        speed: 14,
        bounciness: 8,
        useNativeDriver: true,
      }).start();
    }, arriveDelay);
    return () => clearTimeout(timer);
  }, [arriveDelay, rise]);

  return (
    <Animated.View
      style={{
        width: '100%',
        marginBottom: CARD_GAP,
        opacity: rise.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
        transform: [
          {
            translateX: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [mine ? 28 : -28, 0],
              extrapolate: 'clamp',
            }),
          },
          { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
        ],
      }}
    >
      <GameCentreCard
        header={
          <GameCentreAuthorHeader
            name={item.title}
            league={item.eyebrow}
            authorAvatar={authorAvatar}
            leagueAvatar={item.leagueAvatar}
            stamp={item.stamp || item.timeLabel}
            onPress={() => onOpen(item)}
          />
        }
        footer={
          <>
            <GameCentreReactionBar
              chips={gameCentreReactionChips(reactions)}
              onReact={onReact}
              onMore={onToggleReact}
              moreOpen={reacting}
            />
            {reacting ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>
                {MESSAGE_REACTS.map((emoji) => {
                  const picked = reactions.some((reaction) => reaction.emoji === emoji && reaction.hasUserReacted);
                  return (
                    <Pressable
                      key={emoji}
                      accessibilityRole="button"
                      accessibilityLabel={`React with ${emoji}`}
                      onPress={() => onReact(emoji)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: picked ? 'rgba(28,131,118,0.16)' : '#F2F2F7',
                        borderWidth: picked ? 1.5 : 0,
                        borderColor: picked ? '#1C8376' : 'transparent',
                      }}
                    >
                      <ReactGlyph emoji={emoji} size={22} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <GameCentreReplyInput
              placeholder={mine ? `Reply in ${item.eyebrow}` : `Reply to ${item.title}`}
              value={replyDraft}
              onChangeText={onChangeReply}
              onFocus={() => {
                if (!replying) onToggleReply();
              }}
              onSend={onSendReply}
              sending={sendingReply}
            />
          </>
        }
      >
        <Pressable accessibilityRole="button" accessibilityHint="Opens the league chat" onPress={() => onOpen(item)} style={{ paddingHorizontal: 4 }}>
          {item.replyTo ? (
            <View style={{ borderLeftWidth: 3, borderLeftColor: '#DFEBE9', paddingLeft: 10, marginBottom: 12 }}>
              <TotlText numberOfLines={2} style={{ fontSize: 14, lineHeight: 18, color: 'rgba(60,60,67,0.6)' }}>
                {item.replyTo}
              </TotlText>
            </View>
          ) : null}
          <MixedText style={{ fontSize: 18, lineHeight: 22, letterSpacing: 0.18, color: '#000000' }}>{item.body}</MixedText>
        </Pressable>
      </GameCentreCard>
    </Animated.View>
  );
}

const MessageRow = React.memo(MessageRowView);

type TickerMove = 'up' | 'down' | 'same' | null;

type TickerLeague = {
  id: string;
  name: string;
  avatarUri: string | null;
  rank: number;
  move: TickerMove;
};

type TickerBoard = {
  key: 'overall' | 'monthly' | 'gw';
  label: string;
  rank: number | null;
  move: TickerMove;
};

type TickerFixture = {
  key: string;
  homeCode: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  statusLabel: string;
  live: boolean;
  finished: boolean;
  pick: Pick | null;
};

function tickerLiveRow(
  fixture: Fixture,
  liveByFixtureIndex: Map<number, LiveScore>,
  liveByApiMatchId: Map<number, LiveScore>
): LiveScore | undefined {
  const idx = Number(fixture.fixture_index);
  if (Number.isInteger(idx)) {
    const row = liveByFixtureIndex.get(idx);
    if (row) return row;
  }
  const apiMatchId = Number(fixture.api_match_id);
  if (Number.isInteger(apiMatchId)) return liveByApiMatchId.get(apiMatchId);
  return undefined;
}

function tickerDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3).toLowerCase();
}

function buildTickerFixtures(
  fixtures: Fixture[],
  liveByFixtureIndex: Map<number, LiveScore>,
  liveByApiMatchId: Map<number, LiveScore>,
  picks: Record<string, Pick | undefined>
): TickerFixture[] {
  return fixtures
    .slice()
    .sort((a, b) => {
      const aKick = a.kickoff_time ? new Date(a.kickoff_time).getTime() : 0;
      const bKick = b.kickoff_time ? new Date(b.kickoff_time).getTime() : 0;
      return aKick - bKick;
    })
    .map((fixture) => {
      const live = tickerLiveRow(fixture, liveByFixtureIndex, liveByApiMatchId);
      const status = live?.status ?? null;
      const home = typeof live?.home_score === 'number' ? live.home_score : null;
      const away = typeof live?.away_score === 'number' ? live.away_score : null;
      const started = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
      let statusLabel = '';
      if (status === 'FINISHED') statusLabel = 'FT';
      else if (status === 'PAUSED') statusLabel = 'HT';
      else if (status === 'IN_PLAY') statusLabel = typeof live?.minute === 'number' ? `${live.minute}'` : 'LIVE';
      else {
        const day = tickerDay(fixture.kickoff_time);
        const time = formatLocalTimeHHmm(fixture.kickoff_time);
        statusLabel = [day, time !== '—' ? time : ''].filter(Boolean).join(' ');
      }
      const pick = picks[String(fixture.fixture_index)] ?? null;
      return {
        key: `${fixture.fixture_index}-${fixture.api_match_id ?? ''}`,
        homeCode: String(fixture.home_code ?? '').toUpperCase(),
        awayCode: String(fixture.away_code ?? '').toUpperCase(),
        homeScore: started ? home : null,
        awayScore: started ? away : null,
        statusLabel,
        live: status === 'IN_PLAY',
        finished: status === 'FINISHED',
        pick: pick === 'H' || pick === 'D' || pick === 'A' ? pick : null,
      };
    });
}

function TickerPickBar({ correct, finished }: { correct: boolean; finished: boolean }) {
  if (finished && correct) {
    return (
      <View style={{ width: 32, height: 6, borderRadius: 3, overflow: 'hidden' }}>
        <LinearGradient
          colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
      </View>
    );
  }
  return (
    <View
      style={{
        width: 32,
        height: 6,
        borderRadius: 3,
        backgroundColor: correct ? '#1C8376' : '#B6C2D1',
      }}
    />
  );
}

function tickerPlace(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

function tickerMove(before: number | null, after: number | null): TickerMove {
  if (before == null || after == null) return null;
  if (after < before) return 'up';
  if (after > before) return 'down';
  return 'same';
}

function tickerTableRank(
  rows: Array<{ user_id: string; score: number; unicorns?: number }>,
  userId: string
): number | null {
  const mine = rows.find((row) => row.user_id === userId);
  if (!mine) return null;
  const unicorns = mine.unicorns ?? 0;
  const higher = rows.filter(
    (row) => row.score > mine.score || (row.score === mine.score && (row.unicorns ?? 0) > unicorns)
  ).length;
  return higher + 1;
}

function TickerMoveMark({ move }: { move: TickerMove }) {
  if (move === 'up') return <Ionicons name="caret-up" size={16} color="#16A34A" style={{ marginLeft: 2 }} />;
  if (move === 'down') return <Ionicons name="caret-down" size={16} color="#DC2626" style={{ marginLeft: 2 }} />;
  if (move === 'same') {
    return <TotlText style={{ marginLeft: 4, color: '#64748B', fontSize: 16, lineHeight: 18, fontWeight: '800' }}>=</TotlText>;
  }
  return null;
}

/** Eases in, then breathes twice. */
function NewUpdatesButton({ onPress, atTop = false, topOffset = 0 }: { onPress: () => void; atTop?: boolean; topOffset?: number }) {
  const t = useTokens();
  const scale = React.useRef(new Animated.Value(0.96)).current;

  React.useEffect(() => {
    const breath = Animated.sequence([
      Animated.timing(scale, { toValue: 1.04, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]);
    Animated.timing(scale, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      Animated.loop(breath, { iterations: 2 }).start();
    });
  }, [scale]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        ...(atTop ? { top: 72 + topOffset } : { bottom: 84 }),
        alignItems: 'center',
        zIndex: 4,
        transform: [{ scale }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New updates"
        onPress={onPress}
        style={{
          backgroundColor: t.color.brand,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 999,
        }}
      >
        <TotlText style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>New Updates</TotlText>
      </Pressable>
    </Animated.View>
  );
}

function FixtureTicker({
  games,
  leagues,
  boards,
}: {
  games: TickerFixture[];
  leagues: TickerLeague[];
  boards: TickerBoard[];
}) {
  const t = useTokens();
  const shift = useSharedValue(0);
  const [loopWidth, setLoopWidth] = React.useState(0);
  // Structure only — scores/ranks/moves must NOT restart the marquee (that was the glitch).
  const structureKey = [
    games.map((game) => game.key).join('|'),
    leagues.map((league) => league.id).join('|'),
    boards.map((board) => board.key).join('|'),
  ].join('~');
  const structureRef = React.useRef(structureKey);
  const loopWidthRef = React.useRef(0);

  React.useEffect(() => {
    if (loopWidth <= 0) return;
    const structureChanged = structureRef.current !== structureKey;
    structureRef.current = structureKey;
    const prevWidth = loopWidthRef.current;
    loopWidthRef.current = loopWidth;

    cancelAnimation(shift);
    // ~100px/s — steady on device; duration scales with strip length
    const msPerPx = 10;
    const fullDuration = Math.max(16000, loopWidth * msPerPx);

    if (structureChanged || prevWidth <= 0) {
      shift.value = 0;
      shift.value = withRepeat(
        withTiming(-loopWidth, { duration: fullDuration, easing: ReEasing.linear }),
        -1,
        false
      );
      return () => cancelAnimation(shift);
    }

    // Width reflow (score text etc.): keep progress, finish the lap, then loop.
    const traveled = Math.abs(shift.value);
    const progress = prevWidth > 0 ? Math.min(1, traveled / prevWidth) : 0;
    shift.value = -progress * loopWidth;
    const remaining = Math.max(0, loopWidth + shift.value);
    const firstMs = Math.max(200, remaining * msPerPx);
    shift.value = withTiming(-loopWidth, { duration: firstMs, easing: ReEasing.linear }, (finished) => {
      'worklet';
      if (!finished) return;
      shift.value = 0;
      shift.value = withRepeat(
        withTiming(-loopWidth, { duration: fullDuration, easing: ReEasing.linear }),
        -1,
        false
      );
    });
    return () => cancelAnimation(shift);
  }, [structureKey, loopWidth, shift]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }],
  }));

  const renderChips = (copy: string) =>
    games.map((item) => {
      const hasScore = item.homeScore !== null && item.awayScore !== null;
      const outcome = !hasScore ? null : item.homeScore! > item.awayScore! ? 'H' : item.awayScore! > item.homeScore! ? 'A' : 'D';
      const known = outcome !== null && item.pick !== null;
      const correct = known && item.pick === outcome;
      const bar = item.pick ? <TickerPickBar correct={!known || correct} finished={item.finished && correct} /> : null;
      return (
        <View key={`${copy}-${item.key}`} style={{ flexDirection: 'row', alignItems: 'flex-start', marginRight: 32 }}>
          <View style={{ width: 32, alignItems: 'center' }}>
            <View style={{ height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Crest code={item.homeCode} size={32} />
            </View>
            <View style={{ height: 8, alignItems: 'center', justifyContent: 'center' }}>{item.pick === 'H' ? bar : null}</View>
            <View style={{ height: 18 }} />
          </View>
          {/* Fixed score column so live score/minute text does not reflow the strip width. */}
          <View style={{ width: 64, alignItems: 'center' }}>
            <View style={{ height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <TotlText
                numberOfLines={1}
                style={{
                  fontSize: 16,
                  lineHeight: 18,
                  fontWeight: '800',
                  color: t.color.text,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {hasScore ? `${item.homeScore}–${item.awayScore}` : 'v'}
              </TotlText>
            </View>
            <View style={{ height: 8, alignItems: 'center', justifyContent: 'center' }}>{item.pick === 'D' ? bar : null}</View>
            <View style={{ height: 18, width: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {item.live ? <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: '#DC2626', marginRight: 3 }} /> : null}
              <TotlText
                numberOfLines={1}
                style={{ fontSize: 11, lineHeight: 14, fontWeight: '700', color: t.color.muted, fontVariant: ['tabular-nums'] }}
              >
                {item.statusLabel}
              </TotlText>
            </View>
          </View>
          <View style={{ width: 32, alignItems: 'center' }}>
            <View style={{ height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Crest code={item.awayCode} size={32} />
            </View>
            <View style={{ height: 8, alignItems: 'center', justifyContent: 'center' }}>{item.pick === 'A' ? bar : null}</View>
            <View style={{ height: 18 }} />
          </View>
        </View>
      );
    });

  const renderStrip = (copy: string) => {
    const sectionRule = (name: string) => (
      <View
        key={`${copy}-${name}`}
        style={{ width: 1, height: 28, borderRadius: 1, backgroundColor: '#94A3B8', marginRight: 32, alignSelf: 'center' }}
      />
    );
    return (
    <>
      {renderChips(copy)}
      {games.length && leagues.length ? sectionRule('after-games') : null}
      {leagues.map((league) => (
        <View key={`${copy}-ml-${league.id}`} style={{ flexDirection: 'row', alignItems: 'center', height: 54, marginRight: 32 }}>
          {league.avatarUri ? (
            <Image source={{ uri: league.avatarUri }} style={{ width: 32, height: 32, borderRadius: 16 }} />
          ) : (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#1C1408', alignItems: 'center', justifyContent: 'center' }}>
              <TotlText style={{ color: '#F6C445', fontWeight: '800', fontSize: 14 }}>{league.name.slice(0, 1)}</TotlText>
            </View>
          )}
          <TotlText numberOfLines={1} style={{ marginLeft: 8, maxWidth: 140, color: t.color.text, fontSize: 16, lineHeight: 20, fontWeight: '800' }}>
            {league.name}
          </TotlText>
          <TotlText style={{ marginLeft: 8, color: t.color.text, fontSize: 16, lineHeight: 20, fontWeight: '800' }}>{tickerPlace(league.rank)}</TotlText>
          <TickerMoveMark move={league.move} />
        </View>
      ))}
      {boards.length && (games.length || leagues.length) ? sectionRule(leagues.length ? 'after-leagues' : 'after-games-boards') : null}
      {boards.map((board) => (
        <View key={`${copy}-board-${board.key}`} style={{ alignItems: 'center', justifyContent: 'center', height: 54, marginRight: 32, minWidth: 72 }}>
          <TotlText style={{ color: t.color.muted, fontSize: 11, lineHeight: 13, fontWeight: '700' }}>{board.label}</TotlText>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <TotlText style={{ color: t.color.text, fontSize: 16, lineHeight: 20, fontWeight: '800' }}>
              {board.rank != null ? tickerPlace(board.rank) : '–'}
            </TotlText>
            <TickerMoveMark move={board.move} />
          </View>
        </View>
      ))}
      {(games.length && (leagues.length || boards.length)) || (leagues.length && boards.length) ? sectionRule('loop') : null}
    </>
    );
  };

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 78,
        backgroundColor: '#FFF7ED',
        borderTopWidth: 1,
        borderTopColor: t.color.border,
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={['#FEF3C7', '#FBCFE8', '#DDD6FE', '#BAE6FD', '#A7F3D0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.45 }}
      />
      <Reanimated.View style={[{ flexDirection: 'row', alignItems: 'center' }, trackStyle]}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            // Ignore tiny reflows from live score/minute text so the loop does not hitch.
            setLoopWidth((current) => {
              if (current === 0) return width;
              if (Math.abs(current - width) < 4) return current;
              return width;
            });
          }}
        >
          {renderStrip('a')}
        </View>
        {/* Identical copy — same padding — so the loop seam is invisible */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}>{renderStrip('b')}</View>
      </Reanimated.View>
    </View>
  );
}

export default function MatchCenterScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<HomeStackParamList, 'MatchCenter'>>();
  const entry = route.params?.entry ?? 'current';
  // Set when this is the app's home (the Game Centre), with the side menu behind it.
  const menu = useGameCentreMenu();
  // The Game Centre reads like X or Threads: newest card on top, older ones further down.
  const newestFirst = !!menu;
  const { useSeasonStack, seasonId, seasonLabel } = useViewerSeason();
  const { openManualResultsScoreSheetShare, openManualRoundUpStack } = usePopupCards();
  const [mode, setMode] = React.useState<Mode>(() => (entry === 'example' ? 'play' : 'live'));
  const [week, setWeek] = React.useState<'current' | 'last'>(() => (entry === 'last' ? 'last' : 'current'));
  const [played, setPlayed] = React.useState(1);
  const [playRun, setPlayRun] = React.useState(0);
  const [rankCards, setRankCards] = React.useState<FeedItem[]>([]);
  const [replyId, setReplyId] = React.useState<string | null>(null);
  const [replyDraft, setReplyDraft] = React.useState('');
  const [sendingReply, setSendingReply] = React.useState(false);
  const [reactId, setReactId] = React.useState<string | null>(null);
  const [localReactions, setLocalReactions] = React.useState<Record<string, ReactionSummary[]>>({});
  const [localReplies, setLocalReplies] = React.useState<FeedItem[]>([]);
  const queryClient = useQueryClient();
  const prevLeagueRanks = React.useRef<Map<string, number> | null>(null);
  const scrollRef = React.useRef<FlatList<FeedItem>>(null);

  // Admin can open Last GW / Example; normal entry is always the live current GW.
  React.useEffect(() => {
    if (entry === 'last') {
      setWeek('last');
      setMode('live');
      return;
    }
    if (entry === 'example') {
      setWeek('current');
      setPlayed(1);
      setPlayRun((run) => run + 1);
      setMode('play');
      return;
    }
    setWeek('current');
    setMode('live');
  }, [entry]);

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

  const { data: profileSummary } = useQuery({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });

  const { data: home, isLoading: homeLoading, error: homeError } = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });

  const publishedGw = typeof home?.currentGw === 'number' ? home.currentGw : null;
  const lastGw = publishedGw != null && publishedGw > 1 ? publishedGw - 1 : null;
  const { data: lastHome, isLoading: lastLoading, error: lastError } = useQuery({
    enabled: typeof lastGw === 'number',
    queryKey: ['homeSnapshot', 'match-center-last', lastGw],
    queryFn: () => api.getHomeSnapshot({ gw: lastGw as number }),
    staleTime: 60_000,
  });
  // As home, keep last gameweek's feed up until the next one starts (its line-ups land),
  // so there is always something to scroll back through.
  const [minuteMs, setMinuteMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!menu) return;
    const timer = setInterval(() => setMinuteMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [menu]);
  const nextKickoffMs = firstKickoffMs(home?.fixtures ?? []);
  const betweenGameweeks =
    !!menu && nextKickoffMs != null && minuteMs < nextKickoffMs - 75 * 60_000;
  const viewingLast = mode === 'live' && (week === 'last' || betweenGameweeks) && typeof lastGw === 'number';
  const board = viewingLast ? lastHome : home;
  const boardLoading = viewingLast ? lastLoading && !lastHome : homeLoading && !home;
  const boardError = viewingLast ? lastError : homeError;
  const gw = board?.viewingGw ?? (viewingLast ? lastGw : board?.currentGw ?? null);
  const { data: predictionsMeta, isFetched: predictionsFetched } = useQuery({
    enabled: typeof gw === 'number',
    queryKey: ['home-predictions-meta', gw],
    queryFn: () => api.getPredictions({ gw: gw as number }),
    staleTime: 60_000,
  });
  const teamForms = React.useMemo(
    () => normalizeTeamForms((predictionsMeta?.teamForms ?? {}) as Record<string, string>),
    [predictionsMeta?.teamForms]
  );
  const predictedPositions = React.useMemo(
    () => normalizeTeamPositions((predictionsMeta?.teamPositions ?? {}) as Record<string, unknown>),
    [predictionsMeta?.teamPositions]
  );
  const { data: fallbackPositions, isFetched: positionsFetched } = useQuery({
    queryKey: ['predictions-team-positions-home', gw ?? 'current'],
    queryFn: async () => fetchTeamPositionsWithFallback((predictionsMeta?.teamPositions ?? {}) as Record<string, unknown>),
    enabled: typeof gw === 'number' && Object.keys(predictedPositions).length < 20,
    staleTime: 60_000,
  });
  const teamPositions = React.useMemo(
    () => ({ ...(fallbackPositions ?? {}), ...predictedPositions }),
    [fallbackPositions, predictedPositions]
  );
  const { liveByFixtureIndex, liveByApiMatchId, loading: liveScoresLoading, error: liveScoresError } = useLiveScores(gw, { initial: board?.liveScores ?? [] });
  // Stored posts (behind EXPO_PUBLIC_GAME_CENTRE_POSTS). Until a gameweek has any, the
  // feed keeps building match cards from live scores as before.
  const postsOn = env.EXPO_PUBLIC_GAME_CENTRE_POSTS === 'on' && mode === 'live';
  const { posts: storedPosts } = useGameCentrePosts(typeof gw === 'number' ? gw : null, postsOn);
  const feedPosts = postsOn && storedPosts && storedPosts.length > 0 ? storedPosts : null;

  const { data: leaguesData, isFetched: leaguesFetched } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
    staleTime: 60_000,
  });

  const leagueIds = (leaguesData?.leagues ?? []).map((league) => league.id).join(',');
  const { data: leagueTables, isFetched: tablesFetched } = useQuery({
    enabled: mode === 'live' && typeof gw === 'number' && leagueIds.length > 0,
    queryKey: ['match-center-tables', gw, leagueIds],
    staleTime: MC_TABLE_MS,
    refetchInterval: MC_TABLE_MS,
    queryFn: async (): Promise<LeagueTableSnap[]> => {
      const leagues = leaguesData?.leagues ?? [];
      const snaps = await Promise.all(
        leagues.map(async (league) => {
          const table = await api.getLeagueGwTable(league.id, gw as number);
          return {
            id: league.id,
            name: league.name,
            avatarUrl: resolveLeagueAvatarUri(league.avatar || getDefaultMlAvatarFilename(league.id)),
            rows: table.rows.map((row) => ({
              user_id: row.user_id,
              name: row.name,
              score: row.score,
              avatarUrl: null as string | null,
            })),
          };
        })
      );
      const ids = [...new Set(snaps.flatMap((league) => league.rows.map((row) => row.user_id)))];
      const avatarById = new Map<string, string>();
      if (ids.length) {
        const { data: people } = await supabase.from('users').select('id, avatar_url').in('id', ids);
        (people ?? []).forEach((person) => {
          const avatar = typeof person.avatar_url === 'string' ? person.avatar_url.trim() : '';
          if (avatar) avatarById.set(String(person.id), avatar);
        });
      }
      return snaps.map((league) => ({
        ...league,
        rows: league.rows.map((row) => ({ ...row, avatarUrl: avatarById.get(row.user_id) ?? null })),
      }));
    },
  });

  const memberIds = React.useMemo(() => {
    const ids = new Set<string>();
    (leagueTables ?? []).forEach((league) => league.rows.forEach((row) => ids.add(row.user_id)));
    return [...ids].sort();
  }, [leagueTables]);

  const { data: pickRows, isSuccess: picksReady, isFetched: picksFetched } = useQuery({
    enabled: mode === 'live' && typeof gw === 'number' && memberIds.length > 0 && (!useSeasonStack || !!seasonId),
    queryKey: ['match-center-picks', gw, useSeasonStack ? seasonId : 'legacy', memberIds.join(',')],
    staleTime: 60_000,
    queryFn: async () => {
      const pileB = useSeasonStack && !!seasonId;
      let query = (supabase as any)
        .from(pileB ? 'app_season_picks' : 'app_picks')
        .select('user_id, fixture_index, pick')
        .eq('gw', gw)
        .in('user_id', memberIds);
      if (pileB) query = query.eq('season_id', seasonId);
      const { data, error } = await query.limit(2000);
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; fixture_index: number; pick: string | null }>;
    },
  });

  const { data: pickPercentageRows, isFetched: percentsFetched } = useQuery({
    enabled: mode === 'live' && typeof gw === 'number' && (!useSeasonStack || !!seasonId),
    queryKey: ['match-center-pick-pct', gw, useSeasonStack ? seasonId : 'legacy'],
    staleTime: MC_HEAVY_STALE_MS,
    queryFn: async () => {
      const tables = useSeasonStack && seasonId ? SEASON_PILE_TABLES : LEGACY_PILE_TABLES;
      return fetchAllSupabaseRows<{ fixture_index: number; pick: string | null }>((from, to) => {
        let query = (supabase as any).from(tables.picks).select('fixture_index, pick').eq('gw', gw);
        if (useSeasonStack && seasonId) query = query.eq('season_id', seasonId);
        return query.range(from, to);
      });
    },
  });

  const pickPercents = React.useMemo(() => {
    const counts = new Map<number, { H: number; D: number; A: number; total: number }>();
    (pickPercentageRows ?? []).forEach((row) => {
      if (row.pick !== 'H' && row.pick !== 'D' && row.pick !== 'A') return;
      if (typeof row.fixture_index !== 'number') return;
      const current = counts.get(row.fixture_index) ?? { H: 0, D: 0, A: 0, total: 0 };
      current[row.pick] += 1;
      current.total += 1;
      counts.set(row.fixture_index, current);
    });
    const out = new Map<number, { H: number; D: number; A: number }>();
    counts.forEach((count, fixtureIndex) => {
      if (count.total <= 0) return;
      out.set(fixtureIndex, {
        H: Math.round((count.H / count.total) * 100),
        D: Math.round((count.D / count.total) * 100),
        A: Math.round((count.A / count.total) * 100),
      });
    });
    return out;
  }, [pickPercentageRows]);

  const seasonKey: LeaderboardSeasonKey = seasonLabel === SEASON_2026_27_LABEL ? '2026/27' : '2025/26';
  const month = typeof gw === 'number' ? getMonthForGw(gw, seasonKey) : null;
  const monthLabel = month ? (month.label.split(' ')[0] ?? '').slice(0, 3) : '';

  const { data: overallReplay, isFetched: overallFetched } = useQuery({
    enabled: mode === 'live' && typeof gw === 'number' && !!userId && (!useSeasonStack || !!seasonId),
    queryKey: ['match-center-overall-replay', gw, useSeasonStack ? seasonId : 'legacy', monthLabel],
    staleTime: MC_HEAVY_STALE_MS,
    queryFn: async (): Promise<OverallReplay> => {
      const currentGw = gw as number;
      const pileB = useSeasonStack && !!seasonId;
      const tables = pileB ? SEASON_PILE_TABLES : LEGACY_PILE_TABLES;
      const [points, everyone] = await Promise.all([
        fetchAllSupabaseRows<{ user_id: string; gw: number; points: number }>((from, to) => {
          let query = (supabase as any)
            .from(tables.gwPoints)
            .select('user_id, gw, points')
            .order('gw', { ascending: true })
            .order('user_id', { ascending: true })
            .range(from, to);
          if (pileB) query = query.eq('season_id', seasonId);
          return query;
        }),
        fetchAllSupabaseRows<{ user_id: string; fixture_index: number; pick: string | null }>((from, to) => {
          let query = (supabase as any).from(tables.picks).select('user_id, fixture_index, pick').eq('gw', currentGw);
          if (pileB) query = query.eq('season_id', seasonId);
          return query.range(from, to);
        }),
      ]);
      const beforeGw: Record<string, number> = {};
      const monthBefore: Record<string, number> = {};
      const monthStart = month?.startGw ?? currentGw;
      points.forEach((row) => {
        const id = String(row.user_id ?? '');
        const week = Number(row.gw);
        if (!id || !Number.isFinite(week) || week >= currentGw) return;
        const pts = Number(row.points ?? 0);
        beforeGw[id] = (beforeGw[id] ?? 0) + pts;
        if (week >= monthStart) monthBefore[id] = (monthBefore[id] ?? 0) + pts;
      });
      const picks: Record<string, Record<number, Pick>> = {};
      everyone.forEach((row) => {
        if (row.pick !== 'H' && row.pick !== 'D' && row.pick !== 'A') return;
        if (typeof row.fixture_index !== 'number') return;
        const id = String(row.user_id ?? '');
        if (!id) return;
        const bag = picks[id] ?? {};
        bag[row.fixture_index] = row.pick;
        picks[id] = bag;
      });
      return { beforeGw, monthBefore, monthLabel, picks };
    },
  });

  const leaguePicks = React.useMemo((): LeaguePickSnap[] => {
    if (!picksReady || !leagueTables) return [];
    const byUser = new Map<string, Record<number, Pick>>();
    (pickRows ?? []).forEach((row) => {
      if (row.pick !== 'H' && row.pick !== 'D' && row.pick !== 'A') return;
      const bag = byUser.get(row.user_id) ?? {};
      bag[row.fixture_index] = row.pick;
      byUser.set(row.user_id, bag);
    });
    const avatarByLeague = new Map(
      (leaguesData?.leagues ?? []).map((league) => [
        league.id,
        resolveLeagueAvatarUri(league.avatar || getDefaultMlAvatarFilename(league.id)),
      ])
    );
    return leagueTables.map((league) => ({
      id: league.id,
      name: league.name,
      avatarUrl: avatarByLeague.get(league.id) ?? resolveLeagueAvatarUri(getDefaultMlAvatarFilename(league.id)),
      members: league.rows.map((row) => ({
        userId: row.user_id,
        name: row.name,
        picks: byUser.get(row.user_id) ?? {},
      })),
    }));
  }, [leagueTables, leaguesData?.leagues, pickRows, picksReady]);

  const replayOn = leaguePicks.some((league) => league.members.some((member) => Object.keys(member.picks).length > 0));

  const { data: liveTable } = useQuery({
    enabled: typeof gw === 'number',
    queryKey: ['match-center-gw-live', gw],
    queryFn: () => api.getGlobalGwLiveTable(gw as number),
    staleTime: MC_LIVE_BOARD_MS,
    refetchInterval: MC_LIVE_BOARD_MS,
  });

  const fixtures = board?.fixtures ?? [];
  const allFinished =
    fixtures.length > 0 &&
    fixtures.every((fixture) => liveByFixtureIndex.get(fixture.fixture_index)?.status === 'FINISHED');

  const { data: gwResults, isFetched: resultsFetched } = useQuery({
    enabled: mode === 'live' && allFinished && typeof gw === 'number',
    queryKey: ['gwResults', gw, 'match-center'],
    queryFn: () => api.getGwResults(gw as number),
  });

  React.useEffect(() => {
    if (mode !== 'live' || !userId || !leagueTables) return;
    const next = new Map<string, number>();
    const fresh: FeedItem[] = [];
    const at = Date.now();
    for (const league of leagueTables) {
      const rank = rankOf(league.rows, userId);
      if (!rank) continue;
      next.set(league.id, rank);
      const before = prevLeagueRanks.current?.get(league.id);
      if (!replayOn && prevLeagueRanks.current && typeof before === 'number') {
        const card = rankChangeItem({
          leagueId: league.id,
          leagueName: league.name,
          before,
          after: rank,
          at,
        });
        if (card) fresh.push(card);
      }
    }
    if (prevLeagueRanks.current && fresh.length) {
      setRankCards((current) => [...current, ...fresh]);
    }
    prevLeagueRanks.current = next;
  }, [leagueTables, mode, replayOn, userId]);

  React.useEffect(() => {
    setRankCards([]);
    prevLeagueRanks.current = null;
  }, [gw]);

  React.useEffect(() => {
    if (mode !== 'play') return;
    setPlayed(1);
    const script = sampleFeed();
    let count = 1;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    const step = () => {
      if (!alive || count >= script.length) return;
      const arriving = script[count];
      const previous = script[count - 1];
      const afterGoal =
        (previous?.kind === 'goal' || previous?.kind === 'full-time') && arriving?.kind === 'rank';
      const backToBack =
        (previous?.kind === 'goal' && arriving?.kind === 'message') ||
        (previous?.kind === 'rank' && arriving?.kind === 'message') ||
        (previous?.kind === 'lineup' && arriving?.kind === 'xi');
      timer = setTimeout(() => {
        if (!alive) return;
        count += 1;
        setPlayed(count);
        step();
      }, afterGoal ? 5000 : backToBack ? 700 : 6000);
    };
    step();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [mode, playRun]);

  // Chat joins the feed when Match Center opens (line-up window), not at kickoff —
  // otherwise pre-KO banter never appears while the XI cards are already live.
  // Inline 75m (same as MATCH_CENTER_LINEUP_LEAD_MS) to avoid a Hermes TDZ on the named export.
  const chatSince = React.useMemo(() => {
    const ko = firstKickoffMs(board?.fixtures ?? []);
    if (ko === null) return null;
    return new Date(ko - 75 * 60_000).toISOString();
  }, [board?.fixtures]);

  // MC chat window ends at midnight on the day after the last kickoff.
  const chatUntil = React.useMemo(() => {
    const closes = matchCenterClosesAtMs(board?.fixtures ?? []);
    return closes === null ? null : new Date(closes).toISOString();
  }, [board?.fixtures]);

  const { data: chatItems, isFetched: chatFetched } = useQuery({
    enabled: mode === 'live' && (leaguesData?.leagues.length ?? 0) > 0 && !!chatSince && !!chatUntil,
    queryKey: ['match-center-chat', leagueIds, chatSince, chatUntil, userId],
    staleTime: 15_000,
    refetchInterval: MC_CHAT_POLL_MS,
    queryFn: async (): Promise<FeedItem[]> => {
      const leagues = leaguesData?.leagues ?? [];
      const ids = leagues.map((league) => league.id);
      if (!chatSince || !chatUntil || !ids.length) return [];
      const { data, error } = await supabase
        .from('league_messages')
        .select('id, league_id, user_id, content, created_at, reply_to:league_messages!reply_to_message_id(content)')
        .in('league_id', ids)
        .neq('user_id', VOLLEY_USER_ID)
        .gte('created_at', chatSince)
        .lt('created_at', chatUntil)
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        id: string;
        league_id: string;
        user_id: string;
        content: string | null;
        created_at: string;
        reply_to?: { content?: string | null } | Array<{ content?: string | null }> | null;
      }>;
      const nameById = new Map<string, string>();
      const avatarById = new Map<string, string>();
      const speakerIds = [...new Set(rows.map((row) => String(row.user_id)).filter(Boolean))];
      if (speakerIds.length) {
        const { data: people } = await supabase.from('users').select('id, name, avatar_url').in('id', speakerIds);
        (people ?? []).forEach((person) => {
          const name = typeof person.name === 'string' ? person.name.trim() : '';
          if (name) nameById.set(String(person.id), name);
          const avatar = typeof person.avatar_url === 'string' ? person.avatar_url.trim() : '';
          if (avatar) avatarById.set(String(person.id), avatar);
        });
      }
      const leagueName = new Map(leagues.map((league) => [league.id, league.name]));
      const leagueAvatar = new Map(
        leagues.map((league) => [
          league.id,
          resolveLeagueAvatarUri(league.avatar || getDefaultMlAvatarFilename(league.id)),
        ])
      );
      return rows
        .slice()
        .reverse()
        .flatMap((row) => {
          // Volley system messages belong in league chat, not Match Center.
          if (String(row.user_id) === VOLLEY_USER_ID) return [];
          const at = String(row.created_at);
          if (at < chatSince || at >= chatUntil) return [];
          const body = String(row.content ?? '').trim();
          if (!body) return [];
          const replyRaw = row.reply_to;
          const reply = Array.isArray(replyRaw) ? replyRaw[0] : replyRaw;
          const replyTo = typeof reply?.content === 'string' ? reply.content.trim() : '';
          return [
            chatMessageItem({
              id: String(row.id),
              at,
              leagueId: String(row.league_id),
              leagueName: leagueName.get(String(row.league_id)) ?? 'Mini-league',
              author: nameById.get(String(row.user_id)) ?? 'Someone',
              body,
              mine: userId != null && String(row.user_id) === userId,
              replyTo: replyTo || null,
              authorAvatar: avatarById.get(String(row.user_id)) ?? null,
              leagueAvatar: leagueAvatar.get(String(row.league_id)) ?? null,
            }),
          ];
        });
    },
  });

  // Push chat into the feed when messages land — avoid 15s hammering of league_messages.
  React.useEffect(() => {
    if (mode !== 'live' || !leagueIds || !chatSince || !chatUntil) return;
    const ids = leagueIds.split(',').filter(Boolean);
    if (!ids.length) return;
    const channel = supabase
      .channel(`mc-chat:${leagueIds.slice(0, 64)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'league_messages' },
        (payload) => {
          const leagueId = String((payload.new as { league_id?: string } | null)?.league_id ?? '');
          if (!ids.includes(leagueId)) return;
          void queryClient.invalidateQueries({ queryKey: ['match-center-chat'] });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatSince, chatUntil, leagueIds, mode, queryClient]);

  // Tick until the *last* kickoff so late XIs unlock without leaving Match Center.
  // (Previously stopped at the first KO, which froze later Saturday 15:00 line-ups.)
  // Every second only while the countdown card is showing; otherwise every 30s, which is
  // plenty for XIs to unlock. Each tick rebuilds the whole feed.
  const [clockMs, setClockMs] = React.useState(() => Date.now());
  const countdownShowing = React.useRef(false);
  React.useEffect(() => {
    if (mode !== 'live') return;
    const last = lastKickoffMs(board?.fixtures ?? []);
    setClockMs(Date.now());
    if (last == null || Date.now() >= last) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      timer = setTimeout(
        () => {
          setClockMs(Date.now());
          tick();
        },
        countdownShowing.current ? 1000 : 30_000
      );
    };
    tick();
    return () => clearTimeout(timer);
  }, [board?.fixtures, mode]);
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setClockMs(Date.now());
    });
    return () => sub.remove();
  }, []);

  // Pinned card on the Game Centre home: where you are in the gameweek, from `home` (your
  // gameweek, not the board). It follows submitting and moving on through the snapshot.
  const pin = menu && mode === 'live' ? gameweekPin(home, clockMs) : null;
  const [pinnedHeight, setPinnedHeight] = React.useState(0);
  // Moving on plays the Predictions page's full-screen GAMEWEEK transition.
  const advanceTransition = useGameweekAdvanceTransition({ totalMs: 1050 });
  const startAdvance = advanceTransition.start;
  // Dismissed states stay hidden on this device for that gameweek and state.
  const pinKey = pin && userId ? pinDismissKey(userId, pin) : null;
  const [pinDismissal, setPinDismissal] = React.useState<{ key: string; dismissed: boolean } | null>(null);
  React.useEffect(() => {
    if (!pinKey) return;
    let alive = true;
    AsyncStorage.getItem(pinKey)
      .then((value) => alive && setPinDismissal({ key: pinKey, dismissed: value === '1' }))
      .catch(() => alive && setPinDismissal({ key: pinKey, dismissed: false }));
    return () => {
      alive = false;
    };
  }, [pinKey]);
  // A dismissible card waits until we know it wasn't dismissed, so it never flashes up.
  const showPin = !!pin && (!pinDismissible(pin) || (pinDismissal?.key === pinKey && !pinDismissal.dismissed));
  const onPinDismiss = React.useCallback(
    (current: GameweekPin) => {
      if (!userId) return;
      const key = pinDismissKey(userId, current);
      setPinDismissal({ key, dismissed: true });
      void AsyncStorage.setItem(key, '1').catch(() => {});
    },
    [userId]
  );
  const onPinAction = React.useCallback(
    (action: PinnedCardAction, current: GameweekPin) => {
      if (action === 'predict') {
        navigation.navigate('PredictionsFlow');
        return;
      }
      if (action === 'roundUp') {
        openManualRoundUpStack(current.gw, { includeResults: !!home?.hasSubmittedViewingGw });
        return;
      }
      if (current.kind !== 'ready') return;
      // Same as "Ready to move on?" on the Predictions page: the GAMEWEEK transition plays while
      // the new gameweek is saved and the snapshot refreshes.
      startAdvance({
        nextGameweekLabel: `GAMEWEEK ${current.nextGw}`,
        onAdvance: async () => {
          try {
            await api.updateNotificationPrefs({ current_viewing_gw: current.nextGw });
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] }),
              queryClient.invalidateQueries({ queryKey: ['homeRanks'] }),
              queryClient.invalidateQueries({ queryKey: ['leagues'] }),
            ]);
          } catch (error) {
            console.error('[MatchCenter] move on failed:', error);
            Alert.alert('Could not move on', 'Please try again.');
          }
        },
      });
    },
    [home?.hasSubmittedViewingGw, navigation, openManualRoundUpStack, queryClient, startAdvance]
  );

  const lineupArrivalMs = React.useRef(new Map<number, number>());
  const lineupArrivalGw = React.useRef<number | null>(null);
  if (typeof gw === 'number' && lineupArrivalGw.current !== gw) {
    lineupArrivalGw.current = gw;
    lineupArrivalMs.current = new Map();
  }

  const seenIds = React.useRef<Set<string> | null>(null);
  const seenMode = React.useRef(mode);
  const seenGw = React.useRef<number | null>(typeof gw === 'number' ? gw : null);
  if (seenMode.current !== mode || seenGw.current !== gw) {
    seenMode.current = mode;
    seenGw.current = typeof gw === 'number' ? gw : null;
    seenIds.current = null;
  }

  const freshFeed = React.useMemo(() => {
    if (mode === 'sample' || mode === 'play') {
      const script = sampleFeed();
      const shown = mode === 'play' ? script.slice(0, played) : script;
      return [...shown, ...localReplies];
    }
    if (!board || typeof gw !== 'number') return [];
    const picks = board.userPicks as Record<string, Pick>;
    const match = buildMatchFeed({
      gw,
      fixtures: board.fixtures,
      liveByFixtureIndex,
      liveByApiMatchId,
      picks,
      percents: pickPercents,
      teamForms,
      teamPositions,
      nowMs: clockMs,
      userId,
      leagues: replayOn ? leaguePicks : [],
      overall: overallReplay ? { ...overallReplay, userAvatar: profileSummary?.avatar_url ?? null } : null,
      lineupArrivalMs: lineupArrivalMs.current,
      posts: feedPosts,
      // After the first painted live feed, new XIs sort by wall clock at the live end.
      sessionLive: seenIds.current !== null,
    });
    const roundUp =
      allFinished && userId
        ? buildRoundUp({
            leagues: leagueTables ?? [],
            userId,
            userAvatar: profileSummary?.avatar_url ?? null,
            overallBefore: gwResults?.leaderboardChanges.overall.before ?? null,
            overallAfter: gwResults?.leaderboardChanges.overall.after ?? null,
          })
        : [];
    // Mini-league move cards only — no "this gameweek / overall" flash cards.
    const extra = replayOn ? [] : rankCards.filter((card) => card.kind === 'rank');
    const placeChat = (item: FeedItem): FeedItem => ({
      ...item,
      sortAt: alignChatSortAtMs({
        createdAtMs: item.sortAt,
        fixtures: board.fixtures,
        liveByFixtureIndex,
        liveByApiMatchId,
        nowMs: clockMs,
      }),
    });
    const serverChat = (chatItems ?? []).map(placeChat);
    const pendingLocal = localReplies
      .filter((local) => {
        const body = local.body.trim();
        return body.length > 0 && !serverChat.some((row) => row.mine && row.body.trim() === body);
      })
      .map(placeChat);
    const kindRank = (kind: FeedItem['kind']): number => {
      if (kind === 'half-time') return 10;
      if (kind === 'second-half') return 20;
      if (kind === 'goal' || kind === 'ruled-out') return 30;
      if (kind === 'rank') return 40;
      if (kind === 'message') return 50;
      return 35;
    };
    return [...match, ...extra, ...roundUp, ...serverChat, ...pendingLocal].sort(
      (a, b) => a.sortAt - b.sortAt || kindRank(a.kind) - kindRank(b.kind) || a.id.localeCompare(b.id)
    );
  }, [allFinished, board, chatItems, clockMs, feedPosts, gw, gwResults, leaguePicks, leagueTables, liveByApiMatchId, liveByFixtureIndex, localReplies, mode, overallReplay, pickPercents, played, profileSummary?.avatar_url, rankCards, replayOn, teamForms, teamPositions, userId]);

  // The feed is rebuilt whenever scores, chat or tables refresh, which makes every card a
  // new object. Keep the previous object for any card whose content is the same, so the
  // memoised cards only redraw when they actually change.
  const previousCards = React.useRef(new Map<string, { item: FeedItem; json: string }>());
  const previousFeed = React.useRef<FeedItem[]>([]);
  const feed = React.useMemo(() => {
    const next = new Map<string, { item: FeedItem; json: string }>();
    const items = freshFeed.map((item) => {
      const json = JSON.stringify(item);
      const before = previousCards.current.get(item.id);
      const kept = before && before.json === json ? before.item : item;
      next.set(item.id, { item: kept, json });
      return kept;
    });
    previousCards.current = next;
    const last = previousFeed.current;
    if (last.length === items.length && items.every((item, index) => item === last[index])) return last;
    previousFeed.current = items;
    return items;
  }, [freshFeed]);

  const [scoresReady, setScoresReady] = React.useState(false);
  React.useEffect(() => {
    setScoresReady(false);
  }, [gw]);
  React.useEffect(() => {
    if (mode !== 'live' || typeof gw !== 'number') return;
    if (liveScoresError) {
      setScoresReady(true);
      return;
    }
    const matchIds = (board?.fixtures ?? [])
      .map((fixture) => Number(fixture.api_match_id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (matchIds.length === 0) {
      if (board && !liveScoresLoading) setScoresReady(true);
      return;
    }
    // Pre-match: fixtures exist but live_scores is still empty. Once the fetch
    // finishes, stop blocking on scores so the coming-soon card can show.
    if (matchIds.some((id) => liveByApiMatchId.has(id)) || !liveScoresLoading) {
      setScoresReady(true);
    }
  }, [board, gw, liveByApiMatchId, liveScoresError, liveScoresLoading, mode]);

  const positionsEnabled = typeof gw === 'number' && Object.keys(predictedPositions).length < 20;
  const tablesEnabled = mode === 'live' && typeof gw === 'number' && leagueIds.length > 0;
  const picksEnabled =
    mode === 'live' && typeof gw === 'number' && memberIds.length > 0 && (!useSeasonStack || !!seasonId);
  const percentsEnabled = mode === 'live' && typeof gw === 'number' && (!useSeasonStack || !!seasonId);
  const overallEnabled = mode === 'live' && typeof gw === 'number' && !!userId && (!useSeasonStack || !!seasonId);
  const resultsEnabled = mode === 'live' && allFinished && typeof gw === 'number';
  const chatEnabled = mode === 'live' && (leaguesData?.leagues.length ?? 0) > 0 && !!chatSince;
  const stillFetching = (enabled: boolean, fetched: boolean) => enabled && !fetched;
  // Before the first teams are out, the feed is only the coming-soon card —
  // don't hold the spinner for leagues, chat, tables, and the rest.
  const preMatchHold = feed.length === 1 && feed[0]?.kind === 'waiting';
  if (countdownShowing.current !== preMatchHold) {
    countdownShowing.current = preMatchHold;
    // Switch to the one-second tick straight away when the countdown appears.
    if (preMatchHold) setTimeout(() => setClockMs(Date.now()), 0);
  }
  // Niceties (overall replay, ML tables, chat…) can hang on a flaky network and
  // used to trap "Preparing the Match Center" forever. Essentials = board + scores.
  const extrasPending =
    !preMatchHold &&
    (stillFetching(typeof gw === 'number', predictionsFetched) ||
      stillFetching(positionsEnabled, positionsFetched) ||
      stillFetching(true, leaguesFetched) ||
      stillFetching(tablesEnabled, tablesFetched) ||
      stillFetching(picksEnabled, picksFetched) ||
      stillFetching(percentsEnabled, percentsFetched) ||
      stillFetching(overallEnabled, overallFetched) ||
      stillFetching(resultsEnabled, resultsFetched) ||
      stillFetching(chatEnabled, chatFetched));
  const [allowPartialFeed, setAllowPartialFeed] = React.useState(false);
  React.useEffect(() => {
    setAllowPartialFeed(false);
    if (mode !== 'live' || boardLoading || !scoresReady || boardError || !extrasPending) return;
    const id = setTimeout(() => setAllowPartialFeed(true), 6_000);
    return () => clearTimeout(id);
  }, [boardError, boardLoading, extrasPending, gw, mode, scoresReady]);
  const prepping =
    mode === 'live' &&
    !boardError &&
    (boardLoading || !scoresReady || (extrasPending && !allowPartialFeed));

  if (mode === 'live' && !prepping && seenIds.current === null) {
    seenIds.current = new Set(feed.map((item) => item.id));
  }
  const celebrateIds = React.useMemo(() => {
    const celebrate = new Set<string>();
    if (mode === 'play') {
      const scripted = feed.filter((entry) => !entry.id.startsWith('chat:local'));
      const latest = scripted[scripted.length - 1];
      if (latest) celebrate.add(latest.id);
      feed.forEach((entry) => {
        if (entry.id.startsWith('chat:local')) celebrate.add(entry.id);
      });
      return celebrate;
    }
    if (mode === 'live' && prepping) return celebrate;
    const known = seenIds.current;
    if (!known) return celebrate;
    feed.forEach((item) => {
      if (!known.has(item.id)) celebrate.add(item.id);
    });
    return celebrate;
  }, [feed, mode, prepping]);

  React.useEffect(() => {
    if (!feed.length || (mode === 'live' && prepping)) return;
    seenIds.current = new Set(feed.map((item) => item.id));
  }, [feed, mode, prepping]);

  React.useEffect(() => {
    setLocalReplies([]);
    setReplyId(null);
    setReplyDraft('');
    setReactId(null);
    setLocalReactions({});
  }, [gw, mode, playRun]);

  // Drop optimistic bubbles once the server copy lands. Don't require replyTo to
  // match — the join can briefly return null and that used to leave a duplicate.
  React.useEffect(() => {
    if (!chatItems?.length) return;
    setLocalReplies((current) =>
      current.filter((local) => {
        const body = local.body.trim();
        if (!body) return false;
        return !chatItems.some((row) => row.mine && row.body.trim() === body);
      })
    );
  }, [chatItems]);

  const { optimisticallyClear } = useLeagueUnreadCounts();

  // Messages shown in Match Center count as read — clear the header chat badge
  // for those leagues (same receipts table as opening the league chat).
  React.useEffect(() => {
    if (mode !== 'live' || !userId || !chatItems?.length) return;
    const leagueIds = new Set<string>();
    for (const item of chatItems) {
      const leagueId = item.link?.leagueId;
      if (!leagueId || item.id.startsWith('chat:local')) continue;
      leagueIds.add(leagueId);
    }
    if (!leagueIds.size) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      // Use "now" (same as opening league chat) so we never rewind last_read_at.
      const lastReadAt = new Date().toISOString();
      leagueIds.forEach((leagueId) => {
        optimisticallyClear(leagueId);
        void supabase.from('league_message_reads').upsert(
          { league_id: leagueId, user_id: userId, last_read_at: lastReadAt },
          { onConflict: 'league_id,user_id' }
        );
      });
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chatItems, mode, optimisticallyClear, userId]);

  const chatRecordIds = React.useMemo(
    () => (chatItems ?? []).map((item) => chatRecordId(item.id)).filter((id): id is string => id != null),
    [chatItems]
  );
  const { reactions, toggleReaction } = useLeagueChatReactions({
    leagueId: mode === 'live' && chatRecordIds.length > 0 ? 'match-center' : null,
    messageIds: chatRecordIds,
    userId,
    enabled: mode === 'live' && !!userId,
  });

  const cardReactionIds = React.useMemo(() => {
    if (typeof gw !== 'number') return [] as string[];
    return feed
      .filter((item) => gameCentreCardType(item.kind) === 'public')
      .map((item) => matchCenterReactionCardId(gw, item.id));
  }, [feed, gw]);

  // Cards built from stored posts have permanent ids, so they can carry comments and any emoji.
  const social = !!feedPosts && mode === 'live' && typeof gw === 'number';
  const { reactions: cardReactions, toggleReaction: toggleCardReaction } = useMatchCenterCardReactions({
    cardIds: cardReactionIds,
    userId,
    enabled: mode === 'live' && !!userId && typeof gw === 'number' && !social,
  });
  const { reactions: socialReactions, toggleReaction: toggleSocialReaction } = useGameCentreReactions({
    cardIds: cardReactionIds,
    userId,
    enabled: social,
  });
  // Comments live on one thread per match, so every card for it shows the same count.
  const cardCommentIds = React.useMemo(() => {
    if (typeof gw !== 'number') return [] as string[];
    return feed
      .filter((item) => gameCentreCardType(item.kind) === 'public')
      .map((item) => fixtureEngagementId(gw, item.id));
  }, [feed, gw]);
  const commentCounts = useCardCommentCounts(cardCommentIds, social);
  const [pickerFor, setPickerFor] = React.useState<FeedItem | null>(null);

  const toggleReply = React.useCallback((item: FeedItem) => {
    setReplyId((current) => (current === item.id ? null : item.id));
    setReplyDraft('');
    setReactId(null);
  }, []);

  const toggleReact = React.useCallback((item: FeedItem) => {
    setReactId((current) => (current === item.id ? null : item.id));
    setReplyId(null);
    setReplyDraft('');
  }, []);

  const reactToMessage = React.useCallback(
    (item: FeedItem, emoji: string) => {
      const recordId = chatRecordId(item.id);
      if (mode === 'live' && recordId && userId) {
        void toggleReaction(recordId, emoji);
      } else {
        setLocalReactions((current) => ({
          ...current,
          [item.id]: toggleReactionList(current[item.id], emoji),
        }));
      }
      // Collapse the emoji tray after a choice (same as tapping “React” closed).
      setReactId(null);
    },
    [mode, toggleReaction, userId]
  );

  const reactToCard = React.useCallback(
    (item: FeedItem, emoji: string) => {
      if (gameCentreCardType(item.kind) !== 'public') return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (social && userId && typeof gw === 'number') {
        void toggleSocialReaction(matchCenterReactionCardId(gw, item.id), emoji);
        return;
      }
      if (mode === 'live' && userId && typeof gw === 'number') {
        void toggleCardReaction(matchCenterReactionCardId(gw, item.id), emoji);
        return;
      }
      setLocalReactions((current) => ({
        ...current,
        [item.id]: applySingleCardReaction(current[item.id], emoji),
      }));
    },
    [gw, mode, social, toggleCardReaction, toggleSocialReaction, userId]
  );

  const commentOnCard = React.useCallback(
    async (item: FeedItem, text: string) => {
      if (!social || !userId || typeof gw !== 'number') return false;
      try {
        const threadId = fixtureEngagementId(gw, item.id);
        await postCardComment({ cardId: threadId, userId, content: text });
        void queryClient.invalidateQueries({ queryKey: ['game-centre-comment-counts'] });
        void queryClient.invalidateQueries({ queryKey: ['game-centre-comments', threadId] });
        return true;
      } catch (error) {
        console.error('[MatchCenter] comment failed:', error);
        Alert.alert('Comment not sent', 'Please try again.');
        return false;
      }
    },
    [gw, queryClient, social, userId]
  );

  const openCardComments = React.useCallback(
    (item: FeedItem) => {
      if (!social || typeof gw !== 'number') return;
      const idx = fixtureIndexOfCard(item.id);
      const fixture = idx == null ? undefined : board?.fixtures?.find((entry) => entry.fixture_index === idx);
      if (fixture) {
        const sides = fixtureSides(fixture);
        navigation.navigate('CardComments', {
          cardId: fixtureEngagementId(gw, item.id),
          title: `${sides.home.name} vs ${sides.away.name}`,
          match: {
            gw,
            fixtureIndex: fixture.fixture_index,
            apiMatchId: fixture.api_match_id ?? null,
            kickoffTime: fixture.kickoff_time ?? null,
            ...sides,
          },
        });
        return;
      }
      const header = gameCentreCardHeader(item);
      navigation.navigate('CardComments', {
        cardId: fixtureEngagementId(gw, item.id),
        title: header.title,
        subtitle: header.subtitle,
      });
    },
    [board?.fixtures, gw, navigation, social]
  );

  const sendReply = React.useCallback(
    async (item: FeedItem) => {
      const text = replyDraft.trim();
      if (!text || sendingReply) return;
      setSendingReply(true);
      const optimistic = chatMessageItem({
        id: `local-${Date.now()}`,
        at: new Date().toISOString(),
        leagueId: item.link?.leagueId ?? 'play',
        leagueName: item.eyebrow,
        author: 'You',
        body: text,
        mine: true,
        replyTo: item.body,
        authorAvatar: profileSummary?.avatar_url ?? item.authorAvatar ?? null,
        leagueAvatar: item.leagueAvatar ?? null,
      });
      setLocalReplies((current) => [...current, optimistic]);
      setReplyDraft('');
      setReplyId(null);
      const realId = item.id.startsWith('chat:') ? item.id.slice(5) : '';
      const leagueId = item.link?.leagueId;
      const canSave = mode === 'live' && !!userId && !!leagueId && !!realId && !realId.startsWith('local');
      if (canSave) {
        const { error } = await supabase.from('league_messages').insert({
          league_id: leagueId,
          user_id: userId,
          content: text,
          reply_to_message_id: realId,
        });
        if (!error) await queryClient.invalidateQueries({ queryKey: ['match-center-chat'] });
      }
      setSendingReply(false);
    },
    [mode, profileSummary?.avatar_url, queryClient, replyDraft, sendingReply, userId]
  );

  // The same functions for every card on every render; each calls the latest version.
  const latestHandlers = React.useRef({ toggleReply, toggleReact, reactToMessage, reactToCard, sendReply, commentOnCard, openCardComments });
  latestHandlers.current = { toggleReply, toggleReact, reactToMessage, reactToCard, sendReply, commentOnCard, openCardComments };
  const cardHandlers = React.useMemo(
    () => ({
      toggleReply: (item: FeedItem) => latestHandlers.current.toggleReply(item),
      toggleReact: (item: FeedItem) => latestHandlers.current.toggleReact(item),
      reactToMessage: (item: FeedItem, emoji: string) => latestHandlers.current.reactToMessage(item, emoji),
      reactToCard: (item: FeedItem, emoji: string) => latestHandlers.current.reactToCard(item, emoji),
      sendReply: (item: FeedItem) => void latestHandlers.current.sendReply(item),
      openPicker: (item: FeedItem) => setPickerFor(item),
      commentOnCard: (item: FeedItem, text: string) => latestHandlers.current.commentOnCard(item, text),
      openCardComments: (item: FeedItem) => latestHandlers.current.openCardComments(item),
    }),
    []
  );

  const revealedLiveGw = React.useRef<number | null>(null);
  const pinToEnd = React.useRef(false);
  const pinRelease = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const atBottom = React.useRef(true);
  const seenFeedLength = React.useRef(0);
  const [newUpdates, setNewUpdates] = React.useState(false);
  if (mode === 'live' && !prepping && typeof gw === 'number' && revealedLiveGw.current !== gw) {
    pinToEnd.current = true;
    atBottom.current = true;
  }
  const showLatest = React.useCallback(
    (animated: boolean) => {
      if (newestFirst) scrollRef.current?.scrollToOffset({ offset: 0, animated });
      else scrollRef.current?.scrollToEnd({ animated });
    },
    [newestFirst]
  );
  const holdLastCard = React.useCallback(() => {
    if (!pinToEnd.current) return;
    showLatest(false);
    if (pinRelease.current) clearTimeout(pinRelease.current);
    pinRelease.current = setTimeout(() => {
      pinToEnd.current = false;
    }, 700);
  }, [showLatest]);
  React.useEffect(() => {
    if (mode !== 'live') {
      revealedLiveGw.current = null;
      pinToEnd.current = false;
      return;
    }
    if (prepping || typeof gw !== 'number' || revealedLiveGw.current === gw) return;
    revealedLiveGw.current = gw;
    setNewUpdates(false);
    holdLastCard();
  }, [gw, holdLastCard, mode, prepping]);
  // Newest first: a new card lands above the one being read, which stays put
  // (maintainVisibleContentPosition), and the New Updates pill offers a way up.
  const seenNewestId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!newestFirst || prepping) return;
    const newest = feed[feed.length - 1]?.id ?? null;
    const previous = seenNewestId.current;
    seenNewestId.current = newest;
    if (pinToEnd.current || previous == null || newest == null || newest === previous) return;
    if (!atBottom.current) setNewUpdates(true);
  }, [feed, newestFirst, prepping]);
  React.useEffect(() => {
    if (newestFirst || prepping) return;
    if (feed.length === seenFeedLength.current) return;
    const grew = feed.length > seenFeedLength.current;
    seenFeedLength.current = feed.length;
    if (!grew) return;
    if (pinToEnd.current || atBottom.current) {
      if (!pinToEnd.current) scrollRef.current?.scrollToEnd({ animated: mode !== 'live' });
      return;
    }
    setNewUpdates(true);
  }, [feed.length, mode, newestFirst, prepping]);

  const onFeedScroll = React.useCallback((event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    // "At the latest" is the top of the feed when newest is first, the bottom otherwise.
    const nearLatest = newestFirst
      ? contentOffset.y < 8
      : contentSize.height - layoutMeasurement.height - contentOffset.y < 120;
    atBottom.current = nearLatest;
    if (nearLatest) setNewUpdates(false);
  }, [newestFirst]);

  const jumpToLatest = React.useCallback(() => {
    atBottom.current = true;
    setNewUpdates(false);
    showLatest(true);
  }, [showLatest]);

  const [pullRefreshing, setPullRefreshing] = React.useState(false);
  const onPullRefresh = React.useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.race([
        queryClient.refetchQueries({
          type: 'active',
          predicate: (query) => {
            const head = String(query.queryKey[0] ?? '');
            return head.startsWith('match-center') || head === 'homeSnapshot' || head === 'gwResults' || head === 'leagues';
          },
        }),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [queryClient]);

  const openItem = React.useCallback(
    (item: FeedItem) => {
      const link = item.link;
      if (!link) return;
      if (link.to === 'home') {
        navigation.navigate('Tabs', { screen: 'Predictions', params: { screen: 'HomeMain' } });
        return;
      }
      if (link.to === 'overall') {
        navigation.navigate('Tabs', { screen: 'Global' });
        return;
      }
      if (link.to === 'chat' && link.leagueId && link.leagueName) {
        // The Mini League's own chat, as the chat hub and push notifications open it.
        navigation.navigate('Chat2Thread', { leagueId: link.leagueId, name: link.leagueName });
        return;
      }
      if (link.leagueId && link.leagueName) {
        navigation.navigate('LeagueDetail', { leagueId: link.leagueId, name: link.leagueName, initialTab: 'gwTable' });
      }
    },
    [navigation]
  );

  const gwState = board
    ? getGameweekStateFromSnapshot({
        fixtures: board.fixtures,
        liveScores: Array.from(liveByFixtureIndex.values()),
        hasSubmittedViewingGw: board.hasSubmittedViewingGw,
      })
    : null;
  const scoreSummary = React.useMemo(() => {
    if (!board) return null;
    const results = new Map<number, Pick>();
    board.gwResults.forEach((row) => results.set(row.fixture_index, row.result));
    return buildHeaderScoreSummary({
      fixtures: board.fixtures,
      userPicks: board.userPicks,
      liveByFixtureIndex,
      resultByFixtureIndex: results,
    });
  }, [board, liveByFixtureIndex]);
  const { tickerEvent, tickerEventKey } = React.useMemo(
    () => buildHeaderTickerEvent({ fixtures: board?.fixtures ?? [], liveByFixtureIndex }),
    [board?.fixtures, liveByFixtureIndex]
  );
  const { data: homeRanks } = useQuery({
    queryKey: ['homeRanks'],
    queryFn: () => api.getHomeRanks(),
    staleTime: 30_000,
  });
  const showLiveHeaderScore = gwState === 'LIVE' && !!scoreSummary;
  // On the Game Centre home the score and ticker are for live games only; once the gameweek
  // is over, the pinned card carries last week's score.
  const showStaticResultsHeaderScore = !menu && gwState === 'RESULTS_PRE_GW' && !!scoreSummary;
  const showTicker = !menu || gwState === 'LIVE';
  const headerScoreLabel = scoreSummary ? formatHeaderScoreLabel(scoreSummary, showLiveHeaderScore) : null;
  const liveGwRank = userId ? rankOf(liveTable?.rows ?? [], userId) : null;
  const headerExpandedStats = React.useMemo(
    () =>
      buildHeaderExpandedStats({
        gwRank: viewingLast || showLiveHeaderScore ? liveGwRank : homeRanks?.gwRank?.rank ?? null,
        gwTotal: viewingLast || showLiveHeaderScore ? liveTable?.rows?.length ?? null : homeRanks?.gwRank?.total ?? null,
      }),
    [homeRanks?.gwRank?.rank, homeRanks?.gwRank?.total, liveGwRank, liveTable?.rows?.length, showLiveHeaderScore, viewingLast]
  );
  const headerPill =
    headerScoreLabel && (showLiveHeaderScore || showStaticResultsHeaderScore) ? (
      <HeaderLiveScore
        scoreLabel={headerScoreLabel}
        fill
        live={showLiveHeaderScore}
        tickerEvent={showLiveHeaderScore ? tickerEvent ?? undefined : undefined}
        tickerEventKey={showLiveHeaderScore ? tickerEventKey : undefined}
        expandedStats={headerExpandedStats}
        onSharePress={typeof gw === 'number' ? () => openManualResultsScoreSheetShare(gw) : undefined}
      />
    ) : undefined;

  const tickerFixtures = React.useMemo(
    () => buildTickerFixtures(board?.fixtures ?? [], liveByFixtureIndex, liveByApiMatchId, (board?.userPicks ?? {}) as Record<string, Pick | undefined>),
    [board?.fixtures, board?.userPicks, liveByApiMatchId, liveByFixtureIndex]
  );

  // ML + Overall/Monthly/GW ranks only join the ticker once the first game has kicked off.
  const firstKoMs = firstKickoffMs(fixtures);
  const rankingsOnTicker = firstKoMs != null && clockMs >= firstKoMs;

  // Previous-GW ranks for ticker "move" arrows — rarely change once the previous GW is closed.
  // A plain object, not a Map: query results are saved to the phone as JSON, which turns a Map
  // into {} and crashed Match Center on the next launch.
  const { data: tickerPrevLeagueRanks } = useQuery({
    enabled: rankingsOnTicker && typeof gw === 'number' && gw > 1 && !!userId && leagueIds.length > 0,
    queryKey: ['match-center-ticker-prev-leagues', gw, leagueIds, userId],
    staleTime: MC_HEAVY_STALE_MS,
    queryFn: async (): Promise<Record<string, number>> => {
      const previousGw = (gw as number) - 1;
      const out: Record<string, number> = {};
      await Promise.all(
        (leaguesData?.leagues ?? []).map(async (league) => {
          try {
            const previous = await api.getLeagueGwTable(league.id, previousGw);
            const before = userId ? tickerTableRank(previous.rows, userId) : null;
            if (before) out[league.id] = before;
          } catch {
            /* ignore */
          }
        })
      );
      return out;
    },
  });

  const tickerLeagues = React.useMemo((): TickerLeague[] => {
    if (!rankingsOnTicker || !userId || !leagueTables?.length) return [];
    return leagueTables.flatMap((league) => {
      const rank = tickerTableRank(league.rows, userId);
      if (!rank) return [];
      const saved = tickerPrevLeagueRanks?.[league.id];
      const before = typeof saved === 'number' ? saved : null;
      return [
        {
          id: league.id,
          name: league.name,
          avatarUri: league.avatarUrl ?? resolveLeagueAvatarUri(getDefaultMlAvatarFilename(league.id)),
          rank,
          move: tickerMove(before, rank),
        } satisfies TickerLeague,
      ];
    });
  }, [leagueTables, rankingsOnTicker, tickerPrevLeagueRanks, userId]);

  // Season points baseline for overall/monthly ticker — once per session window, not every tick.
  const { data: tickerPointsBaseline } = useQuery({
    enabled: rankingsOnTicker && typeof gw === 'number' && !!userId && (!useSeasonStack || !!seasonId),
    queryKey: ['match-center-ticker-points', useSeasonStack ? seasonId : 'legacy'],
    staleTime: MC_HEAVY_STALE_MS,
    queryFn: async () => {
      const pileB = useSeasonStack && !!seasonId;
      const pointsTable = pileB ? SEASON_PILE_TABLES.gwPoints : LEGACY_PILE_TABLES.gwPoints;
      return fetchAllSupabaseRows<{ user_id: string; gw: number; points: number }>((from, to) => {
        let query = (supabase as any)
          .from(pointsTable)
          .select('user_id, gw, points')
          .order('gw', { ascending: true })
          .order('user_id', { ascending: true })
          .range(from, to);
        if (pileB) query = query.eq('season_id', seasonId);
        return query;
      }).catch(() => [] as Array<{ user_id: string; gw: number; points: number }>);
    },
  });

  const { data: tickerBoards } = useQuery({
    enabled: rankingsOnTicker && typeof gw === 'number' && !!userId && (!useSeasonStack || !!seasonId),
    queryKey: ['match-center-ticker-boards', gw, userId, useSeasonStack ? seasonId : 'legacy', seasonLabel],
    staleTime: MC_TICKER_MS,
    refetchInterval: MC_TICKER_MS,
    queryFn: async (): Promise<TickerBoard[]> => {
      const currentGw = gw as number;
      const seasonKey: LeaderboardSeasonKey = seasonLabel === SEASON_2026_27_LABEL ? '2026/27' : '2025/26';
      const month = getMonthForGw(currentGw, seasonKey);
      const [currentLive, previousLive, points] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['match-center-gw-live', currentGw],
          queryFn: () => api.getGlobalGwLiveTable(currentGw),
          staleTime: MC_LIVE_BOARD_MS,
        }).catch(() => ({ gw: currentGw, rows: [] as Array<{ user_id: string; name: string; score: number }> })),
        currentGw > 1
          ? queryClient.fetchQuery({
              queryKey: ['match-center-gw-live', currentGw - 1],
              queryFn: () => api.getGlobalGwLiveTable(currentGw - 1),
              staleTime: MC_HEAVY_STALE_MS,
            }).catch(() => null)
          : Promise.resolve(null),
        Promise.resolve(
          tickerPointsBaseline ??
            (await queryClient.fetchQuery({
              queryKey: ['match-center-ticker-points', useSeasonStack ? seasonId : 'legacy'],
              queryFn: async () => {
                const pileB = useSeasonStack && !!seasonId;
                const pointsTable = pileB ? SEASON_PILE_TABLES.gwPoints : LEGACY_PILE_TABLES.gwPoints;
                return fetchAllSupabaseRows<{ user_id: string; gw: number; points: number }>((from, to) => {
                  let query = (supabase as any)
                    .from(pointsTable)
                    .select('user_id, gw, points')
                    .order('gw', { ascending: true })
                    .order('user_id', { ascending: true })
                    .range(from, to);
                  if (pileB) query = query.eq('season_id', seasonId);
                  return query;
                }).catch(() => [] as Array<{ user_id: string; gw: number; points: number }>);
              },
              staleTime: MC_HEAVY_STALE_MS,
            }))
        ),
      ]);

      const byUser = new Map<string, Map<number, number>>();
      points.forEach((row) => {
        const id = String(row.user_id ?? '');
        const week = Number(row.gw);
        if (!id || !Number.isFinite(week)) return;
        const bag = byUser.get(id) ?? new Map<number, number>();
        bag.set(week, Number(row.points ?? 0));
        byUser.set(id, bag);
      });
      currentLive.rows.forEach((row) => {
        const bag = byUser.get(row.user_id) ?? new Map<number, number>();
        bag.set(currentGw, row.score);
        byUser.set(row.user_id, bag);
      });

      const rankWindow = (fromGw: number, toGw: number): { rank: number | null; hasBaseline: boolean } => {
        const scores = [...byUser.entries()].map(([id, bag]) => {
          let score = 0;
          bag.forEach((pts, week) => {
            if (week >= fromGw && week <= toGw) score += pts;
          });
          return { user_id: id, score };
        });
        const prior = [...byUser.values()].some((bag) => {
          let score = 0;
          bag.forEach((pts, week) => {
            if (week >= fromGw && week < currentGw) score += pts;
          });
          return score > 0;
        });
        return { rank: userId ? rankOf(scores, userId) : null, hasBaseline: prior };
      };

      const overall = rankWindow(1, currentGw);
      const overallBefore = overall.hasBaseline && userId ? rankWindow(1, currentGw - 1).rank : null;
      const monthly = month ? rankWindow(month.startGw, Math.min(currentGw, month.endGw)) : { rank: null, hasBaseline: false };
      const monthlyBefore = month && monthly.hasBaseline && userId ? rankWindow(month.startGw, currentGw - 1).rank : null;
      const gwRank = userId ? rankOf(currentLive.rows, userId) : null;
      const gwBefore = previousLive && userId ? rankOf(previousLive.rows, userId) : null;

      return [
        { key: 'overall', label: 'Overall', rank: overall.rank, move: tickerMove(overallBefore, overall.rank) },
        { key: 'monthly', label: 'Monthly', rank: monthly.rank, move: tickerMove(monthlyBefore, monthly.rank) },
        { key: 'gw', label: 'GW', rank: gwRank, move: tickerMove(gwBefore, gwRank) },
      ];
    },
  });

  const waiting = feed.length === 1 && feed[0]?.kind === 'waiting';
  const firstKo = firstKoMs;
  const hasLiveGames = fixtures.some((fixture) => {
    const status = liveByFixtureIndex.get(fixture.fixture_index)?.status;
    return status === 'IN_PLAY' || status === 'PAUSED';
  });

  // Only the cards near the screen are drawn; a gameweek's feed runs past 100 cards, and
  // drawing them all at once held up every tap for seconds.
  const shownFeed = React.useMemo(() => (newestFirst ? [...feed].reverse() : feed), [feed, newestFirst]);
  const renderFeedItem = ({ item, index: shownIndex }: { item: FeedItem; index: number }) => {
    // Pairing with the card before it in time, whichever way the feed reads.
    const index = newestFirst ? feed.length - 1 - shownIndex : shownIndex;
    const previous = feed[index - 1];
    const celebratedWithPrevious =
      previous != null && celebrateIds.has(item.id) && celebrateIds.has(previous.id);
    const arriveDelay =
      celebratedWithPrevious &&
      ((item.kind === 'rank' && previous.kind === 'goal') ||
        (item.kind === 'message' && (previous.kind === 'goal' || previous.kind === 'rank')) ||
        (item.kind === 'xi' && previous.kind === 'lineup'))
        ? 700
        : 0;
    if (item.kind === 'message') {
      return (
        <MessageRow
          item={item}
          onOpen={openItem}
          celebrate={celebrateIds.has(item.id)}
          arriveDelay={arriveDelay}
          replying={replyId === item.id}
          replyDraft={replyId === item.id ? replyDraft : ''}
          sendingReply={sendingReply}
          reacting={reactId === item.id}
          reactions={
            (chatRecordId(item.id) ? reactions[chatRecordId(item.id) as string] : null) ??
            localReactions[item.id] ??
            NO_REACTIONS
          }
          youAvatar={profileSummary?.avatar_url ?? null}
          onToggleReply={cardHandlers.toggleReply}
          onChangeReply={setReplyDraft}
          onSendReply={cardHandlers.sendReply}
          onToggleReact={cardHandlers.toggleReact}
          onReact={cardHandlers.reactToMessage}
        />
      );
    }
    const cardKey =
      typeof gw === 'number' && mode === 'live' ? matchCenterReactionCardId(gw, item.id) : item.id;
    const cardReactable = gameCentreCardType(item.kind) === 'public';
    return (
      <FeedCard
        item={item}
        onOpen={openItem}
        celebrate={celebrateIds.has(item.id)}
        arriveDelay={arriveDelay}
        reactions={
          cardReactable
            ? social
              ? socialReactions[cardKey] ?? NO_REACTIONS
              : mode === 'live'
                ? cardReactions[cardKey] ?? NO_REACTIONS
                : localReactions[item.id] ?? NO_REACTIONS
            : NO_REACTIONS
        }
        onReact={cardReactable ? cardHandlers.reactToCard : undefined}
        social={
          cardReactable && social
            ? {
                commentCount: typeof gw === 'number' ? commentCounts[fixtureEngagementId(gw, item.id)] ?? 0 : 0,
                onMore: cardHandlers.openPicker,
                onComment: cardHandlers.commentOnCard,
                onOpenComments: cardHandlers.openCardComments,
              }
            : null
        }
      />
    );
  };

  return (
    <GameweekAdvanceTransition controller={advanceTransition}>
    <Screen fullBleed>
      {menu ? (
        // New header (Figma 272:33554): menu on the left, chat on the right.
        <AppTopHeader
          onPressChat={() => navigation.navigate('ChatHub')}
          onPressProfile={() => navigation.navigate('Profile')}
          hasLiveGames={hasLiveGames}
          centerContent={headerPill ?? <View />}
          hideMatchCenterEntry
          hideProfile
          leftAction={<GameCentreMenuButton />}
        />
      ) : (
        <AppTopHeader
          onPressChat={() => navigation.navigate('ChatHub')}
          onPressProfile={() => {
            navigation.navigate('HomeMain');
            navigation.navigate('Profile');
          }}
          avatarUrl={profileSummary?.avatar_url}
          hasLiveGames={hasLiveGames}
          title="Match Center"
          centerContent={headerPill}
          hideMatchCenterEntry
        />
      )}
      {pin && showPin ? (
        <Reanimated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(180)}
          onLayout={(event) => setPinnedHeight(event.nativeEvent.layout.height)}
          style={{ paddingHorizontal: t.space[4], paddingTop: 8, paddingBottom: 12, zIndex: 2 }}
        >
          <GameCentrePinnedCard
            pin={pin}
            // Last gameweek's score, when the board is that gameweek.
            scoreLabel={board === home && scoreSummary ? formatHeaderScoreLabel(scoreSummary, false) : null}
            busy={advanceTransition.isAnimating}
            onAction={onPinAction}
            onDismiss={onPinDismiss}
          />
        </Reanimated.View>
      ) : null}
      <Reanimated.View style={{ flex: 1 }} layout={LinearTransition.duration(220)}>
      <FlatList
        ref={scrollRef}
        data={prepping ? [] : shownFeed}
        keyExtractor={(item) => (mode === 'play' ? `${playRun}-${item.id}` : item.id)}
        renderItem={renderFeedItem}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={9}
        onScroll={onFeedScroll}
        scrollEventThrottle={16}
        onContentSizeChange={holdLastCard}
        maintainVisibleContentPosition={newestFirst ? { minIndexForVisible: 0 } : undefined}
        refreshControl={
          newestFirst && mode === 'live' ? (
            <RefreshControl refreshing={pullRefreshing} onRefresh={() => void onPullRefresh()} tintColor={t.color.brand} colors={[t.color.brand]} />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: 8,
          paddingBottom: 88,
        }}
        ListHeaderComponent={
          <>
        {prepping ? (
          <View style={{ alignItems: 'center', paddingTop: 88, paddingHorizontal: 24 }}>
            <ActivityIndicator size="large" color={t.color.brand} />
            <TotlText
              style={{
                marginTop: 18,
                fontWeight: '800',
                fontSize: 18,
                lineHeight: 22,
                textAlign: 'center',
                color: t.color.text,
              }}
            >
              Preparing the Match Center
            </TotlText>
          </View>
        ) : (
          <>
        {mode === 'live' && boardLoading ? (
          <TotlText variant="muted">Loading the gameweek…</TotlText>
        ) : null}
        {mode === 'live' && boardError ? (
          <TotlText variant="muted" style={{ marginBottom: 12 }}>
            Couldn’t load this gameweek. Example is still here.
          </TotlText>
        ) : null}
        {mode === 'live' && !boardLoading && !waiting && feed.length === 0 ? (
          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 4 }}>Nothing on the feed yet</TotlText>
            <TotlText variant="muted">
              {viewingLast
                ? 'Last gameweek has no scores in the feed yet.'
                : firstKo && Date.now() < firstKo
                  ? 'Match Center starts at the first kickoff.'
                  : 'Scores show here once a game is underway.'}
            </TotlText>
          </Card>
        ) : null}
          </>
        )}
          </>
        }
      />
      </Reanimated.View>
      {newUpdates && !prepping ? (
        <NewUpdatesButton onPress={jumpToLatest} atTop={newestFirst} topOffset={showPin ? pinnedHeight : 0} />
      ) : null}
      {social ? (
        <EmojiPicker
          open={!!pickerFor}
          onClose={() => setPickerFor(null)}
          onEmojiSelected={(choice: { emoji: string }) => {
            if (pickerFor) reactToCard(pickerFor, choice.emoji);
          }}
          enableSearchBar
          enableRecentlyUsed
        />
      ) : null}
      {showTicker &&
      (tickerFixtures.length ||
        (rankingsOnTicker && (tickerLeagues?.length || tickerBoards?.some((board) => board.rank != null)))) ? (
        <FixtureTicker
          games={tickerFixtures}
          leagues={rankingsOnTicker ? tickerLeagues ?? [] : []}
          boards={rankingsOnTicker ? tickerBoards ?? [] : []}
        />
      ) : null}
    </Screen>
    </GameweekAdvanceTransition>
  );
}
