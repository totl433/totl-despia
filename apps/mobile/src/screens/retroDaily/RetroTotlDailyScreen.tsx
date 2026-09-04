import React from 'react';
import { Pressable, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import ConfettiCannon from 'react-native-confetti-cannon';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';

import {
  createMockRetroPuzzle,
  RETRO_TIMER_MS,
  type RetroFixture,
  type RetroPick,
  type RetroPuzzle,
} from '../../lib/retroDaily/mockPuzzle';
import type { RetroTotlDailyStackParamList } from '../../navigation/RetroTotlDailyNavigator';
import RetroDailyIntroCard from '../../components/retroDaily/RetroDailyIntroCard';
import RetroDailyCountdownCard from '../../components/retroDaily/RetroDailyCountdownCard';
import RetroDailyLogoBack from '../../components/retroDaily/RetroDailyLogoBack';
import RetroDailyPromoteFlipCard, {
  RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS,
  RETRO_PROMOTE_FLIP_DELAY_MS,
  RETRO_PROMOTE_FLIP_MS,
} from '../../components/retroDaily/RetroDailyPromoteFlipCard';
import RetroDailyRevealCard, {
  resultMatchesPick,
  RETRO_REVEAL_FLIP_MS,
  RETRO_REVEAL_HOLD_MS,
} from '../../components/retroDaily/RetroDailyRevealCard';
import RetroDailyScoreCard, { type RetroRoundOutcome } from '../../components/retroDaily/RetroDailyScoreCard';
import RetroDailyRulesSheet from '../../components/retroDaily/RetroDailyRulesSheet';
import RetroDailySwipeStack, {
  DRAW_THRESHOLD,
  SWIPE_THRESHOLD,
} from '../../components/retroDaily/RetroDailySwipeStack';

type Phase = 'intro' | 'countdown' | 'playing' | 'reveal' | 'score';

const BG = '#0B1F3A';
const CHROME_WHITE = '#FFFFFF';
const ACTIVE_BG = '#1C8376';
const INACTIVE_BG = 'rgba(255,255,255,0.22)';
const ACTIVE_TEXT = '#FFFFFF';
const INACTIVE_TEXT = '#FFFFFF';
const TIMER_SLOT_H = 48;
const BOTTOM_SLOT_H = 108;

/**
 * Admin prototype: Retro Totl Daily.
 * Stack mechanics match PredictionsSwipeDeck — keep this screen about game flow only.
 */
export default function RetroTotlDailyScreen() {
  const t = useTokens();
  const navigation = useNavigation<NativeStackNavigationProp<RetroTotlDailyStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [puzzle, setPuzzle] = React.useState<RetroPuzzle>(() => createMockRetroPuzzle());
  const fixtures = puzzle.fixtures;
  const [phase, setPhase] = React.useState<Phase>('intro');
  const [index, setIndex] = React.useState(0);
  const [countdown, setCountdown] = React.useState(3);
  const [outcomes, setOutcomes] = React.useState<RetroRoundOutcome[]>([]);
  const [lastCorrect, setLastCorrect] = React.useState(false);
  const [lastTimedOut, setLastTimedOut] = React.useState(false);
  const [revealFixture, setRevealFixture] = React.useState<RetroFixture | null>(null);
  const [cardKey, setCardKey] = React.useState('intro');
  const [flipKey, setFlipKey] = React.useState(0);
  const [interactive, setInteractive] = React.useState(true);
  const [rulesOpen, setRulesOpen] = React.useState(false);
  /** Local cannon — global ConfettiProvider sits under this fullScreenModal. */
  const [confettiShot, setConfettiShot] = React.useState<{
    key: number;
    count: number;
    explosionSpeed: number;
    fallSpeed: number;
    ttlMs: number;
  } | null>(null);

  const fireConfetti = React.useCallback(
    (opts?: { count?: number; explosionSpeed?: number; fallSpeed?: number; ttlMs?: number }) => {
      const fallSpeed = opts?.fallSpeed ?? 2800;
      const ttlMs = Math.max(opts?.ttlMs ?? 4200, fallSpeed + 1400);
      setConfettiShot({
        key: Date.now(),
        count: opts?.count ?? 160,
        explosionSpeed: opts?.explosionSpeed ?? 380,
        fallSpeed,
        ttlMs,
      });
    },
    []
  );

  const timerProgress = useSharedValue(1);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  /** 1 while playing + interactive so pick buttons light up on drag. */
  const pickHighlight = useSharedValue(0);
  const timerEpoch = React.useRef(0);

  const fixture = fixtures[index] ?? null;
  const score = outcomes.filter((o) => o.correct).length;
  const perfect =
    score === fixtures.length &&
    outcomes.length === fixtures.length &&
    outcomes.every((o) => o.correct);
  const fromCountdown = cardKey.startsWith('play-0-');

  const headerBlock = 56;
  const cardWidth = Math.min(420, screenWidth - t.space[4] * 2);

  const close = React.useCallback(() => {
    const parent = navigation.getParent?.();
    if (parent?.canGoBack?.()) parent.goBack();
    else if (navigation.canGoBack?.()) navigation.goBack();
    else parent?.navigate?.('Tabs', { screen: 'Profile' });
  }, [navigation]);

  const openScoreboard = React.useCallback(() => {
    navigation.navigate('RetroTotlDailyScoreboard');
  }, [navigation]);

  const restart = React.useCallback(() => {
    timerEpoch.current += 1;
    setPuzzle(createMockRetroPuzzle());
    setPhase('intro');
    setIndex(0);
    setCountdown(3);
    setOutcomes([]);
    setLastCorrect(false);
    setLastTimedOut(false);
    setRevealFixture(null);
    setCardKey('intro');
    setFlipKey(0);
    setInteractive(true);
    timerProgress.value = 1;
  }, [timerProgress]);

  // Countdown 3 → 2 → 1 → first fixture
  React.useEffect(() => {
    if (phase !== 'countdown') return;
    setInteractive(false);
    if (countdown < 1) return;
    const id = setTimeout(() => {
      if (countdown <= 1) {
        setPhase('playing');
        setIndex(0);
        setCardKey(`play-0-${Date.now()}`);
        setFlipKey((k) => k + 1);
      } else {
        setCountdown((c) => c - 1);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [countdown, phase]);

  // Celebrate correct picks as the score face flips in
  React.useEffect(() => {
    if (phase !== 'reveal' || !lastCorrect) return;
    const id = setTimeout(() => {
      fireConfetti({ count: 160, explosionSpeed: 380, fallSpeed: 2800, ttlMs: 4200 });
    }, RETRO_REVEAL_HOLD_MS);
    return () => clearTimeout(id);
  }, [fireConfetti, flipKey, lastCorrect, phase]);

  React.useEffect(() => {
    if (!confettiShot) return;
    const id = setTimeout(() => setConfettiShot(null), confettiShot.ttlMs);
    return () => clearTimeout(id);
  }, [confettiShot]);

  // Unlock swipes + run 5s timer after the promote hold/flip
  React.useEffect(() => {
    if (phase !== 'playing' && phase !== 'reveal') {
      setInteractive(phase === 'intro' || phase === 'score');
      return;
    }
    setInteractive(false);
    timerProgress.value = 1;
    const hold =
      phase === 'playing'
        ? (fromCountdown ? RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS : RETRO_PROMOTE_FLIP_DELAY_MS) +
          RETRO_PROMOTE_FLIP_MS
        : RETRO_REVEAL_HOLD_MS + RETRO_REVEAL_FLIP_MS;
    const epoch = ++timerEpoch.current;

    const unlockId = setTimeout(() => {
      if (timerEpoch.current !== epoch) return;
      setInteractive(true);
      if (phase === 'playing') {
        timerProgress.value = withTiming(0, { duration: RETRO_TIMER_MS, easing: Easing.linear });
      }
    }, hold);

    const timeoutId =
      phase === 'playing'
        ? setTimeout(() => {
            if (timerEpoch.current !== epoch) return;
            const f = fixtures[index];
            if (!f) return;
            setOutcomes((prev) => [...prev, { fixture: f, pick: null, correct: false, timedOut: true }]);
            setRevealFixture(f);
            setLastCorrect(false);
            setLastTimedOut(true);
            setPhase('reveal');
            setCardKey(`reveal-${f.id}-${Date.now()}`);
            setFlipKey((k) => k + 1);
            setInteractive(false);
            timerProgress.value = 1;
          }, hold + RETRO_TIMER_MS)
        : undefined;

    return () => {
      clearTimeout(unlockId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [cardKey, fixtures, fromCountdown, index, phase, timerProgress]);

  const pickFromSwipe = (dx: number, dy: number): RetroPick | null => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX >= SWIPE_THRESHOLD && absX > absY * 1.15) return dx > 0 ? 'A' : 'H';
    if (dy >= DRAW_THRESHOLD && dy > absX * 1.05) return 'D';
    // Button / weak swipe defaults
    if (absX >= absY) return dx >= 0 ? 'A' : 'H';
    return 'D';
  };

  const onSwipeAway = React.useCallback(
    (dx: number, dy: number) => {
      timerEpoch.current += 1;
      timerProgress.value = 1;

      if (phase === 'intro') {
        setPhase('countdown');
        setCountdown(3);
        setCardKey(`countdown-${Date.now()}`);
        setInteractive(false);
        return;
      }

      if (phase === 'playing' && fixture) {
        const pick = pickFromSwipe(dx, dy);
        const correct = resultMatchesPick(fixture, pick);
        const row: RetroRoundOutcome = { fixture, pick, correct, timedOut: false };
        setOutcomes((prev) => [...prev, row]);
        setRevealFixture(fixture);
        setLastCorrect(correct);
        setLastTimedOut(false);
        setPhase('reveal');
        setCardKey(`reveal-${fixture.id}-${Date.now()}`);
        setFlipKey((k) => k + 1);
        setInteractive(false);
        return;
      }

      if (phase === 'reveal') {
        if (lastCorrect && index < fixtures.length - 1) {
          const next = index + 1;
          setIndex(next);
          setPhase('playing');
          setCardKey(`play-${next}-${Date.now()}`);
          setFlipKey((k) => k + 1);
          setInteractive(false);
          return;
        }
        setPhase('score');
        setCardKey(`score-${Date.now()}`);
        setInteractive(true);
        if (lastCorrect && index === fixtures.length - 1) {
          fireConfetti({ count: 360, explosionSpeed: 480, fallSpeed: 3600, ttlMs: 5800 });
        }
      }
    },
    [fireConfetti, fixture, fixtures.length, index, lastCorrect, phase, timerProgress]
  );

  const commitButton = (pick: RetroPick) => {
    if (phase !== 'playing' || !interactive || !fixture) return;
    timerEpoch.current += 1;
    timerProgress.value = 1;
    const correct = resultMatchesPick(fixture, pick);
    const row: RetroRoundOutcome = { fixture, pick, correct, timedOut: false };
    setOutcomes((prev) => [...prev, row]);
    setRevealFixture(fixture);
    setLastCorrect(correct);
    setLastTimedOut(false);
    // Drive the same stack fly via a synthetic swipe direction
    // Parent advances immediately; stack needs a swipe — call onSwipeAway path by updating state
    // and bumping key. Use stack by simulating: we already advanced reveal. Trigger visual by
    // not using stack fly for buttons — just swap (acceptable) OR programmatically...
    // Keep it simple: buttons advance without fly (user asked for simple). Swipe still flies.
    setPhase('reveal');
    setCardKey(`reveal-${fixture.id}-${Date.now()}`);
    setFlipKey((k) => k + 1);
    setInteractive(false);
  };

  const shareScore = React.useCallback(async () => {
    const lines = [
      `Retro Totl Daily · ${puzzle.seasonFull}`,
      `I got ${score}/10`,
      '',
      ...outcomes.map((o) => {
        const mark = o.correct ? '✓' : '✗';
        return `${mark} ${o.fixture.homeName} ${o.fixture.homeScore}-${o.fixture.awayScore} ${o.fixture.awayName}`;
      }),
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      // ignore
    }
  }, [outcomes, puzzle.seasonFull, score]);

  const timerStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, timerProgress.value));
    return {
      transform: [{ scaleX: Math.max(0.001, p) }],
      backgroundColor: interpolateColor(p, [0, 1], ['#DC2626', '#3B82F6']),
    };
  });

  React.useEffect(() => {
    pickHighlight.value = phase === 'playing' && interactive ? 1 : 0;
    if (phase !== 'playing') {
      dragX.value = 0;
      dragY.value = 0;
    }
  }, [dragX, dragY, interactive, phase, pickHighlight]);

  const homeBtnStyle = useAnimatedStyle(() => {
    const absX = Math.abs(dragX.value);
    const absY = Math.abs(dragY.value);
    const p =
      pickHighlight.value *
      (dragX.value < 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0);
    return { backgroundColor: interpolateColor(p, [0, 1], [INACTIVE_BG, ACTIVE_BG]) };
  });

  const awayBtnStyle = useAnimatedStyle(() => {
    const absX = Math.abs(dragX.value);
    const absY = Math.abs(dragY.value);
    const p =
      pickHighlight.value *
      (dragX.value > 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0);
    return { backgroundColor: interpolateColor(p, [0, 1], [INACTIVE_BG, ACTIVE_BG]) };
  });

  const drawBtnStyle = useAnimatedStyle(() => {
    const absX = Math.abs(dragX.value);
    const absY = Math.abs(dragY.value);
    const p =
      pickHighlight.value *
      (dragY.value > 0 && absY >= absX * 1.05 ? Math.min(1, absY / 140) : 0);
    return { backgroundColor: interpolateColor(p, [0, 1], [INACTIVE_BG, ACTIVE_BG]) };
  });

  const homeTextStyle = useAnimatedStyle(() => {
    const absX = Math.abs(dragX.value);
    const absY = Math.abs(dragY.value);
    const p =
      pickHighlight.value *
      (dragX.value < 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0);
    return { color: interpolateColor(p, [0, 1], [INACTIVE_TEXT, ACTIVE_TEXT]) };
  });

  const awayTextStyle = useAnimatedStyle(() => {
    const absX = Math.abs(dragX.value);
    const absY = Math.abs(dragY.value);
    const p =
      pickHighlight.value *
      (dragX.value > 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0);
    return { color: interpolateColor(p, [0, 1], [INACTIVE_TEXT, ACTIVE_TEXT]) };
  });

  const drawTextStyle = useAnimatedStyle(() => {
    const absX = Math.abs(dragX.value);
    const absY = Math.abs(dragY.value);
    const p =
      pickHighlight.value *
      (dragY.value > 0 && absY >= absX * 1.05 ? Math.min(1, absY / 140) : 0);
    return { color: interpolateColor(p, [0, 1], [INACTIVE_TEXT, ACTIVE_TEXT]) };
  });

  const homeWrapStyle = useAnimatedStyle(() => {
    const absX = Math.abs(dragX.value);
    const absY = Math.abs(dragY.value);
    const p =
      pickHighlight.value *
      (dragX.value < 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0);
    return { transform: [{ scale: 1 + 0.05 * p }] };
  });

  const awayWrapStyle = useAnimatedStyle(() => {
    const absX = Math.abs(dragX.value);
    const absY = Math.abs(dragY.value);
    const p =
      pickHighlight.value *
      (dragX.value > 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0);
    return { transform: [{ scale: 1 + 0.05 * p }] };
  });

  const drawWrapStyle = useAnimatedStyle(() => {
    const absX = Math.abs(dragX.value);
    const absY = Math.abs(dragY.value);
    const p =
      pickHighlight.value *
      (dragY.value > 0 && absY >= absX * 1.05 ? Math.min(1, absY / 140) : 0);
    return { transform: [{ scale: 1 + 0.05 * p }] };
  });

  const playChrome = phase === 'countdown' || phase === 'playing' || phase === 'reveal';
  const revealLeadsToScore =
    phase === 'reveal' && !(lastCorrect && index < fixtures.length - 1);
  const showNext = phase !== 'score';
  const showQueued =
    phase === 'intro' ||
    phase === 'countdown' ||
    phase === 'playing' ||
    (phase === 'reveal' && !revealLeadsToScore);

  const scoreFace = (
    <RetroDailyScoreCard
      seasonLabel={puzzle.seasonFull}
      fixtures={fixtures}
      outcomes={outcomes}
      score={score}
      perfect={perfect}
      onShare={() => void shareScore()}
    />
  );

  const logoBack = <RetroDailyLogoBack seasonLabel={puzzle.seasonFull} />;

  let face: React.ReactNode = null;
  if (phase === 'intro') {
    face = <RetroDailyIntroCard seasonLabel={puzzle.seasonFull} />;
  } else if (phase === 'countdown') {
    face = <RetroDailyCountdownCard value={Math.max(1, countdown)} />;
  } else if (phase === 'playing' && fixture) {
    face = (
      <RetroDailyPromoteFlipCard
        fixture={fixture}
        flipKey={flipKey}
        holdMs={
          fromCountdown ? RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS : RETRO_PROMOTE_FLIP_DELAY_MS
        }
        backFace={fromCountdown ? <RetroDailyCountdownCard value={1} /> : logoBack}
      />
    );
  } else if (phase === 'reveal' && revealFixture) {
    face = (
      <RetroDailyRevealCard
        fixture={revealFixture}
        correct={lastCorrect}
        timedOut={lastTimedOut}
        showNextHint
        flipKey={flipKey}
      />
    );
  } else if (phase === 'score') {
    face = scoreFace;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: BG,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <RetroDailyRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <View style={{ paddingHorizontal: t.space[4], height: headerBlock, justifyContent: 'center' }}>
        <View style={{ height: 48, justifyContent: 'center', alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
            style={({ pressed }) => ({
              position: 'absolute',
              left: 0,
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons name="close" size={24} color={CHROME_WHITE} />
          </Pressable>
          <TotlText style={{ fontWeight: '900', fontSize: 18, lineHeight: 22, color: CHROME_WHITE }}>
            Retro Totl Daily
          </TotlText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scoreboard"
            onPress={openScoreboard}
            style={({ pressed }) => ({
              position: 'absolute',
              right: 0,
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'transparent',
            })}
          >
            <Ionicons name="trophy-outline" size={22} color={CHROME_WHITE} />
          </Pressable>
        </View>
      </View>

      <View style={{ height: TIMER_SLOT_H, paddingHorizontal: t.space[4], justifyContent: 'center' }}>
        {playChrome ? (
          <>
            <View style={{ height: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
              <Animated.View
                style={[
                  {
                    height: '100%',
                    width: '100%',
                    borderRadius: 999,
                    transformOrigin: 'left center',
                  },
                  timerStyle,
                ]}
              />
            </View>
            <TotlText
              style={{
                marginTop: 4,
                textAlign: 'center',
                fontSize: 12,
                lineHeight: 14,
                fontWeight: '700',
                color: 'rgba(255,255,255,0.72)',
              }}
            >
              Fixture {Math.min(index + 1, fixtures.length)} / {fixtures.length}
            </TotlText>
          </>
        ) : null}
      </View>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: t.space[4],
        }}
      >
        <RetroDailySwipeStack
          cardKey={cardKey}
          showNext={showNext}
          showQueued={showQueued}
          nextFace={
            phase === 'intro' ? (
              <RetroDailyCountdownCard value={3} />
            ) : revealLeadsToScore ? (
              scoreFace
            ) : (
              logoBack
            )
          }
          queuedFace={logoBack}
          dragX={dragX}
          dragY={dragY}
          disabled={!interactive || phase === 'countdown' || phase === 'score'}
          onSwipeAway={onSwipeAway}
        >
          {face}
        </RetroDailySwipeStack>
      </View>

      <View
        style={{
          height: BOTTOM_SLOT_H,
          paddingHorizontal: t.space[4],
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {phase === 'intro' ? (
          <View style={{ alignItems: 'center' }}>
            <Pressable
              onPress={() => setRulesOpen(true)}
              style={({ pressed }) => ({
                paddingHorizontal: 22,
                paddingVertical: 12,
                borderRadius: 999,
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderColor: CHROME_WHITE,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <TotlText style={{ fontWeight: '800', color: CHROME_WHITE }}>Rules</TotlText>
            </Pressable>
            <Pressable onPress={openScoreboard} style={{ marginTop: 10 }}>
              <TotlText style={{ fontWeight: '700', color: CHROME_WHITE, textDecorationLine: 'underline' }}>
                Scoreboard
              </TotlText>
            </Pressable>
          </View>
        ) : null}

        {playChrome ? (
          <View style={{ width: '100%', flexDirection: 'row', gap: 10 }}>
            <Animated.View style={[{ flex: 1 }, homeWrapStyle]}>
              <Pressable
                disabled={phase !== 'playing' || !interactive}
                onPress={() => commitButton('H')}
                style={({ pressed }) => ({
                  height: 56,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  opacity: phase !== 'playing' || !interactive ? 0.5 : pressed ? 0.88 : 1,
                })}
              >
                <Animated.View style={[StyleSheet.absoluteFillObject, homeBtnStyle]} />
                <Animated.Text
                  style={[{ fontWeight: '800', fontSize: 13, textAlign: 'center' }, homeTextStyle]}
                >
                  Home Win
                </Animated.Text>
              </Pressable>
            </Animated.View>

            <Animated.View style={[{ flex: 1 }, drawWrapStyle]}>
              <Pressable
                disabled={phase !== 'playing' || !interactive}
                onPress={() => commitButton('D')}
                style={({ pressed }) => ({
                  height: 56,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  opacity: phase !== 'playing' || !interactive ? 0.5 : pressed ? 0.88 : 1,
                })}
              >
                <Animated.View style={[StyleSheet.absoluteFillObject, drawBtnStyle]} />
                <Animated.Text
                  style={[{ fontWeight: '800', fontSize: 13, textAlign: 'center' }, drawTextStyle]}
                >
                  Draw
                </Animated.Text>
              </Pressable>
            </Animated.View>

            <Animated.View style={[{ flex: 1 }, awayWrapStyle]}>
              <Pressable
                disabled={phase !== 'playing' || !interactive}
                onPress={() => commitButton('A')}
                style={({ pressed }) => ({
                  height: 56,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  opacity: phase !== 'playing' || !interactive ? 0.5 : pressed ? 0.88 : 1,
                })}
              >
                <Animated.View style={[StyleSheet.absoluteFillObject, awayBtnStyle]} />
                <Animated.Text
                  style={[{ fontWeight: '800', fontSize: 13, textAlign: 'center' }, awayTextStyle]}
                >
                  Away Win
                </Animated.Text>
              </Pressable>
            </Animated.View>
          </View>
        ) : null}

        {phase === 'score' ? (
          <Pressable
            onPress={restart}
            style={({ pressed }) => ({
              height: 52,
              minWidth: 200,
              paddingHorizontal: 24,
              borderRadius: 14,
              backgroundColor: ACTIVE_BG,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <TotlText style={{ color: '#FFFFFF', fontWeight: '900' }}>Play again (test)</TotlText>
          </Pressable>
        ) : null}
      </View>

      {confettiShot ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 9999, elevation: 9999 }]}>
          <ConfettiCannon
            key={confettiShot.key}
            count={confettiShot.count}
            origin={{ x: screenWidth / 2, y: -10 }}
            explosionSpeed={confettiShot.explosionSpeed}
            fallSpeed={confettiShot.fallSpeed}
            fadeOut
          />
        </View>
      ) : null}
    </View>
  );
}
