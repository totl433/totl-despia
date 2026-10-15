import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { TotlText } from '@totl/ui';

import { createPlayersPuzzle, PLAYERS_TIMER_MS, type PlayersClubOption, type PlayersPuzzle } from '../../lib/retroPlayers/buildPuzzle';
import { msUntilNextPlayersDay, playersDayKey, playersDaySeed, playersNextGameLine } from '../../lib/retroPlayers/day';
import { loadPlayerClubApps } from '../../lib/retroPlayers/loadPlayerClubApps';
import { playersDayAlreadySaved, readPlayersScores, savePlayersDayScore } from '../../lib/retroPlayers/scores';
import type { PlayerClubApp } from '../../lib/retroPlayers/seedApps';
import { isShareCancelled, shareCapturedImage } from '../../lib/shareToSocial';
import type { RetroTotlDailyPlayersStackParamList } from '../../navigation/RetroTotlDailyPlayersNavigator';
import RetroDailySwipeStack, {
  DRAW_THRESHOLD,
  SWIPE_THRESHOLD,
} from '../../components/retroDaily/RetroDailySwipeStack';
import type { PlayersRoundOutcome } from '../../components/retroPlayers/RetroPlayersRevealCard';
import RetroPlayersRulesSheet from '../../components/retroPlayers/RetroPlayersRulesSheet';
import PlayersReview from '../../components/retroPlayers/PlayersReview';
import {
  PlayersBackFace,
  PlayersCountdownFace,
  PlayersFinishedFace,
  PlayersFlipIn,
  PlayersIntroFace,
  PlayersQuestionFace,
  PlayersRevealFace,
} from '../../components/retroPlayers/PlayersFaces';
import { PlayersAnswerTiles, PlayersButton, PlayersTextLink } from '../../components/retroPlayers/PlayersControls';
import PlayersProgressDots, { type PlayersDotState } from '../../components/retroPlayers/PlayersProgressDots';
import {
  PLAYERS_CARD,
  PLAYERS_COLORS,
  PLAYERS_FONTS,
  PlayersCardScale,
} from '../../components/retroPlayers/playersTheme';

type Phase = 'intro' | 'countdown' | 'playing' | 'reveal' | 'score';

const COUNTDOWN = ['3', '2', '1', 'GO!'] as const;
const COUNTDOWN_STEP_MS = 1000;
/** GO! holds, the navy slides in, then the card flips to question one, then the answers rise. */
const GO_HOLD_MS = 800;
const BG_SLIDE_MS = 750;
const FIRST_FLIP_DELAY_MS = 650;
const FIRST_FLIP_MS = 850;
const FLIP_MS = 600;
const TILES_RISE_DELAY_MS = FIRST_FLIP_DELAY_MS + FIRST_FLIP_MS * 0.6;
const TILES_RISE_MS = 650;
const REVEAL_FLIP_MS = 420;
/** Instant swaps (after a correct answer) unlock a beat after the card lands. */
const INSTANT_HOLD_MS = 280;
/** How long a correct answer stays up before the next card. */
const CORRECT_HOLD_MS = 1100;

/** Intro links ⇄ progress header. */
const HEADER_FADE_MS = 220;
/** Intro and finished text links sit 61pt below the close button's top (Figma 76:14603). */
const LINKS_TOP = 15 + 61;
/** Results review in and out (over the reveal card flying away, then over the score card). */
const REVIEW_FADE_MS = 280;

const BOTTOM_SLOT_H = 93;
const CARD_TO_SLOT_GAP = 40;

/** Left / down / right → options[0] / [1] / [2] — same thresholds as fixtures H/D/A. */
function optionIndexFromSwipe(dx: number, dy: number, count: number): number | null {
  if (count === 0) return null;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const right = Math.min(2, count - 1);
  const mid = Math.min(1, count - 1);
  if (absX >= SWIPE_THRESHOLD && absX > absY * 1.15) return dx > 0 ? right : 0;
  if (dy >= DRAW_THRESHOLD && dy > absX * 1.05) return mid;
  if (absX >= absY) return dx >= 0 ? right : 0;
  return mid;
}

function optionFromSwipe(dx: number, dy: number, options: PlayersClubOption[]): PlayersClubOption | null {
  const i = optionIndexFromSwipe(dx, dy, options.length);
  return i == null ? null : options[i] ?? null;
}

/**
 * Retro Totl Daily — The Players (admin prototype).
 * White intro + countdown, then the navy game: player + season clue, three clubs, streak.
 */
export default function RetroTotlDailyPlayersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RetroTotlDailyPlayersStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [playedToday, setPlayedToday] = React.useState(false);
  const playedRef = React.useRef(false);
  const [practice, setPractice] = React.useState(false);
  const practiceRef = React.useRef(false);
  const [bestBefore, setBestBefore] = React.useState<number | null>(null);
  // Ticks each minute (for "Next game in…") and at midnight GMT, when a new day starts.
  const [now, setNow] = React.useState(() => Date.now());
  const dayKey = playersDayKey(new Date(now));
  /** The day the daily puzzle on screen belongs to; its score saves against this day. */
  const dealtDayRef = React.useRef(dayKey);
  const [puzzle, setPuzzle] = React.useState<PlayersPuzzle | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [catalogAttempt, setCatalogAttempt] = React.useState(0);
  const rowsRef = React.useRef<PlayerClubApp[]>([]);
  const cards = puzzle?.cards ?? [];
  const [phase, setPhase] = React.useState<Phase>('intro');
  const [countdownStep, setCountdownStep] = React.useState(0);
  const [index, setIndex] = React.useState(0);
  const [outcomes, setOutcomes] = React.useState<PlayersRoundOutcome[]>([]);
  const [lastCorrect, setLastCorrect] = React.useState(false);
  const [lastTimedOut, setLastTimedOut] = React.useState(false);
  const [revealCard, setRevealCard] = React.useState<(typeof cards)[0] | null>(null);
  const [frozenTimer, setFrozenTimer] = React.useState({ secs: 10, frac: 1 });
  const [timerPct, setTimerPct] = React.useState(1);
  const [interactive, setInteractive] = React.useState(true);
  const [cardKey, setCardKey] = React.useState('intro');
  const [flyAwayNonce, setFlyAwayNonce] = React.useState(0);
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [dragSnap, setDragSnap] = React.useState({ x: 0, y: 0 });
  const [sharing, setSharing] = React.useState(false);
  /** After the last card: the player-by-player review, then Continue to the score card. */
  const [reviewing, setReviewing] = React.useState(false);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const navyX = useSharedValue(screenW);
  const shareRef = React.useRef<View>(null);
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
  const firstCard = cardKey.startsWith('play-0-first');
  const instantCard = cardKey.includes('-instant-');
  const revealContinues = lastCorrect && index < cards.length - 1;
  const revealLeadsToScore = phase === 'reveal' && !revealContinues;
  const nextCard = revealContinues ? cards[index + 1] ?? null : null;
  const waitingForNext = playedToday && !practice;
  const personalBest = !practice && bestBefore != null && score > bestBefore;
  const onNavy = phase === 'playing' || phase === 'reveal' || phase === 'score';

  // Card + layout: the design's 353 × 459 card, shrunk to fit shorter phones.
  const topBarH = 44;
  const headerH = 92;
  const cardTop = insets.top + topBarH + headerH;
  const bottomReserve = CARD_TO_SLOT_GAP + BOTTOM_SLOT_H + Math.max(insets.bottom, 16) + 12;
  const maxCardW = Math.min(353, screenW - PLAYERS_CARD.sideInset * 2);
  const maxCardH = Math.max(320, screenH - cardTop - bottomReserve);
  const cardH = Math.min(maxCardW / PLAYERS_CARD.aspectRatio, maxCardH);
  const cardW = cardH * PLAYERS_CARD.aspectRatio;
  const cardSize = React.useMemo(() => ({ width: cardW, height: cardH }), [cardW, cardH]);
  const scale = cardW / 353;

  React.useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const t = Date.now();
      const toMinute = 60000 - (t % 60000);
      id = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, Math.min(toMinute, msUntilNextPlayersDay(new Date(t))) + 50);
    };
    schedule();
    return () => clearTimeout(id);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const today = dayKey;
    if (dealtDayRef.current !== today) {
      // A new day has started while the screen was open.
      playedRef.current = false;
      setPlayedToday(false);
    }
    void playersDayAlreadySaved(today).then((played) => {
      if (cancelled) return;
      playedRef.current = played;
      setPlayedToday(played);
    });
    void readPlayersScores().then((store) => {
      if (cancelled) return;
      const previous = Object.entries(store)
        .filter(([day]) => day !== today)
        .map(([, s]) => s.correct);
      setBestBefore(previous.length ? Math.max(...previous) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [dayKey]);

  React.useEffect(() => {
    if (phase !== 'score' || practiceRef.current || cards.length === 0) return;
    // A game started before midnight still counts for the day it was dealt.
    void savePlayersDayScore(dealtDayRef.current, { correct: score, total: cards.length }).then(() => {
      playedRef.current = true;
      setPlayedToday(true);
    });
  }, [cards.length, phase, score]);

  React.useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    loadPlayerClubApps()
      .then((rows) => {
        if (cancelled) return;
        rowsRef.current = rows;
        dealtDayRef.current = playersDayKey();
        setPuzzle(createPlayersPuzzle(rows, playersDaySeed()));
      })
      .catch((error) => {
        console.error('[RetroTotlDailyPlayers] load failed:', error);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [catalogAttempt]);

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

  const deal = React.useCallback((mode: 'daily' | 'practice') => {
    const rows = rowsRef.current;
    if (!rows.length) return;
    const nextPractice = mode === 'practice';
    practiceRef.current = nextPractice;
    setPractice(nextPractice);
    timerEpoch.current += 1;
    if (timerRaf.current != null) cancelAnimationFrame(timerRaf.current);
    if (!nextPractice) dealtDayRef.current = playersDayKey();
    setReviewing(false);
    setPuzzle(createPlayersPuzzle(rows, nextPractice ? Date.now() : playersDaySeed()));
    setPhase('intro');
    setCountdownStep(0);
    setIndex(0);
    setOutcomes([]);
    setLastCorrect(false);
    setLastTimedOut(false);
    setRevealCard(null);
    setTimerPct(1);
    setInteractive(true);
    setCardKey(`intro-${Date.now()}`);
    setDragSnap({ x: 0, y: 0 });
    dragX.value = 0;
    dragY.value = 0;
    navyX.value = withTiming(screenW, { duration: BG_SLIDE_MS, easing: Easing.in(Easing.cubic) });
  }, [dragX, dragY, navyX, screenW]);

  // Midnight GMT: once back on the intro, swap in the new day's puzzle. A game in progress finishes first.
  React.useEffect(() => {
    if (phase !== 'intro' || dealtDayRef.current === dayKey || !rowsRef.current.length) return;
    deal('daily');
  }, [dayKey, deal, phase]);

  // 3 · 2 · 1 · GO! then the navy slides in and the card flips to question one.
  React.useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdownStep < COUNTDOWN.length - 1) {
      const id = setTimeout(() => setCountdownStep((n) => n + 1), COUNTDOWN_STEP_MS);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setIndex(0);
      setPhase('playing');
      setCardKey(`play-0-first-${Date.now()}`);
      setInteractive(false);
      navyX.value = withTiming(0, { duration: BG_SLIDE_MS, easing: Easing.inOut(Easing.cubic) });
    }, GO_HOLD_MS);
    return () => clearTimeout(id);
  }, [countdownStep, navyX, phase]);

  React.useEffect(() => {
    if (phase !== 'playing' && phase !== 'reveal') {
      setInteractive(phase === 'intro' || phase === 'score');
      setTimerPct(1);
      return;
    }

    setInteractive(false);
    setTimerPct(1);
    setDragSnap({ x: 0, y: 0 });
    const hold =
      phase === 'playing' ? (firstCard ? FIRST_FLIP_DELAY_MS + FIRST_FLIP_MS : instantCard ? INSTANT_HOLD_MS : FLIP_MS) : REVEAL_FLIP_MS;
    const epoch = ++timerEpoch.current;
    const isPlaying = phase === 'playing';

    const unlockId = setTimeout(() => {
      if (timerEpoch.current !== epoch) return;
      if (isPlaying) {
        setInteractive(true);
        const started = performance.now();
        const tick = (now: number) => {
          if (timerEpoch.current !== epoch) return;
          const left = Math.max(0, 1 - (now - started) / PLAYERS_TIMER_MS);
          setTimerPct(left);
          if (left <= 0) return;
          timerRaf.current = requestAnimationFrame(tick);
        };
        timerRaf.current = requestAnimationFrame(tick);
        return;
      }
      if (!(lastCorrectRef.current && indexRef.current < cardsLenRef.current - 1)) {
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
          setFrozenTimer({ secs: 0, frac: 0 });
          setLastCorrect(false);
          setLastTimedOut(true);
          setPhase('reveal');
          setCardKey(`reveal-${c.id}-${Date.now()}`);
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
  }, [cardKey, cards, firstCard, instantCard, index, phase]);

  // Mirror SharedValue drag into React state for tile highlight
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

  const timerRunning = phase === 'playing' && interactive;
  const secondsLeft = timerRunning ? Math.max(1, Math.ceil(timerPct * 10)) : 10;
  const timerFraction = timerRunning ? timerPct : 1;

  const commitPick = React.useCallback((pick: PlayersClubOption) => {
    if (phaseRef.current !== 'playing' || !interactiveRef.current) return;
    const c = cardRef.current;
    if (!c) return;
    timerEpoch.current += 1;
    if (timerRaf.current != null) cancelAnimationFrame(timerRaf.current);
    const correct = pick.clubCode === c.correct.clubCode;
    setOutcomes((prev) => [...prev, { card: c, pick, correct, timedOut: false }]);
    setRevealCard(c);
    setFrozenTimer({ secs: secondsLeft, frac: timerFraction });
    setLastCorrect(correct);
    setLastTimedOut(false);
    setPhase('reveal');
    setCardKey(`reveal-${c.id}-${Date.now()}`);
    setInteractive(false);
    setTimerPct(1);
    setDragSnap({ x: 0, y: 0 });
    dragX.value = 0;
    dragY.value = 0;
  }, [dragX, dragY, secondsLeft, timerFraction]);

  const advanceFromReveal = React.useCallback(() => {
    timerEpoch.current += 1;
    setDragSnap({ x: 0, y: 0 });
    dragX.value = 0;
    dragY.value = 0;
    if (lastCorrectRef.current && indexRef.current < cardsLenRef.current - 1) {
      const next = indexRef.current + 1;
      setIndex(next);
      setPhase('playing');
      setCardKey(`play-${next}-instant-${Date.now()}`);
      setInteractive(false);
      return;
    }
    setPhase('score');
    setReviewing(true);
    setCardKey(`score-${Date.now()}`);
    setInteractive(true);
  }, [dragX, dragY]);

  const swipeToNext = React.useCallback(() => {
    setFlyAwayNonce((n) => n + 1);
  }, []);

  // A correct answer holds briefly, then the next question flies in.
  React.useEffect(() => {
    if (phase !== 'reveal' || !revealContinues) return;
    const id = setTimeout(swipeToNext, CORRECT_HOLD_MS);
    return () => clearTimeout(id);
  }, [cardKey, phase, revealContinues, swipeToNext]);

  const onSwipeAway = React.useCallback(
    (dx: number, dy: number) => {
      timerEpoch.current += 1;
      setDragSnap({ x: 0, y: 0 });
      dragX.value = 0;
      dragY.value = 0;
      const p = phaseRef.current;

      if (p === 'intro') {
        if (playedRef.current && !practiceRef.current) return;
        setCountdownStep(0);
        setPhase('countdown');
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

      if (p === 'reveal') advanceFromReveal();
    },
    [advanceFromReveal, commitPick, dragX, dragY]
  );

  const shareScore = React.useCallback(async () => {
    if (sharing || !shareRef.current) return;
    setSharing(true);
    try {
      const filePath = await captureRef(shareRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await shareCapturedImage({
        filePath,
        target: 'more',
        message: `I got ${score}/${cards.length} on The Players. Can you beat it? https://playtotl.com`,
        title: 'Share score',
      });
    } catch (error) {
      if (!isShareCancelled(error)) console.error('[RetroTotlDailyPlayers] share failed:', error);
    } finally {
      setSharing(false);
    }
  }, [cards.length, score, sharing]);

  const navyStyle = useAnimatedStyle(() => ({ transform: [{ translateX: navyX.value }] }));

  const finishedFace = (
    <PlayersFinishedFace score={score} total={cards.length} personalBest={personalBest} practice={practice} />
  );
  const questionFace = (c: NonNullable<typeof card>, secs = 10, frac = 1) => (
    <PlayersQuestionFace card={c} secondsLeft={secs} timerFraction={frac} />
  );

  let face: React.ReactNode = <PlayersBackFace />;
  if (phase === 'intro') {
    face = (
      <PlayersIntroFace
        mode={waitingForNext ? 'played' : practice ? 'practice' : 'daily'}
        nextGame={playersNextGameLine(new Date(now))}
      />
    );
  } else if (phase === 'countdown') {
    face = <PlayersCountdownFace value={COUNTDOWN[countdownStep] ?? 'GO!'} />;
  } else if (phase === 'playing' && card) {
    face = firstCard ? (
      <PlayersFlipIn
        flipKey={cardKey}
        delayMs={FIRST_FLIP_DELAY_MS}
        durationMs={FIRST_FLIP_MS}
        front={<PlayersCountdownFace value="GO!" />}
        back={questionFace(card, secondsLeft, timerFraction)}
      />
    ) : (
      questionFace(card, secondsLeft, timerFraction)
    );
  } else if (phase === 'reveal' && revealCard) {
    face = (
      <PlayersFlipIn
        flipKey={cardKey}
        delayMs={0}
        durationMs={REVEAL_FLIP_MS}
        front={questionFace(revealCard, frozenTimer.secs, frozenTimer.frac)}
        back={<PlayersRevealFace card={revealCard} correct={lastCorrect} timedOut={lastTimedOut} />}
      />
    );
  } else if (phase === 'score') {
    face = (
      <View ref={shareRef} collapsable={false} style={{ flex: 1 }}>
        {finishedFace}
      </View>
    );
  }

  const nextFace =
    phase === 'intro' ? (
      <PlayersCountdownFace value={COUNTDOWN[0]} />
    ) : revealLeadsToScore && interactive ? (
      // Only plant the result once the reveal flip has landed, or it shows through mid-flip.
      finishedFace
    ) : revealContinues && nextCard ? (
      questionFace(nextCard)
    ) : (
      <PlayersBackFace />
    );

  // Header: label + ten dots
  const dotStates: PlayersDotState[] = cards.map((_, i) => {
    const o = outcomes[i];
    if (o) return o.correct ? 'correct' : 'wrong';
    if (phase === 'playing' && i === index) return 'active';
    return 'todo';
  });
  const headerLabel =
    phase === 'countdown'
      ? 'The Players · Totl Daily'
      : phase === 'score'
        ? `${outcomes.length} of ${cards.length}`
        : `${Math.min(index + 1, cards.length)} of ${cards.length}`;

  const hotIndex =
    phase === 'playing' && interactive && (Math.abs(dragSnap.x) > 30 || Math.abs(dragSnap.y) > 30)
      ? optionIndexFromSwipe(dragSnap.x, dragSnap.y, card?.options.length ?? 0)
      : null;

  const chrome = onNavy ? PLAYERS_COLORS.white : PLAYERS_COLORS.inkSoft;

  if (!puzzle) {
    return (
      <View style={[styles.fill, styles.loading, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TotlText style={styles.loadingText}>
          {loadError ? "Couldn't load the players." : 'Loading the players…'}
        </TotlText>
        {loadError ? (
          <View style={{ width: '100%', maxWidth: 353 }}>
            <PlayersButton label="Try again" height={60} onPress={() => setCatalogAttempt((n) => n + 1)} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <PlayersCardScale.Provider value={scale}>
      <View style={[styles.fill, { backgroundColor: PLAYERS_COLORS.paper }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.navy, navyStyle]} />

        <View
          style={{
            flex: 1,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
        >
          <RetroPlayersRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />

          {/* Intro and finished: close above the text links. Game: close beside the centred progress label. */}
          <View style={{ height: topBarH + headerH }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              hitSlop={10}
              style={({ pressed }) => [
                styles.close,
                { top: 15, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="close" size={24} color={chrome} />
            </Pressable>
            {/* Cross-fade rather than snap when the game starts or ends. */}
            {phase === 'intro' ? (
              <Animated.View
                key="links"
                entering={FadeIn.duration(HEADER_FADE_MS)}
                exiting={FadeOut.duration(HEADER_FADE_MS)}
                style={[styles.linkRow, { marginTop: LINKS_TOP }]}
              >
                <PlayersTextLink label="Rules" onPress={() => setRulesOpen(true)} />
                <PlayersTextLink label="Scoreboard" onPress={openScoreboard} />
              </Animated.View>
            ) : phase === 'score' ? (
              <Animated.View
                key="score-links"
                entering={FadeIn.duration(HEADER_FADE_MS).delay(HEADER_FADE_MS / 2)}
                exiting={FadeOut.duration(HEADER_FADE_MS)}
                style={[styles.linkRow, { marginTop: LINKS_TOP }]}
              >
                <PlayersTextLink label="Scoreboard" color={PLAYERS_COLORS.white} onPress={openScoreboard} />
                <PlayersTextLink label="Practice mode" color={PLAYERS_COLORS.white} onPress={() => deal('practice')} />
              </Animated.View>
            ) : (
              <Animated.View
                key="progress"
                entering={FadeIn.duration(HEADER_FADE_MS).delay(HEADER_FADE_MS / 2)}
                exiting={FadeOut.duration(HEADER_FADE_MS)}
                style={{ alignItems: 'center', marginTop: 17 }}
              >
                <TotlText style={[styles.headerLabel, { color: chrome }]}>{headerLabel}</TotlText>
                <View style={{ marginTop: 24 }}>
                  <PlayersProgressDots states={dotStates} />
                </View>
              </Animated.View>
            )}
          </View>

          <View style={{ alignItems: 'center' }}>
            <RetroDailySwipeStack
              cardKey={cardKey}
              cardSize={cardSize}
              keepChildrenMounted
              smoothTap
              showNext={phase !== 'score' && phase !== 'countdown'}
              showQueued={false}
              flyAwayNonce={flyAwayNonce}
              tapAdvances={phase === 'intro' && !waitingForNext}
              nextFace={nextFace}
              queuedFace={<PlayersBackFace />}
              dragX={dragX}
              dragY={dragY}
              disabled={
                !interactive ||
                waitingForNext ||
                phase === 'countdown' ||
                phase === 'score' ||
                (phase === 'reveal' && revealContinues)
              }
              onSwipeAway={onSwipeAway}
            >
              {face}
            </RetroDailySwipeStack>
          </View>

          <View style={{ marginTop: CARD_TO_SLOT_GAP, paddingHorizontal: (screenW - cardW) / 2 - insets.left }}>
            {phase === 'intro' && waitingForNext ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <PlayersButton label="Practice mode" onPress={() => deal('practice')} />
              </Animated.View>
            ) : null}

            {(phase === 'playing' || (phase === 'reveal' && revealContinues)) && card ? (
              <Animated.View entering={SlideInDown.duration(TILES_RISE_MS)
                  .delay(firstCard ? TILES_RISE_DELAY_MS : 0)
                  .easing(Easing.out(Easing.cubic))}>
                <PlayersAnswerTiles
                  options={(phase === 'reveal' ? revealCard ?? card : card).options}
                  hotIndex={hotIndex}
                  correctCode={phase === 'reveal' ? revealCard?.correct.clubCode : null}
                  disabled={!interactive || phase !== 'playing'}
                  onPick={commitPick}
                />
              </Animated.View>
            ) : null}

            {phase === 'reveal' && !revealContinues ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <PlayersButton label="Continue" arrow onPress={swipeToNext} />
              </Animated.View>
            ) : null}

            {phase === 'score' ? (
              <Animated.View entering={FadeIn.duration(250)}>
                <PlayersButton
                  label="Share score"
                  tone={personalBest ? 'gold' : 'green'}
                  glow
                  busy={sharing}
                  height={Math.min(93, BOTTOM_SLOT_H)}
                  onPress={() => void shareScore()}
                />
              </Animated.View>
            ) : null}
          </View>
        </View>

        {phase === 'score' && reviewing ? (
          <Animated.View
            style={[StyleSheet.absoluteFill, { zIndex: 20 }]}
            entering={FadeIn.duration(REVIEW_FADE_MS)}
            exiting={FadeOut.duration(REVIEW_FADE_MS)}
          >
            <PlayersReview cards={cards} outcomes={outcomes} onContinue={() => setReviewing(false)} />
          </Animated.View>
        ) : null}
      </View>
    </PlayersCardScale.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  navy: { backgroundColor: PLAYERS_COLORS.navy },
  loading: {
    backgroundColor: PLAYERS_COLORS.paper,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  loadingText: {
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 16,
    color: PLAYERS_COLORS.inkSoft,
    textAlign: 'center',
  },
  close: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  headerLabel: {
    fontFamily: PLAYERS_FONTS.body,
    fontSize: 16,
    lineHeight: 20.8,
  },
  linkRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
});
