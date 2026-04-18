import React from 'react';
import { Image, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Fixture, Pick } from '@totl/domain';

import { supabase } from '../../lib/supabase';
import { formatLocalTimeHHmm } from '../../lib/dateTime';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { getMediumName } from '../../../../../src/lib/teamNames';
import type { LeaguePick } from '../league/LeaguePickPill';
import CenteredSpinner from '../CenteredSpinner';
import WinnerShimmer from '../WinnerShimmer';

function toMap<T>(input: unknown): Map<number, T> {
  if (input instanceof Map) {
    const out = new Map<number, T>();
    input.forEach((v, k) => out.set(Number(k), v as T));
    return out;
  }
  if (Array.isArray(input)) {
    const out = new Map<number, T>();
    input.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return;
      out.set(Number(entry[0]), entry[1] as T);
    });
    return out;
  }
  if (input && typeof input === 'object') {
    const out = new Map<number, T>();
    Object.entries(input as Record<string, unknown>).forEach(([k, v]) => out.set(Number(k), v as T));
    return out;
  }
  return new Map<number, T>();
}

type ProfileRow = { id: string; name: string; avatar_url: string | null; avatar_bg_color: string | null };

function initial1(name: string): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

function PickMarker({
  profile,
  isMe,
  size = 18,
  shiny = false,
}: {
  profile: ProfileRow;
  isMe: boolean;
  size?: number;
  shiny?: boolean;
}) {
  const initialFontSize = size <= 14 ? 7 : 8;
  const initialLineHeight = size <= 14 ? 7 : 8;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: profile.avatar_url ? '#FFFFFF' : (profile.avatar_bg_color ?? '#94A3B8'),
        borderWidth: isMe ? 2 : 1.5,
        borderColor: isMe ? '#1C8376' : '#FFFFFF',
      }}
    >
      {profile.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <TotlText
          style={{
            color: '#FFFFFF',
            fontSize: initialFontSize,
            lineHeight: initialLineHeight,
            fontWeight: '900',
          }}
        >
          {initial1(profile.name)}
        </TotlText>
      )}
      {shiny ? (
        <>
          <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
          <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
        </>
      ) : null}
    </View>
  );
}

function PickMarkerStack({
  profiles,
  currentUserId,
  align,
  size = 18,
  shinyIds,
}: {
  profiles: ProfileRow[];
  currentUserId: string | null;
  align: 'flex-start' | 'center' | 'flex-end';
  size?: number;
  shinyIds?: Set<string>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: align }}>
      {profiles.map((profile, index) => (
        <View key={profile.id} style={{ marginLeft: index === 0 ? 0 : size <= 14 ? -3 : -4 }}>
          <PickMarker
            profile={profile}
            isMe={!!currentUserId && profile.id === currentUserId}
            size={size}
            shiny={!!shinyIds?.has(profile.id)}
          />
        </View>
      ))}
    </View>
  );
}

function compactTeamLabel(f: Fixture, side: 'home' | 'away'): string {
  const code = side === 'home' ? f.home_code : f.away_code;
  const raw = String(code ?? '').trim();
  if (raw) {
    return raw.toUpperCase().slice(0, 3);
  }
  const nameKey = String(
    side === 'home'
      ? (f.home_team ?? f.home_name ?? f.home_code ?? 'HOME')
      : (f.away_team ?? f.away_name ?? f.away_code ?? 'AWAY')
  );
  return nameKey.toUpperCase().slice(0, 3);
}

function mediumTeamLabel(f: Fixture, side: 'home' | 'away'): string {
  const nameKey = String(
    side === 'home'
      ? (f.home_team ?? f.home_name ?? f.home_code ?? 'HOME')
      : (f.away_team ?? f.away_name ?? f.away_code ?? 'AWAY')
  );
  return getMediumName(nameKey);
}

function derivedOutcomeFromLive(live: { home: number | null; away: number | null; status: string | null } | null | undefined): Pick | null {
  if (!live) return null;
  const st = String(live.status ?? '');
  const started = st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED';
  if (!started) return null;
  if (typeof live.home !== 'number' || typeof live.away !== 'number') return null;
  return live.home > live.away ? 'H' : live.home < live.away ? 'A' : 'D';
}

function parseUpdatedAtMs(updatedAt: unknown): number | null {
  if (typeof updatedAt !== 'string' || !updatedAt) return null;
  const ms = new Date(updatedAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatMatchStateLabel(
  status: string | null | undefined,
  minute: number | null | undefined,
  updatedAt: string | null | undefined,
  nowMs: number
): string {
  const st = String(status ?? '');
  if (st === 'FINISHED') return 'FT';
  if (st !== 'IN_PLAY' && st !== 'PAUSED') return '';
  if (typeof minute !== 'number') return '';
  const updatedAtMs = parseUpdatedAtMs(updatedAt);
  const anchor = updatedAtMs ?? nowMs;
  const elapsedMs = Math.max(0, nowMs - anchor);
  const extraMinutes = st === 'IN_PLAY' ? Math.floor(elapsedMs / 60_000) : 0;
  return `${minute + extraMinutes}'`;
}

/**
 * Global leaderboard: first see **their** picks (original list). Tap the card → flip →
 * compact head-to-head (ML-style chips: Home / Draw / Away).
 */
export default function LeaderboardPlayerPicksPopup({
  open,
  onClose,
  gw,
  opponentUserId,
  opponentName,
  opponentAvatarUrl: opponentAvatarUrlProp,
  opponentOcp,
  opponentOverallRank,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl: currentUserAvatarUrlProp,
}: {
  open: boolean;
  onClose: () => void;
  gw: number | null;
  opponentUserId: string | null;
  opponentName: string | null;
  opponentAvatarUrl?: string | null;
  opponentOcp?: number | null;
  opponentOverallRank?: number | null;
  currentUserId: string | null;
  currentUserName?: string | null;
  currentUserAvatarUrl?: string | null;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const cardWidth = Math.min(width - 40, 336);
  const frontMinuteColWidth = 28;
  const frontCenterColWidth = 88;
  const frontTeamBlockWidth = 58;
  const frontSideColWidth = Math.max(96, Math.floor((cardWidth - 24 - frontCenterColWidth) / 2));
  const h2hScoreColWidth = 92;
  const viewportCardLimit = height - insets.top - insets.bottom - 72;
  const cardMaxHeight = Math.min(Math.max(Math.round(height * 0.70), 506), Math.min(616, viewportCardLimit));
  const closeButtonTop = 14;
  const closeButtonRight = 16;
  const closeButtonSize = 36;
  const closeButtonHitSlop = 12;
  const flipDeg = useSharedValue(0);
  const [isFlipped, setIsFlipped] = React.useState(false);

  const showCompareMode = !!(currentUserId && opponentUserId && String(currentUserId) !== String(opponentUserId));

  React.useEffect(() => {
    if (!open) {
      flipDeg.value = 0;
      setIsFlipped(false);
    }
  }, [open, flipDeg]);

  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [open]);

  const gwOk = typeof gw === 'number' && Number.isFinite(gw) && gw > 0;

  const { data, isPending, isError, error } = useQuery({
    enabled: open && gwOk && !!opponentUserId,
    queryKey: ['leaderboardMeVs', gw, opponentUserId, currentUserId],
    queryFn: async () => {
      const targetGw = gw as number;
      const oppId = String(opponentUserId);
      const meId = currentUserId ? String(currentUserId) : null;

      const userIds = meId && meId !== oppId ? [meId, oppId] : [oppId];

      const [fixturesRes, picksRes, resultsRes, liveRes] = await Promise.all([
        supabase.from('app_fixtures').select('*').eq('gw', targetGw).order('fixture_index', { ascending: true }),
        supabase.from('app_picks').select('user_id,fixture_index,pick').eq('gw', targetGw).in('user_id', userIds),
        supabase.from('app_gw_results').select('fixture_index,result').eq('gw', targetGw),
        supabase.from('live_scores').select('fixture_index,home_score,away_score,status,minute,updated_at').eq('gw', targetGw),
      ]);
      if (fixturesRes.error) throw fixturesRes.error;
      if (picksRes.error) throw picksRes.error;
      if (resultsRes.error) throw resultsRes.error;
      if (liveRes.error) throw liveRes.error;

      const fixtures: Fixture[] = (fixturesRes.data ?? []) as Fixture[];

      const picksByUserAndFixture = new Map<string, Map<number, Pick>>();
      ((picksRes.data ?? []) as Array<{ user_id: string; fixture_index: number; pick: Pick | string }>).forEach((p) => {
        if (p.pick !== 'H' && p.pick !== 'D' && p.pick !== 'A') return;
        const uid = String(p.user_id);
        const m = picksByUserAndFixture.get(uid) ?? new Map<number, Pick>();
        m.set(Number(p.fixture_index), p.pick);
        picksByUserAndFixture.set(uid, m);
      });

      const resultByFixture = new Map<number, Pick>();
      ((resultsRes.data ?? []) as Array<{ fixture_index: number; result: Pick | string }>).forEach((r) => {
        if (r.result === 'H' || r.result === 'D' || r.result === 'A') resultByFixture.set(Number(r.fixture_index), r.result);
      });
      const liveByFixture = new Map<number, { home: number | null; away: number | null; status: string | null; minute: number | null; updated_at: string | null }>();
      ((liveRes.data ?? []) as Array<{ fixture_index: number; home_score: number | null; away_score: number | null; status: string | null; minute: number | null; updated_at: string | null }>).forEach(
        (ls) => {
          liveByFixture.set(Number(ls.fixture_index), {
            home: typeof ls.home_score === 'number' ? ls.home_score : null,
            away: typeof ls.away_score === 'number' ? ls.away_score : null,
            status: typeof ls.status === 'string' ? ls.status : null,
            minute: typeof ls.minute === 'number' ? ls.minute : null,
            updated_at: typeof ls.updated_at === 'string' ? ls.updated_at : null,
          });
        }
      );

      let profiles: ProfileRow[] = [];
      try {
        const usersRes = await supabase.from('users').select('id,name,avatar_url,avatar_bg_color').in('id', userIds);
        if (!usersRes.error && usersRes.data) {
          profiles = (usersRes.data as any[]).map((u) => ({
            id: String(u.id),
            name: typeof u.name === 'string' ? u.name : 'Player',
            avatar_url: typeof u.avatar_url === 'string' ? u.avatar_url : null,
            avatar_bg_color: typeof u.avatar_bg_color === 'string' ? u.avatar_bg_color : null,
          }));
        }
      } catch {
        profiles = [];
      }

      return { fixtures, picksByUserAndFixture, resultByFixture, liveByFixture, profiles };
    },
    staleTime: 0,
  });

  const normalized = React.useMemo(() => {
    const fixtures = Array.isArray(data?.fixtures) ? data.fixtures : [];
    return {
      fixtures,
      picksByUserAndFixture: data?.picksByUserAndFixture ?? new Map(),
      resultByFixture: toMap<Pick>(data?.resultByFixture),
      liveByFixture: toMap<{ home: number | null; away: number | null; status: string | null; minute: number | null; updated_at: string | null }>(
        data?.liveByFixture
      ),
      profiles: data?.profiles ?? [],
    };
  }, [data]);

  const meId = currentUserId ? String(currentUserId) : null;
  const oppId = opponentUserId ? String(opponentUserId) : '';
  const isSelf = !!(meId && oppId && meId === oppId);

  const meProfile = React.useMemo(() => {
    if (!meId) return null;
    return normalized.profiles.find((p) => p.id === meId) ?? null;
  }, [meId, normalized.profiles]);

  const oppProfile = React.useMemo(() => {
    if (!oppId) return null;
    return normalized.profiles.find((p) => p.id === oppId) ?? null;
  }, [oppId, normalized.profiles]);

  const membersForChips = React.useMemo(() => {
    const opp: ProfileRow = oppProfile ?? {
      id: oppId,
      name: opponentName?.trim() || 'Player',
      avatar_url: opponentAvatarUrlProp ?? null,
      avatar_bg_color: null,
    };
    if (!meId || isSelf) {
      return [opp];
    }
    const me: ProfileRow = meProfile ?? {
      id: meId,
      name: currentUserName?.trim() || 'You',
      avatar_url: currentUserAvatarUrlProp ?? null,
      avatar_bg_color: null,
    };
    return [me, opp];
  }, [
    meId,
    meProfile,
    oppId,
    oppProfile,
    opponentName,
    opponentAvatarUrlProp,
    currentUserAvatarUrlProp,
    currentUserName,
    isSelf,
  ]);

  const opponentDisplay = opponentName && opponentName.trim().length > 0 ? opponentName.trim() : 'Player';
  const meHeaderProfile = React.useMemo<ProfileRow | null>(() => {
    if (!meId) return null;
    return (
      meProfile ?? {
        id: meId,
        name: currentUserName?.trim() || 'You',
        avatar_url: currentUserAvatarUrlProp ?? null,
        avatar_bg_color: null,
      }
    );
  }, [meId, meProfile, currentUserAvatarUrlProp, currentUserName]);
  const oppHeaderProfile = React.useMemo<ProfileRow>(() => {
    return (
      oppProfile ?? {
        id: oppId,
        name: opponentDisplay,
        avatar_url: opponentAvatarUrlProp ?? null,
        avatar_bg_color: null,
      }
    );
  }, [oppProfile, oppId, opponentDisplay, opponentAvatarUrlProp]);
  const meDisplay = meHeaderProfile?.name?.trim() ? meHeaderProfile.name.trim() : 'You';

  const h2hSummary = React.useMemo(() => {
    let meScore = 0;
    let oppScore = 0;
    let anyLive = false;
    let anyStarted = false;

    const oppPicks = normalized.picksByUserAndFixture.get(oppId) ?? new Map<number, Pick>();
    const myPicks = meId ? normalized.picksByUserAndFixture.get(meId) ?? new Map<number, Pick>() : new Map<number, Pick>();

    normalized.fixtures.forEach((f) => {
      const fixtureIndex = Number(f.fixture_index);
      const live = normalized.liveByFixture.get(fixtureIndex);
      const status = String(live?.status ?? '');
      if (status === 'IN_PLAY' || status === 'PAUSED') anyLive = true;
      if (status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED') anyStarted = true;

      const outcome = normalized.resultByFixture.get(fixtureIndex) ?? derivedOutcomeFromLive(live);
      if (!outcome) return;
      anyStarted = true;

      const oppPick = oppPicks.get(fixtureIndex);
      const myPick = meId ? myPicks.get(fixtureIndex) : null;
      if (oppPick === outcome) oppScore += 1;
      if (myPick === outcome) meScore += 1;
    });

    return { meScore, oppScore, anyLive, anyStarted };
  }, [normalized.fixtures, normalized.liveByFixture, normalized.resultByFixture, normalized.picksByUserAndFixture, oppId, meId]);

  const toggleFlip = React.useCallback(() => {
    if (!showCompareMode) return;
    setIsFlipped((prev) => !prev);
    flipDeg.value = withTiming(flipDeg.value < 90 ? 180 : 0, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [showCompareMode, flipDeg]);

  const flipCardGesture = React.useMemo(
    () =>
      Gesture.Tap()
        .enabled(showCompareMode)
        .onEnd((event, success) => {
          if (!success) return;
          const closeLeft = cardWidth - closeButtonRight - closeButtonSize - closeButtonHitSlop;
          const closeRight = cardWidth - closeButtonRight + closeButtonHitSlop;
          const closeTop = closeButtonTop - closeButtonHitSlop;
          const closeBottom = closeButtonTop + closeButtonSize + closeButtonHitSlop;
          const tappedClose =
            event.x >= closeLeft &&
            event.x <= closeRight &&
            event.y >= closeTop &&
            event.y <= closeBottom;
          if (tappedClose) return;
          runOnJS(toggleFlip)();
        }),
    [showCompareMode, toggleFlip, cardWidth]
  );

  const frontFaceStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flipDeg.value}deg` }],
  }));

  const backFaceStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flipDeg.value + 180}deg` }],
  }));

  const liveDotPulse = useSharedValue(1);
  React.useEffect(() => {
    cancelAnimation(liveDotPulse);
    if (!h2hSummary.anyLive) {
      liveDotPulse.value = 1;
      return;
    }
    liveDotPulse.value = 1;
    liveDotPulse.value = withRepeat(withTiming(1.9, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [h2hSummary.anyLive, liveDotPulse]);

  const liveDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: liveDotPulse.value }],
    opacity: interpolate(liveDotPulse.value, [1, 1.9], [0.55, 0.08]),
  }));

  return (
    <Modal transparent visible={open} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(2,6,23,0.7)',
          }}
        />

        <View
          pointerEvents="box-none"
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View style={{ width: cardWidth, position: 'relative' }}>
            <View style={{ width: cardWidth, height: cardMaxHeight }}>
              <GestureDetector gesture={flipCardGesture}>
                <View style={{ width: '100%', height: '100%' }}>
              {/* Front */}
              <Animated.View
                style={[frontFaceStyle, {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backfaceVisibility: 'hidden',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 28,
                  shadowColor: '#000000',
                  shadowOpacity: 0.24,
                  shadowRadius: 28,
                  shadowOffset: { width: 0, height: 16 },
                  elevation: 12,
                  overflow: 'hidden',
                }]}
              >
                <View style={{ flex: 1, position: 'relative' }}>
                  <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 26 }}>
                    <TotlText
                      style={{
                        color: '#0F172A',
                        fontFamily: 'Gramatika-Bold',
                        fontWeight: '900',
                        fontSize: 20,
                        lineHeight: 24,
                        textAlign: 'center',
                      }}
                    >
                      {isSelf ? 'Your picks' : opponentDisplay}
                    </TotlText>
                    {!isSelf && (typeof opponentOcp === 'number' || typeof opponentOverallRank === 'number') ? (
                      <TotlText
                        style={{
                          textAlign: 'center',
                          color: '#64748B',
                          fontFamily: t.font.body,
                          fontWeight: '500',
                          fontSize: 13,
                          lineHeight: 18,
                          marginTop: 6,
                        }}
                      >
                        {typeof opponentOcp === 'number' ? `OCP ${opponentOcp}` : ''}
                        {typeof opponentOcp === 'number' && typeof opponentOverallRank === 'number' ? ' · ' : ''}
                        {typeof opponentOverallRank === 'number' ? `#${opponentOverallRank}` : ''}
                      </TotlText>
                    ) : null}
                    <TotlText variant="sectionSubtitle" style={{ textAlign: 'center', marginTop: 4 }}>
                      Gameweek {typeof gw === 'number' ? gw : '—'}
                    </TotlText>
                  </View>

                  {isPending ? (
                    <View style={{ flex: 1, minHeight: 200 }}>
                      <CenteredSpinner loading={isPending} />
                    </View>
                  ) : isError ? (
                    <View style={{ flex: 1, minHeight: 160, paddingHorizontal: 16, justifyContent: 'center' }}>
                      <TotlText style={{ textAlign: 'center', color: '#64748B', fontSize: 14 }}>
                        {error instanceof Error ? error.message : 'Could not load picks.'}
                      </TotlText>
                    </View>
                  ) : (
                    <ScrollView
                      style={{ flex: 1 }}
                      contentContainerStyle={{ paddingBottom: 8 }}
                      showsVerticalScrollIndicator={normalized.fixtures.length > 6}
                    >
                      {normalized.fixtures.map((f, index) => {
                        const fixtureIndex = Number(f.fixture_index);
                        const oppPicks = normalized.picksByUserAndFixture.get(oppId);
                        const pick = oppPicks?.get(fixtureIndex) ?? null;
                        const official = normalized.resultByFixture.get(fixtureIndex) ?? null;
                        const pickCorrect = pick && official ? pick === official : null;
                        const pickIndicatorColor = pickCorrect === false ? '#B6C2D1' : t.color.brand;
                        const live = normalized.liveByFixture.get(fixtureIndex) ?? null;
                        const homeCode = String(f.home_code ?? '').toUpperCase();
                        const awayCode = String(f.away_code ?? '').toUpperCase();
                        const homeBadge = TEAM_BADGES[homeCode] ?? null;
                        const awayBadge = TEAM_BADGES[awayCode] ?? null;
                        const homeLabel = compactTeamLabel(f, 'home');
                        const awayLabel = compactTeamLabel(f, 'away');
                        const hasScore = live && typeof live.home === 'number' && typeof live.away === 'number';
                        const matchStateLabel = formatMatchStateLabel(live?.status, live?.minute, live?.updated_at, nowMs);
                        const scoreHomeText = hasScore ? String(live.home) : '';
                        const scoreAwayText = hasScore ? String(live.away) : '';
                        const kickoffTimeLabel = (() => {
                          if (hasScore) return '';
                          const raw = formatLocalTimeHHmm(f.kickoff_time);
                          return raw === '—' || !raw ? 'TBD' : raw;
                        })();

                        return (
                          <View
                            key={`front-${fixtureIndex}`}
                            style={{
                              backgroundColor: index % 2 === 0 ? '#F5F7FA' : '#FFFFFF',
                            }}
                          >
                            <View style={{ paddingHorizontal: 12, paddingVertical: 7 }}>
                              <View style={{ position: 'relative', minHeight: 22, justifyContent: 'center' }}>
                                <View
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: frontMinuteColWidth,
                                    alignItems: 'flex-start',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {matchStateLabel ? (
                                    <TotlText variant="microMuted" style={{ fontSize: 10, lineHeight: 12 }}>
                                      {matchStateLabel}
                                    </TotlText>
                                  ) : null}
                                </View>
                                <View
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: frontSideColWidth,
                                    alignItems: 'flex-end',
                                    justifyContent: 'center',
                                    paddingRight: 8,
                                  }}
                                >
                                  <View style={{ width: frontTeamBlockWidth, alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                      <TotlText
                                        numberOfLines={1}
                                        style={{
                                          color: '#0F172A',
                                          fontSize: 12,
                                          lineHeight: 13,
                                          textAlign: 'right',
                                          fontWeight:
                                            live && typeof live.home === 'number' && typeof live.away === 'number' && live.home > live.away
                                              ? '800'
                                              : '600',
                                        }}
                                      >
                                        {homeLabel}
                                      </TotlText>
                                      {homeBadge ? <Image source={homeBadge} style={{ width: 16, height: 16, marginLeft: 9 }} /> : null}
                                    </View>
                                  </View>
                                </View>
                                <View style={{ width: frontCenterColWidth, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
                                  {hasScore ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <TotlText
                                        style={{
                                          color: '#0F172A',
                                          fontFamily: 'Gramatika-Medium',
                                          fontWeight: '700',
                                          fontSize: 16,
                                          lineHeight: 16,
                                        }}
                                      >
                                        {scoreHomeText}
                                      </TotlText>
                                      <TotlText
                                        style={{
                                          color: '#334155',
                                          marginHorizontal: 4,
                                          fontFamily: 'Gramatika-Medium',
                                          fontWeight: '700',
                                          fontSize: 16,
                                          lineHeight: 16,
                                        }}
                                      >
                                        -
                                      </TotlText>
                                      <TotlText
                                        style={{
                                          color: '#0F172A',
                                          fontFamily: 'Gramatika-Medium',
                                          fontWeight: '700',
                                          fontSize: 16,
                                          lineHeight: 16,
                                        }}
                                      >
                                        {scoreAwayText}
                                      </TotlText>
                                    </View>
                                  ) : (
                                    <TotlText variant="microMuted" numberOfLines={1} style={{ textAlign: 'center' }}>
                                      {kickoffTimeLabel}
                                    </TotlText>
                                  )}
                                </View>
                                <View
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: frontSideColWidth,
                                    alignItems: 'flex-start',
                                    justifyContent: 'center',
                                    paddingLeft: 8,
                                  }}
                                >
                                  <View style={{ width: frontTeamBlockWidth, alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                      {awayBadge ? <Image source={awayBadge} style={{ width: 16, height: 16, marginRight: 9 }} /> : null}
                                      <TotlText
                                        numberOfLines={1}
                                        style={{
                                          color: '#0F172A',
                                          fontSize: 12,
                                          lineHeight: 13,
                                          fontWeight:
                                            live && typeof live.home === 'number' && typeof live.away === 'number' && live.away > live.home
                                              ? '800'
                                              : '600',
                                        }}
                                      >
                                        {awayLabel}
                                      </TotlText>
                                    </View>
                                  </View>
                                </View>
                              </View>
                              <View style={{ position: 'relative', marginTop: 5, minHeight: 6, justifyContent: 'center' }}>
                                <View
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    width: frontSideColWidth,
                                    alignItems: 'flex-end',
                                    paddingRight: 8,
                                  }}
                                >
                                  {pick === 'H' ? (
                                    <View
                                      style={{
                                        width: frontTeamBlockWidth,
                                        height: 6,
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                        backgroundColor: pickIndicatorColor,
                                      }}
                                    >
                                      {pickCorrect === true ? (
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
                                </View>
                                <View style={{ width: frontCenterColWidth, alignSelf: 'center', alignItems: 'center' }}>
                                  {pick === 'D' ? (
                                    <View
                                      style={{
                                        width: 45,
                                        height: 6,
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                        backgroundColor: pickIndicatorColor,
                                      }}
                                    >
                                      {pickCorrect === true ? (
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
                                </View>
                                <View
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 0,
                                    width: frontSideColWidth,
                                    alignItems: 'flex-start',
                                    paddingLeft: 8,
                                  }}
                                >
                                  {pick === 'A' ? (
                                    <View
                                      style={{
                                        width: frontTeamBlockWidth,
                                        height: 6,
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                        backgroundColor: pickIndicatorColor,
                                      }}
                                    >
                                      {pickCorrect === true ? (
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
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              </Animated.View>

              {/* Back */}
              <Animated.View
                style={[backFaceStyle, {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backfaceVisibility: 'hidden',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 28,
                  shadowColor: '#000000',
                  shadowOpacity: 0.24,
                  shadowRadius: 28,
                  shadowOffset: { width: 0, height: 16 },
                  elevation: 12,
                  overflow: 'hidden',
                }]}
              >
                <View style={{ flex: 1, position: 'relative' }}>
                <View style={{ paddingHorizontal: 14, paddingTop: 28, paddingBottom: 16 }}>
                  <View style={{ position: 'relative', minHeight: 32, justifyContent: 'center' }}>
                    {h2hSummary.anyLive ? (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          liveDotStyle,
                          {
                            position: 'absolute',
                            left: 12,
                            top: '50%',
                            width: 10,
                            height: 10,
                            marginTop: -5,
                            borderRadius: 999,
                            backgroundColor: '#EF4444',
                            zIndex: 2,
                          },
                        ]}
                      />
                    ) : null}
                    {h2hSummary.anyStarted ? (
                      <View style={{ position: 'relative', width: '100%', minHeight: 56, justifyContent: 'center' }}>
                        <View
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: frontSideColWidth,
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            paddingRight: 8,
                          }}
                        >
                          <View style={{ width: frontTeamBlockWidth, alignItems: 'center' }}>
                            {meHeaderProfile ? <PickMarker profile={meHeaderProfile} isMe size={30} /> : null}
                            <TotlText
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={{
                                width: 68,
                                marginTop: 4,
                                color: '#0F172A',
                                fontSize: 12,
                                lineHeight: 13,
                                textAlign: 'center',
                                fontWeight: '600',
                              }}
                            >
                              {meDisplay}
                            </TotlText>
                          </View>
                        </View>
                        <View style={{ width: h2hScoreColWidth, alignSelf: 'center', alignItems: 'center' }}>
                          <TotlText
                            style={{
                              color: '#0F172A',
                              fontFamily: 'Gramatika-Bold',
                              fontWeight: '900',
                              fontSize: 28,
                              lineHeight: 30,
                              textAlign: 'center',
                            }}
                          >
                            {h2hSummary.meScore}
                            <TotlText
                              style={{
                                color: '#0F172A',
                                fontFamily: t.font.body,
                                fontWeight: '500',
                                fontSize: 22,
                                lineHeight: 30,
                              }}
                            >
                              {' - '}
                            </TotlText>
                            {h2hSummary.oppScore}
                          </TotlText>
                        </View>
                        <View
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: frontSideColWidth,
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            paddingLeft: 8,
                          }}
                        >
                          <View style={{ width: frontTeamBlockWidth, alignItems: 'center' }}>
                            <PickMarker profile={oppHeaderProfile} isMe={false} size={30} />
                            <TotlText
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={{
                                width: 68,
                                marginTop: 4,
                                color: '#0F172A',
                                fontSize: 12,
                                lineHeight: 13,
                                textAlign: 'center',
                                fontWeight: '600',
                              }}
                            >
                              {opponentDisplay}
                            </TotlText>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={{ position: 'relative', width: '100%', minHeight: 56, justifyContent: 'center' }}>
                        <View
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: frontSideColWidth,
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            paddingRight: 8,
                          }}
                        >
                          <View style={{ width: frontTeamBlockWidth, alignItems: 'center' }}>
                            {meHeaderProfile ? <PickMarker profile={meHeaderProfile} isMe size={30} /> : null}
                            <TotlText
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={{
                                width: 68,
                                marginTop: 4,
                                color: '#0F172A',
                                fontSize: 12,
                                lineHeight: 13,
                                textAlign: 'center',
                                fontWeight: '600',
                              }}
                            >
                              {meDisplay}
                            </TotlText>
                          </View>
                        </View>
                        <View style={{ width: h2hScoreColWidth, alignSelf: 'center', alignItems: 'center' }}>
                          <TotlText
                            style={{
                              textAlign: 'center',
                              color: '#0F172A',
                              fontFamily: t.font.body,
                              fontWeight: '500',
                              fontSize: 18,
                              lineHeight: 30,
                            }}
                          >
                            -
                          </TotlText>
                        </View>
                        <View
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: frontSideColWidth,
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            paddingLeft: 8,
                          }}
                        >
                          <View style={{ width: frontTeamBlockWidth, alignItems: 'center' }}>
                            <PickMarker profile={oppHeaderProfile} isMe={false} size={30} />
                            <TotlText
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={{
                                width: 68,
                                marginTop: 4,
                                color: '#0F172A',
                                fontSize: 12,
                                lineHeight: 13,
                                textAlign: 'center',
                                fontWeight: '600',
                              }}
                            >
                              {opponentDisplay}
                            </TotlText>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {isPending ? (
                  <View style={{ flex: 1, minHeight: 200 }}>
                    <CenteredSpinner loading={isPending} />
                  </View>
                ) : (
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 10 }}
                    showsVerticalScrollIndicator={normalized.fixtures.length > 5}
                  >
                    {normalized.fixtures.map((f, index) => {
                      const fixtureIndex = Number(f.fixture_index);
                      const live = normalized.liveByFixture.get(fixtureIndex);
                      const hasScore = live && typeof live.home === 'number' && typeof live.away === 'number';
                      const homeCode = String(f.home_code ?? '').toUpperCase();
                      const awayCode = String(f.away_code ?? '').toUpperCase();
                      const homeBadge = TEAM_BADGES[homeCode] ?? null;
                      const awayBadge = TEAM_BADGES[awayCode] ?? null;
                      const homeLabel = mediumTeamLabel(f, 'home');
                      const awayLabel = mediumTeamLabel(f, 'away');
                      const matchStateLabel = formatMatchStateLabel(live?.status, live?.minute, live?.updated_at, nowMs);
                      const isLiveMinuteLabel = String(live?.status ?? '') === 'IN_PLAY' || String(live?.status ?? '') === 'PAUSED';
                      const centerLabel = hasScore
                        ? `${live!.home} - ${live!.away}`
                        : (() => {
                            const raw = formatLocalTimeHHmm(f.kickoff_time);
                            return raw === '—' || !raw ? 'TBD' : raw;
                          })();
                      const oppPicks = normalized.picksByUserAndFixture.get(oppId);
                      const myPicks = meId ? normalized.picksByUserAndFixture.get(meId) : null;
                      const op = oppPicks?.get(fixtureIndex);
                      const mp = myPicks?.get(fixtureIndex);
                      const outcome = normalized.resultByFixture.get(fixtureIndex) ?? derivedOutcomeFromLive(live);

                      const bucketProfiles = {
                        H: [] as ProfileRow[],
                        D: [] as ProfileRow[],
                        A: [] as ProfileRow[],
                      };
                      const bucketShinyIds = {
                        H: new Set<string>(),
                        D: new Set<string>(),
                        A: new Set<string>(),
                      };
                      const meMarker =
                        meId && !isSelf
                          ? (membersForChips.find((member) => member.id === meId) as ProfileRow | undefined) ?? null
                          : null;
                      const oppMarker =
                        (membersForChips.find((member) => member.id === oppId) as ProfileRow | undefined) ??
                        {
                          id: oppId,
                          name: opponentDisplay,
                          avatar_url: opponentAvatarUrlProp ?? null,
                          avatar_bg_color: null,
                        };
                      if (meMarker && (mp === 'H' || mp === 'D' || mp === 'A')) bucketProfiles[mp].push(meMarker);
                      if (op === 'H' || op === 'D' || op === 'A') bucketProfiles[op].push(oppMarker);
                      if (meMarker && outcome && mp === outcome) bucketShinyIds[outcome].add(meMarker.id);
                      if (outcome && op === outcome) bucketShinyIds[outcome].add(oppMarker.id);

                      return (
                        <View
                          key={`mevs-${fixtureIndex}`}
                          style={{
                            backgroundColor: index % 2 === 0 ? '#F5F7FA' : '#FFFFFF',
                          }}
                        >
                          <View style={{ paddingHorizontal: 12, paddingVertical: 5, position: 'relative' }}>
                            <View
                              style={{
                                position: 'absolute',
                                left: 12,
                                top: 0,
                                bottom: 0,
                                width: frontMinuteColWidth,
                                alignItems: 'flex-start',
                                justifyContent: 'center',
                              }}
                            >
                              {matchStateLabel ? (
                                isLiveMinuteLabel ? (
                                  <View
                                    style={{
                                      minWidth: 20,
                                      height: 20,
                                      paddingHorizontal: 4,
                                      borderRadius: 999,
                                      backgroundColor: '#EF4444',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <TotlText
                                      style={{
                                        color: '#FFFFFF',
                                        fontFamily: 'Gramatika-Bold',
                                        fontWeight: '800',
                                        fontSize: 10,
                                        lineHeight: 10,
                                      }}
                                    >
                                      {matchStateLabel}
                                    </TotlText>
                                  </View>
                                ) : (
                                  <TotlText
                                    style={{
                                      color: '#64748B',
                                      fontFamily: 'Gramatika-Bold',
                                      fontWeight: '800',
                                      fontSize: 10,
                                      lineHeight: 12,
                                    }}
                                  >
                                    {matchStateLabel}
                                  </TotlText>
                                )
                              ) : null}
                            </View>
                            <View style={{ position: 'relative', minHeight: 22, justifyContent: 'center' }}>
                              <View
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: frontSideColWidth,
                                  alignItems: 'flex-end',
                                  justifyContent: 'center',
                                  paddingRight: 8,
                                }}
                              >
                                <View style={{ width: frontTeamBlockWidth, alignItems: 'center' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                    <TotlText
                                      numberOfLines={1}
                                      style={{
                                        color: '#0F172A',
                                        fontFamily: outcome === 'H' ? 'Gramatika-Bold' : t.font.body,
                                        fontSize: 12,
                                        lineHeight: 13,
                                        textAlign: 'right',
                                        fontWeight: outcome === 'H' ? '800' : '600',
                                      }}
                                    >
                                      {homeLabel}
                                    </TotlText>
                                  </View>
                                </View>
                              </View>
                              <View style={{ width: frontCenterColWidth, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
                                {hasScore ? (
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <TotlText
                                      style={{
                                        color: '#0F172A',
                                        fontFamily: 'Gramatika-Medium',
                                        fontWeight: '700',
                                        fontSize: 16,
                                        lineHeight: 16,
                                      }}
                                    >
                                      {String(live!.home)}
                                    </TotlText>
                                    <TotlText
                                      style={{
                                        color: '#334155',
                                        marginHorizontal: 4,
                                        fontFamily: 'Gramatika-Medium',
                                        fontWeight: '700',
                                        fontSize: 16,
                                        lineHeight: 16,
                                      }}
                                    >
                                      -
                                    </TotlText>
                                    <TotlText
                                      style={{
                                        color: '#0F172A',
                                        fontFamily: 'Gramatika-Medium',
                                        fontWeight: '700',
                                        fontSize: 16,
                                        lineHeight: 16,
                                      }}
                                    >
                                      {String(live!.away)}
                                    </TotlText>
                                  </View>
                                ) : (
                                  <TotlText variant="microMuted" numberOfLines={1} style={{ textAlign: 'center' }}>
                                    {centerLabel}
                                  </TotlText>
                                )}
                              </View>
                              <View
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: frontSideColWidth,
                                  alignItems: 'flex-start',
                                  justifyContent: 'center',
                                  paddingLeft: 8,
                                }}
                              >
                                <View style={{ width: frontTeamBlockWidth, alignItems: 'center' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                    <TotlText
                                      numberOfLines={1}
                                      style={{
                                        color: '#0F172A',
                                        fontFamily: outcome === 'A' ? 'Gramatika-Bold' : t.font.body,
                                        fontSize: 12,
                                        lineHeight: 13,
                                        fontWeight: outcome === 'A' ? '800' : '600',
                                      }}
                                    >
                                      {awayLabel}
                                    </TotlText>
                                  </View>
                                </View>
                              </View>
                            </View>
                              <View style={{ position: 'relative', marginTop: 3, minHeight: 15, justifyContent: 'center' }}>
                              <View
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  width: frontSideColWidth,
                                  alignItems: 'flex-end',
                                  paddingRight: 8,
                                  transform: [{ translateY: -3 }],
                                }}
                              >
                                {bucketProfiles.H.length ? (
                                  <View style={{ width: frontTeamBlockWidth, alignItems: 'center' }}>
                                    <PickMarkerStack
                                      profiles={bucketProfiles.H}
                                      currentUserId={meId}
                                      align="center"
                                      size={17.05}
                                      shinyIds={bucketShinyIds.H}
                                    />
                                  </View>
                                ) : null}
                              </View>
                              <View style={{ width: frontCenterColWidth, alignSelf: 'center', alignItems: 'center', transform: [{ translateY: -3 }] }}>
                                {bucketProfiles.D.length ? (
                                  <PickMarkerStack
                                    profiles={bucketProfiles.D}
                                    currentUserId={meId}
                                    align="center"
                                    size={17.05}
                                    shinyIds={bucketShinyIds.D}
                                  />
                                ) : null}
                              </View>
                              <View
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  width: frontSideColWidth,
                                  alignItems: 'flex-start',
                                  paddingLeft: 8,
                                  transform: [{ translateY: -3 }],
                                }}
                              >
                                {bucketProfiles.A.length ? (
                                  <View style={{ width: frontTeamBlockWidth, alignItems: 'center' }}>
                                    <PickMarkerStack
                                      profiles={bucketProfiles.A}
                                      currentUserId={meId}
                                      align="center"
                                      size={17.05}
                                      shinyIds={bucketShinyIds.A}
                                    />
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
                </View>
              </Animated.View>
                </View>
              </GestureDetector>
              <Animated.View
                pointerEvents="box-none"
                style={[
                  frontFaceStyle,
                  {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backfaceVisibility: 'hidden',
                    zIndex: 4,
                  },
                ]}
              >
                <View pointerEvents="box-none" style={{ flex: 1, position: 'relative' }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={closeButtonHitSlop}
                    onPress={onClose}
                    style={({ pressed }) => ({
                      position: 'absolute',
                      top: closeButtonTop,
                      right: closeButtonRight,
                      width: closeButtonSize,
                      height: closeButtonSize,
                      borderRadius: closeButtonSize / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(15,23,42,0.05)',
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <Ionicons name="close" size={20} color="#0F172A" />
                  </Pressable>
                </View>
              </Animated.View>
              <Animated.View
                pointerEvents="box-none"
                style={[
                  backFaceStyle,
                  {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backfaceVisibility: 'hidden',
                    zIndex: 4,
                  },
                ]}
              >
                <View pointerEvents="box-none" style={{ flex: 1, position: 'relative' }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={closeButtonHitSlop}
                    onPress={onClose}
                    style={({ pressed }) => ({
                      position: 'absolute',
                      top: closeButtonTop,
                      right: closeButtonRight,
                      width: closeButtonSize,
                      height: closeButtonSize,
                      borderRadius: closeButtonSize / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(15,23,42,0.05)',
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <Ionicons name="close" size={20} color="#0F172A" />
                  </Pressable>
                </View>
              </Animated.View>
            </View>

            {showCompareMode && !isFlipped ? (
              <TotlText
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: cardMaxHeight + 8,
                  textAlign: 'center',
                  fontFamily: 'Gramatika-Medium',
                  fontWeight: '600',
                  fontSize: 14,
                  color: 'rgba(226,232,240,0.95)',
                }}
              >
                TAP TO SEE HEAD TO HEAD
              </TotlText>
            ) : null}
          </View>

        </View>
      </View>
    </Modal>
  );
}
