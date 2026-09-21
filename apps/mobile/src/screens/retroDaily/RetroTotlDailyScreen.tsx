import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import ConfettiCannon from 'react-native-confetti-cannon';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';

import {
  createMockRetroPuzzle,
  RETRO_TIMER_MS,
  type RetroFixture,
  type RetroPick,
  type RetroPuzzle,
} from '../../lib/retroDaily/mockPuzzle';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import type { RetroTotlDailyStackParamList } from '../../navigation/RetroTotlDailyNavigator';
import RetroDailyIntroCard from '../../components/retroDaily/RetroDailyIntroCard';
import RetroDailyCountdownCard from '../../components/retroDaily/RetroDailyCountdownCard';
import RetroDailyFixtureCard from '../../components/retroDaily/RetroDailyFixtureCard';
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
import RetroDailyScoreCard, {
  retroScoreBlurb,
  type RetroRoundOutcome,
} from '../../components/retroDaily/RetroDailyScoreCard';
import RetroDailyRulesSheet from '../../components/retroDaily/RetroDailyRulesSheet';
import RetroDailyProgressPips from '../../components/retroDaily/RetroDailyProgressPips';
import RetroDailySwipeStack, {
  DRAW_THRESHOLD,
  SWIPE_THRESHOLD,
} from '../../components/retroDaily/RetroDailySwipeStack';

type Phase = 'intro' | 'countdown' | 'playing' | 'reveal' | 'score';

const BG = '#0B1F3A';
const CHROME_WHITE = '#FFFFFF';
const ACTIVE_BG = '#1C8376';
const INACTIVE_BG = 'rgba(255,255,255,0.22)';
const BOTTOM_SLOT_H = 128;

/**
 * Admin prototype: Retro Totl Daily — fixtures.
 * Shell matches web: ProgressPips, streak auto-advance, promote timings.
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
  const [flyAwayNonce, setFlyAwayNonce] = React.useState(0);
  const [interactive, setInteractive] = React.useState(true);
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [timerPct, setTimerPct] = React.useState(1);
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

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pickHighlight = useSharedValue(0);
  const timerEpoch = React.useRef(0);
  const timerRaf = React.useRef<number | null>(null);
  const phaseRef = React.useRef(phase);
  const interactiveRef = React.useRef(interactive);
  const fixtureRef = React.useRef(fixtures[0] ?? null);
  const indexRef = React.useRef(0);
  const lastCorrectRef = React.useRef(false);
  const fixturesLenRef = React.useRef(fixtures.length);
  phaseRef.current = phase;
  interactiveRef.current = interactive;
  fixtureRef.current = fixtures[index] ?? null;
  indexRef.current = index;
  lastCorrectRef.current = lastCorrect;
  fixturesLenRef.current = fixtures.length;

  const fixture = fixtures[index] ?? null;
  const score = outcomes.filter((o) => o.correct).length;
  const perfect =
    score === fixtures.length &&
    outcomes.length === fixtures.length &&
    outcomes.every((o) => o.correct);
  const fromCountdown = cardKey.startsWith('play-0-') && !cardKey.includes('-instant-');
  const fromInstant = cardKey.includes('-instant-');
  const revealContinues = lastCorrect && index < fixtures.length - 1;
  const revealLeadsToScore = phase === 'reveal' && !revealContinues;
  const nextFixture = revealContinues ? fixtures[index + 1] ?? null : null;
  const showNext = phase !== 'score';
  const showQueued =
    phase === 'intro' ||
    phase === 'countdown' ||
    phase === 'playing' ||
    (phase === 'reveal' && !revealLeadsToScore);
  const playChrome = phase === 'countdown' || phase === 'playing' || phase === 'reveal';
  const headerBlock = 56;

  const close = React.useCallback(() => {
    const parent = navigation.getParent?.();
    if (parent?.canGoBack?.()) parent.goBack();
    else if (navigation.canGoBack?.()) navigation.goBack();
    else parent?.navigate?.('Tabs', { screen: 'Profile' });
  }, [navigation]);

  const openScoreboard = React.useCallback(() => {
    navigation.navigate('RetroTotlDailyScoreboard');
  }, [navigation]);

  const openPlayers = React.useCallback(() => {
    const parent = navigation.getParent?.() as { navigate?: (name: string) => void } | undefined;
    parent?.navigate?.('RetroTotlDailyPlayersFlow');
  }, [navigation]);

  const restart = React.useCallback(() => {
    timerEpoch.current += 1;
    if (timerRaf.current != null) cancelAnimationFrame(timerRaf.current);
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
    setTimerPct(1);
    dragX.value = 0;
    dragY.value = 0;
  }, [dragX, dragY]);

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

  React.useEffect(() => {
    if (!confettiShot) return;
    const id = setTimeout(() => setConfettiShot(null), confettiShot.ttlMs);
    return () => clearTimeout(id);
  }, [confettiShot]);

  React.useEffect(() => {
    if (phase !== 'playing' && phase !== 'reveal') {
      setInteractive(phase === 'intro' || phase === 'score');
      setTimerPct(1);
      return;
    }

    setInteractive(false);
    setTimerPct(1);
    const hold =
      phase === 'playing'
        ? fromInstant
          ? 280
          : (fromCountdown ? RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS : RETRO_PROMOTE_FLIP_DELAY_MS) +
            RETRO_PROMOTE_FLIP_MS
        : RETRO_REVEAL_HOLD_MS + RETRO_REVEAL_FLIP_MS;
    const epoch = ++timerEpoch.current;
    const isPlaying = phase === 'playing';

    const unlockId = setTimeout(() => {
      if (timerEpoch.current !== epoch) return;
      if (isPlaying) {
        setInteractive(true);
        const started = performance.now();
        const tick = (now: number) => {
          if (timerEpoch.current !== epoch) return;
          const elapsed = now - started;
          const left = Math.max(0, 1 - elapsed / RETRO_TIMER_MS);
          setTimerPct(left);
          if (left <= 0) return;
          timerRaf.current = requestAnimationFrame(tick);
        };
        timerRaf.current = requestAnimationFrame(tick);
        return;
      }
      if (phase === 'reveal' && !(lastCorrectRef.current && indexRef.current < fixturesLenRef.current - 1)) {
        setInteractive(true);
      }
    }, hold);

    const timeoutId = isPlaying
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
          setTimerPct(1);
        }, hold + RETRO_TIMER_MS)
      : undefined;

    return () => {
      clearTimeout(unlockId);
      if (timeoutId) clearTimeout(timeoutId);
      if (timerRaf.current != null) cancelAnimationFrame(timerRaf.current);
      // Don't bump timerEpoch here — that races the next unlock after streak fly-away.
    };
  }, [cardKey, fixtures, fromCountdown, fromInstant, index, phase]);

  const pickFromSwipe = (dx: number, dy: number): RetroPick => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX >= SWIPE_THRESHOLD && absX > absY * 1.15) return dx > 0 ? 'A' : 'H';
    if (dy >= DRAW_THRESHOLD && dy > absX * 1.05) return 'D';
    if (absX >= absY) return dx >= 0 ? 'A' : 'H';
    return 'D';
  };

  const advanceFromReveal = React.useCallback((opts?: { instant?: boolean }) => {
    timerEpoch.current += 1;
    dragX.value = 0;
    dragY.value = 0;
    if (lastCorrectRef.current && indexRef.current < fixturesLenRef.current - 1) {
      const next = indexRef.current + 1;
      setIndex(next);
      setPhase('playing');
      setCardKey(opts?.instant ? `play-${next}-instant-${Date.now()}` : `play-${next}-${Date.now()}`);
      if (!opts?.instant) setFlipKey((k) => k + 1);
      setInteractive(false);
      return;
    }
    setPhase('score');
    setCardKey(`score-${Date.now()}`);
    setInteractive(true);
    if (lastCorrectRef.current && indexRef.current === fixturesLenRef.current - 1) {
      fireConfetti({ count: 280, explosionSpeed: 480, fallSpeed: 3600, ttlMs: 5800 });
    }
  }, [dragX, dragY, fireConfetti]);

  const swipeToNextFixture = React.useCallback(() => {
    setFlyAwayNonce((n) => n + 1);
  }, []);

  const onSwipeAway = React.useCallback(
    (dx: number, dy: number) => {
      timerEpoch.current += 1;
      dragX.value = 0;
      dragY.value = 0;
      const p = phaseRef.current;

      if (p === 'intro') {
        setPhase('countdown');
        setCountdown(3);
        setCardKey(`countdown-${Date.now()}`);
        setInteractive(false);
        return;
      }

      if (p === 'playing') {
        const f = fixtureRef.current;
        if (!f) return;
        const pick = pickFromSwipe(dx, dy);
        const correct = resultMatchesPick(f, pick);
        setOutcomes((prev) => [...prev, { fixture: f, pick, correct, timedOut: false }]);
        setRevealFixture(f);
        setLastCorrect(correct);
        setLastTimedOut(false);
        setPhase('reveal');
        setCardKey(`reveal-${f.id}-${Date.now()}`);
        setFlipKey((k) => k + 1);
        setInteractive(false);
        setTimerPct(1);
        return;
      }

      if (p === 'reveal') {
        if (lastCorrectRef.current && indexRef.current < fixturesLenRef.current - 1) {
          advanceFromReveal({ instant: true });
          return;
        }
        setPhase('score');
        setCardKey(`score-${Date.now()}`);
        setInteractive(true);
        if (lastCorrectRef.current && indexRef.current === fixturesLenRef.current - 1) {
          fireConfetti({ count: 280, explosionSpeed: 480, fallSpeed: 3600, ttlMs: 5800 });
        }
      }
    },
    [advanceFromReveal, dragX, dragY, fireConfetti]
  );

  const commitPick = React.useCallback(
    (pick: RetroPick) => {
      if (phase !== 'playing' || !interactive || !fixture) return;
      timerEpoch.current += 1;
      const correct = resultMatchesPick(fixture, pick);
      setOutcomes((prev) => [...prev, { fixture, pick, correct, timedOut: false }]);
      setRevealFixture(fixture);
      setLastCorrect(correct);
      setLastTimedOut(false);
      setPhase('reveal');
      setCardKey(`reveal-${fixture.id}-${Date.now()}`);
      setFlipKey((k) => k + 1);
      setInteractive(false);
      setTimerPct(1);
      dragX.value = 0;
      dragY.value = 0;
    },
    [dragX, dragY, fixture, interactive, phase]
  );

  React.useEffect(() => {
    pickHighlight.value = phase === 'playing' && interactive ? 1 : 0;
    if (phase !== 'playing') {
      dragX.value = 0;
      dragY.value = 0;
    }
  }, [dragX, dragY, interactive, phase, pickHighlight]);

  const mkBtnStyle = (side: 'H' | 'D' | 'A') =>
    useAnimatedStyle(() => {
      const absX = Math.abs(dragX.value);
      const absY = Math.abs(dragY.value);
      let hot = 0;
      if (side === 'H') {
        hot = dragX.value < 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0;
      } else if (side === 'A') {
        hot = dragX.value > 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0;
      } else {
        hot = dragY.value > 0 && absY >= absX * 1.05 ? Math.min(1, absY / 140) : 0;
      }
      const p = pickHighlight.value * hot;
      return { backgroundColor: interpolateColor(p, [0, 1], [INACTIVE_BG, ACTIVE_BG]) };
    });

  const homeBtnStyle = mkBtnStyle('H');
  const drawBtnStyle = mkBtnStyle('D');
  const awayBtnStyle = mkBtnStyle('A');

  const timerRunning = phase === 'playing' && interactive;
  const secondsLeft = timerRunning ? Math.max(1, Math.ceil(timerPct * 10)) : 10;
  const pipTimerPct = timerRunning ? timerPct : 1;
  const scoreBlurb = retroScoreBlurb(score, fixtures.length, perfect);
  const logoBack = <RetroDailyLogoBack seasonLabel={puzzle.seasonFull} />;
  const scoreFace = (
    <RetroDailyScoreCard
      seasonLabel={puzzle.seasonFull}
      fixtures={fixtures}
      outcomes={outcomes}
      score={score}
      perfect={perfect}
    />
  );

  let face: React.ReactNode = null;
  if (phase === 'intro') {
    face = <RetroDailyIntroCard seasonLabel={puzzle.seasonFull} />;
  } else if (phase === 'countdown') {
    face = <RetroDailyCountdownCard value={Math.max(1, countdown)} />;
  } else if (phase === 'playing' && fixture) {
    face = fromInstant ? (
      <RetroDailyFixtureCard fixture={fixture} />
    ) : (
      <RetroDailyPromoteFlipCard
        fixture={fixture}
        flipKey={flipKey}
        holdMs={fromCountdown ? RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS : RETRO_PROMOTE_FLIP_DELAY_MS}
        backFace={fromCountdown ? <RetroDailyCountdownCard value={1} /> : logoBack}
      />
    );
  } else if (phase === 'reveal' && revealFixture) {
    face = (
      <RetroDailyRevealCard
        fixture={revealFixture}
        correct={lastCorrect}
        timedOut={lastTimedOut}
        flipKey={flipKey}
        autoContinue={revealContinues}
        swipeReady={interactive}
        onAutoAdvance={swipeToNextFixture}
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
          <View style={{ alignItems: 'center', paddingHorizontal: 48 }}>
            <TotlText style={{ fontWeight: '900', fontSize: 14, lineHeight: 18, color: CHROME_WHITE }}>
              Retro Totl Daily
            </TotlText>
            <TotlText
              style={{
                marginTop: 4,
                fontFamily: RETRO_PIXEL_FONT,
                fontSize: 14,
                lineHeight: 18,
                color: CHROME_WHITE,
              }}
            >
              {puzzle.seasonFull}
            </TotlText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scoreboard"
            onPress={openScoreboard}
            style={({ pressed }) => ({
              position: 'absolute',
              right: 0,
              paddingVertical: 6,
              paddingHorizontal: 4,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <TotlText style={{ fontWeight: '800', fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>
              Scoreboard
            </TotlText>
          </Pressable>
        </View>
      </View>

      {phase === 'score' ? (
        <TotlText
          style={{
            paddingHorizontal: t.space[4],
            marginBottom: 8,
            textAlign: 'center',
            fontWeight: '800',
            fontSize: 14,
            lineHeight: 18,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          {scoreBlurb}
        </TotlText>
      ) : null}

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
          seasonLabel={puzzle.seasonFull}
          showNext={showNext}
          showQueued={showQueued}
          flyAwayNonce={flyAwayNonce}
          nextFace={
            phase === 'intro' ? (
              <RetroDailyCountdownCard value={3} />
            ) : revealLeadsToScore ? (
              scoreFace
            ) : revealContinues && nextFixture ? (
              <RetroDailyFixtureCard fixture={nextFixture} />
            ) : (
              logoBack
            )
          }
          queuedFace={logoBack}
          dragX={dragX}
          dragY={dragY}
          disabled={
            !interactive ||
            phase === 'countdown' ||
            phase === 'score' ||
            (phase === 'reveal' && revealContinues)
          }
          tapAdvances={phase === 'intro' || (phase === 'reveal' && !revealContinues)}
          onSwipeAway={onSwipeAway}
        >
          {face}
        </RetroDailySwipeStack>
      </View>

      <View
        style={{
          minHeight: BOTTOM_SLOT_H,
          paddingHorizontal: t.space[4],
          paddingBottom: 8,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {phase === 'intro' ? (
          <View style={{ width: '100%', alignItems: 'center', gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setRulesOpen(true)}
                style={({ pressed }) => ({
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: CHROME_WHITE,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <TotlText style={{ fontWeight: '800', color: CHROME_WHITE }}>Rules</TotlText>
              </Pressable>
              <Pressable
                onPress={openScoreboard}
                style={({ pressed }) => ({
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: 'rgba(255,255,255,0.5)',
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <TotlText style={{ fontWeight: '800', color: 'rgba(255,255,255,0.9)' }}>Scoreboard</TotlText>
              </Pressable>
            </View>
            <Pressable
              onPress={openPlayers}
              style={({ pressed }) => ({
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: ACTIVE_BG,
                backgroundColor: 'rgba(28,131,118,0.25)',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <TotlText style={{ fontWeight: '800', color: CHROME_WHITE }}>The Players</TotlText>
            </Pressable>
          </View>
        ) : null}

        {playChrome ? (
          <View style={{ width: '100%', gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(
                [
                  ['H', 'Home Win', homeBtnStyle],
                  ['D', 'Draw', drawBtnStyle],
                  ['A', 'Away Win', awayBtnStyle],
                ] as const
              ).map(([pick, label, btnStyle]) => (
                <Pressable
                  key={pick}
                  disabled={phase !== 'playing' || !interactive}
                  onPress={() => commitPick(pick)}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 52,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    opacity: phase !== 'playing' || !interactive ? 0.5 : pressed ? 0.88 : 1,
                  })}
                >
                  <Animated.View style={[StyleSheet.absoluteFillObject, btnStyle]} />
                  <TotlText style={{ fontWeight: '800', fontSize: 13, color: '#FFFFFF' }}>{label}</TotlText>
                </Pressable>
              ))}
            </View>
            <RetroDailyProgressPips
              total={fixtures.length}
              completed={outcomes.length}
              current={index}
              mode={phase === 'playing' ? 'countdown' : 'progress'}
              secondsLeft={secondsLeft}
              timerPct={pipTimerPct}
            />
          </View>
        ) : null}

        {phase === 'score' ? (
          <View style={{ width: '100%', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={restart}
              style={({ pressed }) => ({
                height: 52,
                width: '100%',
                borderRadius: 16,
                backgroundColor: ACTIVE_BG,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <TotlText style={{ color: '#FFFFFF', fontWeight: '900' }}>Play again</TotlText>
            </Pressable>
            <RetroDailyProgressPips
              total={fixtures.length}
              completed={outcomes.length}
              current={Math.max(0, outcomes.length - 1)}
              mode="results"
              results={fixtures.map((f) => {
                const o = outcomes.find((x) => x.fixture.id === f.id);
                if (!o) return 'pending';
                return o.correct ? 'correct' : 'wrong';
              })}
            />
          </View>
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
