import React from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useSharedValue } from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';

import {
  createPlayersPuzzle,
  PLAYERS_TIMER_MS,
  type PlayersClubOption,
  type PlayersPuzzle,
} from '../../lib/retroPlayers/buildPuzzle';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import type { RetroTotlDailyPlayersStackParamList } from '../../navigation/RetroTotlDailyPlayersNavigator';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import RetroDailyCountdownCard from '../../components/retroDaily/RetroDailyCountdownCard';
import RetroDailyLogoBack from '../../components/retroDaily/RetroDailyLogoBack';
import RetroDailyProgressPips from '../../components/retroDaily/RetroDailyProgressPips';
import RetroDailySwipeStack, {
  DRAW_THRESHOLD,
  SWIPE_THRESHOLD,
} from '../../components/retroDaily/RetroDailySwipeStack';
import RetroPlayersIntroCard from '../../components/retroPlayers/RetroPlayersIntroCard';
import RetroPlayersCard from '../../components/retroPlayers/RetroPlayersCard';
import RetroPlayersPromoteFlipCard, {
  RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS,
  RETRO_PROMOTE_FLIP_DELAY_MS,
  RETRO_PROMOTE_FLIP_MS,
} from '../../components/retroPlayers/RetroPlayersPromoteFlipCard';
import RetroPlayersRevealCard, {
  PLAYERS_REVEAL_FLIP_MS,
  PLAYERS_REVEAL_HOLD_MS,
  type PlayersRoundOutcome,
} from '../../components/retroPlayers/RetroPlayersRevealCard';
import RetroPlayersScoreCard, { playersScoreBlurb } from '../../components/retroPlayers/RetroPlayersScoreCard';
import RetroPlayersRulesSheet from '../../components/retroPlayers/RetroPlayersRulesSheet';

type Phase = 'intro' | 'countdown' | 'playing' | 'reveal' | 'score';

const BG = '#0B1F3A';
const CHROME_WHITE = '#FFFFFF';
const ACTIVE_BG = '#1C8376';
const BOTTOM_SLOT_H = 148;

/** Left / down / right → options[0] / [1] / [2] — same thresholds as fixtures H/D/A. */
function optionFromSwipe(
  dx: number,
  dy: number,
  options: PlayersClubOption[]
): PlayersClubOption | null {
  if (options.length === 0) return null;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const left = options[0]!;
  const mid = options[1] ?? left;
  const right = options[2] ?? mid;
  if (absX >= SWIPE_THRESHOLD && absX > absY * 1.15) return dx > 0 ? right : left;
  if (dy >= DRAW_THRESHOLD && dy > absX * 1.05) return mid;
  if (absX >= absY) return dx >= 0 ? right : left;
  return mid;
}

/**
 * Retro Totl Daily — The Players (admin prototype).
 * Matches web: player + season clue, three clubs, streak auto-advance.
 */
export default function RetroTotlDailyPlayersScreen() {
  const t = useTokens();
  const navigation = useNavigation<NativeStackNavigationProp<RetroTotlDailyPlayersStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [puzzle, setPuzzle] = React.useState<PlayersPuzzle>(() => createPlayersPuzzle());
  const cards = puzzle.cards;
  const [phase, setPhase] = React.useState<Phase>('intro');
  const [index, setIndex] = React.useState(0);
  const [countdown, setCountdown] = React.useState(3);
  const [outcomes, setOutcomes] = React.useState<PlayersRoundOutcome[]>([]);
  const [lastCorrect, setLastCorrect] = React.useState(false);
  const [lastTimedOut, setLastTimedOut] = React.useState(false);
  const [revealCard, setRevealCard] = React.useState<(typeof cards)[0] | null>(null);
  const [timerPct, setTimerPct] = React.useState(1);
  const [interactive, setInteractive] = React.useState(true);
  const [cardKey, setCardKey] = React.useState('intro');
  const [flipKey, setFlipKey] = React.useState(0);
  const [flyAwayNonce, setFlyAwayNonce] = React.useState(0);
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [hotCode, setHotCode] = React.useState<string | null>(null);
  const [dragSnap, setDragSnap] = React.useState({ x: 0, y: 0 });
  const [confettiShot, setConfettiShot] = React.useState<{
    key: number;
    count: number;
    explosionSpeed: number;
    fallSpeed: number;
    ttlMs: number;
  } | null>(null);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const timerEpoch = React.useRef(0);
  const timerRaf = React.useRef<number | null>(null);
  const phaseRef = React.useRef(phase);
  const interactiveRef = React.useRef(interactive);
  const cardRef = React.useRef(cards[0] ?? null);
  const indexRef = React.useRef(0);
  const lastCorrectRef = React.useRef(false);
  const cardsLenRef = React.useRef(cards.length);
  phaseRef.current = phase;
  interactiveRef.current = interactive;
  cardRef.current = cards[index] ?? null;
  indexRef.current = index;
  lastCorrectRef.current = lastCorrect;
  cardsLenRef.current = cards.length;

  const card = cards[index] ?? null;
  const score = outcomes.filter((o) => o.correct).length;
  const perfect =
    score === cards.length && outcomes.length === cards.length && outcomes.every((o) => o.correct);
  const fromCountdown = cardKey.startsWith('play-0-') && !cardKey.includes('-instant-');
  const fromInstant = cardKey.includes('-instant-');
  const revealContinues = lastCorrect && index < cards.length - 1;
  const revealLeadsToScore = phase === 'reveal' && !revealContinues;
  const nextCard = revealContinues ? cards[index + 1] ?? null : null;
  const showNext = phase !== 'score';
  const showQueued =
    phase === 'intro' ||
    phase === 'countdown' ||
    phase === 'playing' ||
    (phase === 'reveal' && !revealLeadsToScore);
  const headerBlock = 56;

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

  const close = React.useCallback(() => {
    const parent = navigation.getParent?.() as
      | { canGoBack?: () => boolean; goBack?: () => void; navigate?: (name: string, params?: object) => void }
      | undefined;
    if (parent?.canGoBack?.()) {
      parent.goBack?.();
      return;
    }
    if (typeof (navigation as { canGoBack?: () => boolean }).canGoBack === 'function' &&
      (navigation as { canGoBack: () => boolean }).canGoBack()) {
      (navigation as { goBack: () => void }).goBack();
      return;
    }
    parent?.navigate?.('Tabs', { screen: 'Profile' });
  }, [navigation]);

  const openScoreboard = React.useCallback(() => {
    navigation.navigate('RetroTotlDailyPlayersScoreboard');
  }, [navigation]);

  const restart = React.useCallback(() => {
    timerEpoch.current += 1;
    if (timerRaf.current != null) cancelAnimationFrame(timerRaf.current);
    setPuzzle(createPlayersPuzzle());
    setPhase('intro');
    setIndex(0);
    setCountdown(3);
    setOutcomes([]);
    setLastCorrect(false);
    setLastTimedOut(false);
    setRevealCard(null);
    setTimerPct(1);
    setInteractive(true);
    setCardKey('intro');
    setFlipKey(0);
    setHotCode(null);
    setDragSnap({ x: 0, y: 0 });
    dragX.value = 0;
    dragY.value = 0;
  }, [dragX, dragY]);

  const startFromIntro = React.useCallback(() => {
    if (phaseRef.current !== 'intro') return;
    setFlyAwayNonce((n) => n + 1);
  }, []);

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
    if (phase !== 'reveal' || !lastCorrect) return;
    const id = setTimeout(() => {
      fireConfetti({ count: 90, explosionSpeed: 340, fallSpeed: 2200, ttlMs: 2800 });
    }, PLAYERS_REVEAL_HOLD_MS);
    return () => clearTimeout(id);
  }, [fireConfetti, flipKey, lastCorrect, phase]);

  React.useEffect(() => {
    if (phase !== 'playing' && phase !== 'reveal') {
      setInteractive(phase === 'intro' || phase === 'score');
      setTimerPct(1);
      return;
    }

    setInteractive(false);
    setTimerPct(1);
    setHotCode(null);
    setDragSnap({ x: 0, y: 0 });
    const hold =
      phase === 'playing'
        ? fromInstant
          ? 280
          : (fromCountdown ? RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS : RETRO_PROMOTE_FLIP_DELAY_MS) +
            RETRO_PROMOTE_FLIP_MS
        : PLAYERS_REVEAL_HOLD_MS + PLAYERS_REVEAL_FLIP_MS;
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
          const left = Math.max(0, 1 - elapsed / PLAYERS_TIMER_MS);
          setTimerPct(left);
          if (left <= 0) return;
          timerRaf.current = requestAnimationFrame(tick);
        };
        timerRaf.current = requestAnimationFrame(tick);
        return;
      }
      if (phase === 'reveal' && !(lastCorrectRef.current && indexRef.current < cardsLenRef.current - 1)) {
        setInteractive(true);
      }
    }, hold);

    const timeoutId = isPlaying
      ? setTimeout(() => {
          if (timerEpoch.current !== epoch) return;
          const c = cards[index];
          if (!c) return;
          setOutcomes((prev) => [...prev, { card: c, pick: null, correct: false, timedOut: true }]);
          setRevealCard(c);
          setLastCorrect(false);
          setLastTimedOut(true);
          setPhase('reveal');
          setCardKey(`reveal-${c.id}-${Date.now()}`);
          setFlipKey((k) => k + 1);
          setInteractive(false);
          setTimerPct(1);
        }, hold + PLAYERS_TIMER_MS)
      : undefined;

    return () => {
      clearTimeout(unlockId);
      if (timeoutId) clearTimeout(timeoutId);
      if (timerRaf.current != null) cancelAnimationFrame(timerRaf.current);
      // Don't bump timerEpoch here — that races the next unlock after streak fly-away.
    };
  }, [cardKey, cards, fromCountdown, fromInstant, index, phase]);

  // Mirror SharedValue drag into React state for button highlight
  React.useEffect(() => {
    if (phase !== 'playing' || !interactive) {
      setDragSnap({ x: 0, y: 0 });
      return;
    }
    const id = setInterval(() => {
      setDragSnap({ x: dragX.value, y: dragY.value });
    }, 32);
    return () => clearInterval(id);
  }, [dragX, dragY, interactive, phase]);

  const commitPick = React.useCallback((pick: PlayersClubOption) => {
    if (phaseRef.current !== 'playing' || !interactiveRef.current) return;
    const c = cardRef.current;
    if (!c) return;
    timerEpoch.current += 1;
    if (timerRaf.current != null) cancelAnimationFrame(timerRaf.current);
    const correct = pick.clubCode === c.correct.clubCode;
    setOutcomes((prev) => [...prev, { card: c, pick, correct, timedOut: false }]);
    setRevealCard(c);
    setLastCorrect(correct);
    setLastTimedOut(false);
    setPhase('reveal');
    setCardKey(`reveal-${c.id}-${Date.now()}`);
    setFlipKey((k) => k + 1);
    setInteractive(false);
    setTimerPct(1);
    setHotCode(null);
    setDragSnap({ x: 0, y: 0 });
    dragX.value = 0;
    dragY.value = 0;
  }, [dragX, dragY]);

  const advanceFromReveal = React.useCallback(
    (opts?: { instant?: boolean }) => {
      timerEpoch.current += 1;
      setHotCode(null);
      setDragSnap({ x: 0, y: 0 });
      dragX.value = 0;
      dragY.value = 0;
      if (lastCorrectRef.current && indexRef.current < cardsLenRef.current - 1) {
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
      if (lastCorrectRef.current && indexRef.current === cardsLenRef.current - 1) {
        fireConfetti({ count: 280, explosionSpeed: 480, fallSpeed: 3600, ttlMs: 5800 });
      }
    },
    [dragX, dragY, fireConfetti]
  );

  const swipeToNext = React.useCallback(() => {
    setFlyAwayNonce((n) => n + 1);
  }, []);

  const onSwipeAway = React.useCallback(
    (dx: number, dy: number) => {
      timerEpoch.current += 1;
      setDragSnap({ x: 0, y: 0 });
      setHotCode(null);
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
        const c = cardRef.current;
        if (!c) return;
        const pick = optionFromSwipe(dx, dy, c.options);
        if (pick) commitPick(pick);
        return;
      }

      if (p === 'reveal') {
        advanceFromReveal({ instant: true });
        return;
      }

      if (p === 'score') {
        restart();
      }
    },
    [advanceFromReveal, commitPick, dragX, dragY, restart]
  );

  const timerRunning = phase === 'playing' && interactive;
  const secondsLeft = timerRunning ? Math.max(1, Math.ceil(timerPct * 10)) : 10;
  const pipTimerPct = timerRunning ? timerPct : 1;
  const scoreBlurb = playersScoreBlurb(score, cards.length, perfect);
  const logoBack = <RetroDailyLogoBack seasonLabel="The Players" />;
  const scoreFace = (
    <RetroPlayersScoreCard cards={cards} outcomes={outcomes} score={score} perfect={perfect} />
  );

  let face: React.ReactNode = null;
  if (phase === 'intro') {
    face = <RetroPlayersIntroCard />;
  } else if (phase === 'countdown') {
    face = <RetroDailyCountdownCard value={Math.max(1, countdown)} />;
  } else if (phase === 'playing' && card) {
    face = fromInstant ? (
      <RetroPlayersCard card={card} />
    ) : (
      <RetroPlayersPromoteFlipCard
        card={card}
        flipKey={flipKey}
        holdMs={fromCountdown ? RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS : RETRO_PROMOTE_FLIP_DELAY_MS}
        backFace={fromCountdown ? <RetroDailyCountdownCard value={1} /> : undefined}
      />
    );
  } else if (phase === 'reveal' && revealCard) {
    face = (
      <RetroPlayersRevealCard
        card={revealCard}
        correct={lastCorrect}
        timedOut={lastTimedOut}
        flipKey={flipKey}
        autoContinue={revealContinues}
        swipeReady={interactive}
        onAutoAdvance={swipeToNext}
      />
    );
  } else if (phase === 'score') {
    face = scoreFace;
  } else {
    face = logoBack;
  }

  const absX = Math.abs(dragSnap.x);
  const absY = Math.abs(dragSnap.y);
  const highlightLeft =
    phase === 'playing' && interactive && dragSnap.x < 0 && absX >= absY * 1.15 && absX > 30;
  const highlightMid =
    phase === 'playing' && interactive && dragSnap.y > 0 && absY >= absX * 1.05 && absY > 30;
  const highlightRight =
    phase === 'playing' && interactive && dragSnap.x > 0 && absX >= absY * 1.15 && absX > 30;

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
      <RetroPlayersRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />

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
                fontSize: 13,
                lineHeight: 18,
                color: CHROME_WHITE,
              }}
            >
              The Players
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
          seasonLabel="The Players"
          showNext={showNext}
          showQueued={showQueued}
          flyAwayNonce={flyAwayNonce}
          tapAdvances={phase === 'intro' || (phase === 'reveal' && !revealContinues)}
          nextFace={
            phase === 'intro' ? (
              <RetroDailyCountdownCard value={3} />
            ) : revealLeadsToScore ? (
              scoreFace
            ) : revealContinues && nextCard ? (
              <RetroPlayersCard card={nextCard} />
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
            <Pressable
              onPress={startFromIntro}
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
              <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 16 }}>Start</TotlText>
            </Pressable>
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
                <TotlText style={{ fontWeight: '800', color: 'rgba(255,255,255,0.9)' }}>
                  Scoreboard
                </TotlText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {phase === 'reveal' && !revealContinues && interactive ? (
          <Pressable
            onPress={() => advanceFromReveal({ instant: true })}
            style={({ pressed }) => ({
              height: 52,
              width: '100%',
              marginBottom: 10,
              borderRadius: 16,
              backgroundColor: ACTIVE_BG,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 16 }}>See score</TotlText>
          </Pressable>
        ) : null}

        {phase === 'playing' ? (
          <View style={{ width: '100%', gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(card?.options ?? []).map((opt, i) => {
                const dragHot =
                  (i === 0 && highlightLeft) ||
                  (i === 1 && highlightMid) ||
                  (i === 2 && highlightRight);
                const hot = dragHot || hotCode === opt.clubCode;
                const badge = TEAM_BADGES[normalizeTeamCode(opt.clubCode)] ?? null;
                return (
                  <Pressable
                    key={opt.clubCode}
                    disabled={!interactive}
                    onPress={() => commitPick(opt)}
                    onPressIn={() => setHotCode(opt.clubCode)}
                    onPressOut={() => setHotCode(null)}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: 68,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      paddingHorizontal: 4,
                      backgroundColor: hot ? ACTIVE_BG : 'rgba(255,255,255,0.2)',
                      transform: [{ scale: hot ? 1.03 : 1 }],
                      opacity: !interactive ? 0.5 : pressed ? 0.88 : 1,
                    })}
                  >
                    {badge ? (
                      <Image source={badge} style={{ width: 28, height: 28 }} resizeMode="contain" />
                    ) : null}
                    <TotlText
                      style={{
                        color: '#FFFFFF',
                        fontWeight: '800',
                        fontSize: 11,
                        textAlign: 'center',
                        lineHeight: 13,
                      }}
                      numberOfLines={2}
                    >
                      {opt.clubName}
                    </TotlText>
                  </Pressable>
                );
              })}
            </View>
            <RetroDailyProgressPips
              total={cards.length}
              completed={outcomes.length}
              current={index}
              mode="countdown"
              secondsLeft={secondsLeft}
              timerPct={pipTimerPct}
            />
          </View>
        ) : null}

        {phase === 'reveal' ? (
          <RetroDailyProgressPips
            total={cards.length}
            completed={outcomes.length}
            current={index}
            mode="progress"
            secondsLeft={secondsLeft}
            timerPct={1}
          />
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
              total={cards.length}
              completed={outcomes.length}
              current={Math.max(0, outcomes.length - 1)}
              mode="results"
              results={cards.map((c) => {
                const o = outcomes.find((x) => x.card.id === c.id);
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
