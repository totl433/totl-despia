import React from 'react';
import { Alert, BackHandler, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { Easing, FadeIn, SlideInDown, useSharedValue } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import type { PlayersShootout, PlayersShootoutCard } from '@totl/api-client';
import { ApiError } from '@totl/api-client';
import { TotlText } from '@totl/ui';

import { PLAYERS_TIMER_MS, type PlayersClubOption } from '../../lib/retroPlayers/buildPuzzle';
import {
  currentShootoutGame,
  nextShootoutMoment,
  shootoutCardAsPlayersCard,
  shootoutCardNumber,
  shootoutCardSpec,
  shootoutClubName,
  shootoutGameLabel,
  shootoutHeadToHead,
  shootoutShareMessage,
} from '../../lib/retroPlayers/shootout';
import { shareShootoutText } from '../../lib/retroPlayers/shootoutShare';
import { shootoutSandbox } from '../../lib/retroPlayers/shootoutSandbox';
import { loadShootoutSeen, markShootoutSeen } from '../../lib/retroPlayers/shootoutSeen';
import { useShootoutClient } from '../../lib/retroPlayers/useShootoutClient';
import { optionFromSwipe, optionIndexFromSwipe } from '../../lib/retroPlayers/swipePick';
import RetroDailySwipeStack from '../../components/retroDaily/RetroDailySwipeStack';
import type { RetroTotlDailyPlayersStackParamList } from '../../navigation/RetroTotlDailyPlayersNavigator';
import {
  PlayersBackFace,
  PlayersCountdownFace,
  PlayersFlipIn,
  PlayersQuestionFace,
  PlayersRevealFace,
} from '../../components/retroPlayers/PlayersFaces';
import { PlayersAnswerTiles, PlayersButton, PlayersTextLink } from '../../components/retroPlayers/PlayersControls';
import ShootoutCardScreen, { ShootoutCloseButton, useShootoutCardLayout } from '../../components/retroPlayers/ShootoutCardScreen';
import ShootoutResultMoment from '../../components/retroPlayers/ShootoutResultMoment';
import { ShootoutScoreHeader } from '../../components/retroPlayers/PlayersShootoutBits';
import { PLAYERS_COLORS, PLAYERS_FONTS, PlayersCardScale } from '../../components/retroPlayers/playersTheme';

/** overview: between cards (the card screen). countdown → question → reveal: playing your card, as in the daily game. */
type Mode = 'overview' | 'countdown' | 'question' | 'reveal';

// Timings from the daily game (RetroTotlDailyPlayersScreen).
const COUNTDOWN = ['3', '2', '1', 'GO!'] as const;
const COUNTDOWN_STEP_MS = 1000;
/** GO! holds this long before the card flips (the card itself is fetched as GO! shows). */
const GO_HOLD_MS = 650;
const FIRST_FLIP_MS = 850;
const TILES_RISE_MS = 650;
const REVEAL_FLIP_MS = 420;
/** How long Correct / Incorrect stays up before a deciding answer goes to its result. */
const DECIDED_HOLD_MS = 900;
/** Ignore club taps this long after the card lands (taps aimed at the button that was there). */
const TAP_THROUGH_GUARD_MS = 250;

/** The card just answered, from the challenge the answer came back with (it now carries the right club). */
function findPlayedCard(c: PlayersShootout, cardId: string): PlayersShootoutCard | null {
  for (const g of c.games) for (const r of g.rounds) if (r.card?.id === cardId) return r.card;
  return null;
}

/** When you played second: what they put on the same card. */
function theirPickLine(c: PlayersShootout, cardId: string): string | null {
  for (const g of c.games) {
    const round = g.rounds.find((r) => r.card?.id === cardId);
    if (!round || !round.them.played) continue;
    if (round.them.timedOut) return `${c.them.name} ran out of time.`;
    const club = shootoutClubName(round.card, round.them.pick);
    return club ? `${c.them.name} said ${club}${round.them.correct ? ' ✓' : ' ✗'}` : null;
  }
  return null;
}

/** What that answer did, in a line under the reveal. */
function outcomeLine(c: PlayersShootout, cardId: string): string {
  if (c.status === 'finished') {
    return c.result === 'won' ? 'You win the Shootout!' : `${c.them.name} wins the Shootout.`;
  }
  for (const g of c.games) {
    const round = g.rounds.find((r) => r.card?.id === cardId);
    if (!round) continue;
    const label = g.suddenDeath ? 'sudden death' : `round ${g.number}`;
    if (g.result === 'me') return `You win ${label}!`;
    if (g.result === 'them') return `${c.them.name} wins ${label}.`;
    if (g.result === 'draw') return `You both missed. Round ${g.number} is a draw.`;
    // Your answer's in: it's their turn now.
    if (!round.them.played) return `Waiting for ${c.them.name} to play.`;
    if (round.me.correct && round.them.correct) return 'You both got it. Next card.';
    return 'You both missed. Sudden death goes on.';
  }
  return '';
}

export default function PlayersShootoutMatchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RetroTotlDailyPlayersStackParamList>>();
  const { params } = useRoute<RouteProp<RetroTotlDailyPlayersStackParamList, 'PlayersShootoutMatch'>>();
  const id = params.id;
  const { client, sandbox, listKey, oneKey } = useShootoutClient(params.sandbox);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = React.useState<Mode>('overview');
  const [countdownStep, setCountdownStep] = React.useState(0);
  const [card, setCard] = React.useState<PlayersShootoutCard | null>(null);
  const [deadline, setDeadline] = React.useState(0);
  const [msLeft, setMsLeft] = React.useState(PLAYERS_TIMER_MS);
  const [frozen, setFrozen] = React.useState({ secs: 10, frac: 1 });
  const [pickedCode, setPickedCode] = React.useState<string | null>(null);
  const [reveal, setReveal] = React.useState<{
    card: PlayersShootoutCard;
    correct: boolean;
    timedOut: boolean;
    line: string;
    /** You played first: the reveal waits for their answer, then goes back to the scorecard. */
    waiting: boolean;
    shownAt: number;
  } | null>(null);
  const [seen, setSeen] = React.useState<Set<string> | null>(null);
  /** The playing screen's header, fixed when the card's countdown starts ("Round 3 of 3 · Card 1"). */
  const [playLabel, setPlayLabel] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const answeringRef = React.useRef(false);
  /** The card has landed and can be answered (as the game unlocks after its flip). */
  const [unlocked, setUnlocked] = React.useState(false);
  /** Answer sent, waiting for the reveal. */
  const [answered, setAnswered] = React.useState(false);
  /**
   * A pick only counts while the card is up, has landed, and hasn't been answered, and not
   * in the first moment after it lands: a tap meant for the button that was in the same spot
   * (Play, Next card) must not land on a club tile rising into place.
   */
  const answerableAtRef = React.useRef<number | null>(null);
  /** When GO! appeared, so the flip waits out the game's GO! hold. */
  const goShownAtRef = React.useRef(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const [dragSnap, setDragSnap] = React.useState({ x: 0, y: 0 });
  const [flipDelay, setFlipDelay] = React.useState(0);
  const resumedRef = React.useRef(false);

  const { data, error, refetch } = useQuery({
    queryKey: oneKey(id),
    queryFn: () => client.getPlayersShootout(id).then((r) => r.challenge),
    // Waiting on their answer after yours: check often so the scorecard comes back as soon as they play.
    refetchInterval: mode === 'overview' ? 30_000 : mode === 'reveal' ? 5_000 : false,
  });
  const c = data ?? null;
  // Every Shootout, for the head-to-head on the full-time card.
  const { data: allShootouts } = useQuery({
    queryKey: listKey,
    queryFn: () => client.listPlayersShootouts(),
    enabled: c?.status === 'finished',
  });

  const store = React.useCallback(
    (next: PlayersShootout) => {
      queryClient.setQueryData(oneKey(id), next);
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
    [id, listKey, oneKey, queryClient]
  );

  // Result moments already shown on this phone.
  React.useEffect(() => {
    let cancelled = false;
    void loadShootoutSeen(id, sandbox).then((loaded) => {
      if (!cancelled) setSeen(new Set(loaded));
    });
    return () => {
      cancelled = true;
    };
  }, [id, sandbox]);

  // Ticks for "23h left".
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // No backing out mid-card: the clock keeps running on the server.
  const playing = mode !== 'overview';
  React.useEffect(() => {
    if (!playing) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [playing]);

  const startQuestion = React.useCallback((open: NonNullable<PlayersShootout['openCard']>) => {
    answeringRef.current = false;
    // GO! holds as in the game, then the card flips. Your 10 seconds start once it's landed,
    // which the server's few seconds of grace allow for.
    const hold = goShownAtRef.current ? Math.max(0, GO_HOLD_MS - (Date.now() - goShownAtRef.current)) : 0;
    const landing = hold + FIRST_FLIP_MS;
    setFlipDelay(hold);
    setReveal(null);
    setAnswered(false);
    setUnlocked(false);
    setCard(open.card);
    setPickedCode(null);
    setDeadline(Date.now() + open.msLeft + landing);
    setMsLeft(open.msLeft);
    setMode('question');
    dragX.value = 0;
    dragY.value = 0;
  }, [dragX, dragY]);

  // Unlock the card once the flip has landed.
  React.useEffect(() => {
    if (mode !== 'question' || !card) return;
    answerableAtRef.current = null;
    const t = setTimeout(() => {
      answerableAtRef.current = Date.now() + TAP_THROUGH_GUARD_MS;
      setUnlocked(true);
    }, flipDelay + FIRST_FLIP_MS);
    return () => clearTimeout(t);
  }, [card, flipDelay, mode]);

  // Mirror the drag so the club it's heading for lights up, as in the game.
  React.useEffect(() => {
    if (mode !== 'question' || !unlocked || answered) {
      setDragSnap({ x: 0, y: 0 });
      return;
    }
    const t = setInterval(() => setDragSnap({ x: dragX.value, y: dragY.value }), 32);
    return () => clearInterval(t);
  }, [answered, dragX, dragY, mode, unlocked]);

  // Came back to a card that's still open (the app was closed mid-card): straight back to it.
  React.useEffect(() => {
    if (!c?.openCard || resumedRef.current || mode !== 'overview') return;
    resumedRef.current = true;
    goShownAtRef.current = 0;
    const g = currentShootoutGame(c);
    setPlayLabel(`${shootoutGameLabel(g)} · Card ${shootoutCardNumber(g)}`);
    startQuestion(c.openCard);
  }, [c, mode, startQuestion]);

  // 3 · 2 · 1, then ask the server for the card (its 10 seconds start there).
  React.useEffect(() => {
    if (mode !== 'countdown') return;
    if (countdownStep < COUNTDOWN.length - 1) {
      const t = setTimeout(() => setCountdownStep((n) => n + 1), COUNTDOWN_STEP_MS);
      return () => clearTimeout(t);
    }
    goShownAtRef.current = Date.now();
    let cancelled = false;
    client
      .revealPlayersShootoutCard(id)
      .then(({ challenge }) => {
        if (cancelled) return;
        store(challenge);
        resumedRef.current = true;
        if (challenge.openCard) startQuestion(challenge.openCard);
        else setMode('overview');
      })
      .catch((e) => {
        if (cancelled) return;
        setMessage(e instanceof Error ? e.message : "Couldn't get your card.");
        setMode('overview');
        void refetch();
      });
    return () => {
      cancelled = true;
    };
  }, [client, countdownStep, id, mode, refetch, startQuestion, store]);

  const submit = React.useCallback(
    async (pick: PlayersClubOption | null) => {
      if (!card || answeringRef.current) return;
      // The clock (pick null) always counts; a club only once the card is answerable.
      const answerableAt = answerableAtRef.current;
      if (pick && (answerableAt == null || Date.now() < answerableAt)) return;
      answeringRef.current = true;
      answerableAtRef.current = null;
      setAnswered(true);
      setDragSnap({ x: 0, y: 0 });
      const left = Math.min(PLAYERS_TIMER_MS, Math.max(0, deadline - Date.now()));
      setFrozen({ secs: pick ? Math.max(1, Math.ceil(left / 1000)) : 0, frac: left / PLAYERS_TIMER_MS });
      setPickedCode(pick?.clubCode ?? null);
      try {
        const res = await client.answerPlayersShootoutCard(id, { cardId: card.id, pick: pick?.clubCode ?? null });
        store(res.challenge);
        const played = findPlayedCard(res.challenge, card.id) ?? card;
        setReveal({
          card: played,
          correct: res.correct,
          timedOut: res.timedOut,
          line: outcomeLine(res.challenge, card.id),
          waiting: !theirPickLine(res.challenge, card.id) && res.challenge.status === 'active',
          shownAt: Date.now(),
        });
        setMode('reveal');
      } catch (e) {
        setMessage(e instanceof ApiError || e instanceof Error ? e.message : "Couldn't send your answer.");
        setMode('overview');
        void refetch();
      }
    },
    [card, client, deadline, id, refetch, store]
  );

  // After your answer, the reveal follows the challenge live:
  //   - the game is decided (by either answer): back to the scorecard, where the result moment is waiting;
  //   - it's your turn again: a Next card button;
  //   - still waiting on them: "Waiting for … to play".
  const revealCardId = mode === 'reveal' && reveal ? reveal.card.id : null;
  const revealShownAt = reveal?.shownAt ?? 0;
  const revealWaited = !!reveal?.waiting;
  const pendingMoment = seen && c ? nextShootoutMoment(c, seen) : null;
  /** A round or the whole Shootout has just been decided: the reveal moves on to its result. */
  const decided = !!pendingMoment || c?.status === 'finished';
  // Mid-match result cards (full time has its own screen below).
  const moment = pendingMoment?.kind === 'game' ? pendingMoment : null;
  const nextReady = mode === 'reveal' && c?.status === 'active' && c.nextAction === 'play' && !c.openCard;
  const theyPlayed = React.useMemo(() => {
    if (!revealCardId || !c) return false;
    if (c.status !== 'active') return true;
    for (const g of c.games) {
      const round = g.rounds.find((r) => r.card?.id === revealCardId);
      if (round) return round.them.played;
    }
    return false;
  }, [c, revealCardId]);
  const leaveReveal = React.useCallback(() => {
    setReveal(null);
    setCard(null);
    setMode('overview');
  }, []);
  /** Every new card starts here: clear the last one, and fix the header to the round it's in. */
  const beginCountdown = React.useCallback(() => {
    const g = c ? currentShootoutGame(c) : null;
    setPlayLabel(`${shootoutGameLabel(g)} · Card ${shootoutCardNumber(g)}`);
    setReveal(null);
    setCard(null);
    setMessage(null);
    setCountdownStep(0);
    setMode('countdown');
  }, [c]);
  React.useEffect(() => {
    // A game has just been decided: back to the scorecard for the result moment.
    if (!revealCardId || !decided) return;
    if (revealWaited && !theyPlayed) return;
    const elapsed = Date.now() - revealShownAt;
    // Straight to the result: once your reveal has flipped over and been seen for a moment.
    const wait = Math.max(0, REVEAL_FLIP_MS + DECIDED_HOLD_MS - elapsed);
    const t = setTimeout(leaveReveal, wait);
    return () => clearTimeout(t);
  }, [decided, leaveReveal, revealCardId, revealShownAt, revealWaited, theyPlayed]);

  // The 10-second clock. At zero, tell the server straight away.
  React.useEffect(() => {
    if (mode !== 'question' || !unlocked) return;
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setMsLeft(left);
      if (left <= 0) {
        void submit(null);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deadline, mode, submit, unlocked]);

  const run = React.useCallback(
    async (work: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      setMessage(null);
      try {
        await work();
      } catch (e) {
        const body = e instanceof ApiError ? (e.body as { challengeId?: string } | null) : null;
        if (body?.challengeId) {
          navigation.replace('PlayersShootoutMatch', { id: body.challengeId, sandbox });
          return;
        }
        setMessage(e instanceof Error ? e.message : 'Something went wrong.');
        void refetch();
      } finally {
        setBusy(false);
      }
    },
    [busy, navigation, refetch, sandbox]
  );

  /** Straight to the Shootouts home, wherever this screen was opened from. */
  const goHome = () => {
    const routes = navigation.getState()?.routes ?? [];
    if (routes.some((r) => r.name === 'PlayersShootoutHome')) navigation.popTo('PlayersShootoutHome', { sandbox });
    else navigation.replace('PlayersShootoutHome', { sandbox });
  };

  /**
   * The X on the navy screens: back to the Shootouts home. Nothing ends, so several
   * Shootouts can run at once (ending one is the X on its row in the list).
   * Mid-card, leaving counts as a miss, so that asks first.
   */
  const confirmExit = () => {
    if (mode === 'question') {
      Alert.alert('Leave this card?', 'If you leave now it counts as a miss.', [
        { text: 'Keep playing', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => void submit(null).finally(goHome) },
      ]);
      return;
    }
    goHome();
  };

  const layout = useShootoutCardLayout();
  const { cardW, cardH } = layout;

  if (!c) {
    // As the game's own loading screen (RetroTotlDailyPlayersScreen).
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TotlText style={styles.loading}>{error ? "Couldn't load the Shootout." : 'Loading the Shootout…'}</TotlText>
        {error ? (
          <View style={{ width: '100%', maxWidth: 353, gap: 16, alignItems: 'center' }}>
            <PlayersButton label="Try again" height={60} onPress={() => void refetch()} />
            <PlayersTextLink label="Back to Shootouts" onPress={goHome} />
          </View>
        ) : null}
      </View>
    );
  }

  // ── Playing a card: the daily game's countdown, question and reveal ────
  if (playing) {
    // Full ring until the card has landed; then the 10 seconds count down.
    const shown = unlocked ? Math.min(PLAYERS_TIMER_MS, msLeft) : PLAYERS_TIMER_MS;
    const secs = Math.max(1, Math.ceil(shown / 1000));
    const frac = shown / PLAYERS_TIMER_MS;
    const stackKey =
      mode === 'reveal' && reveal ? `r-${reveal.card.id}` : mode === 'question' && card ? `${answered ? 'a' : 'q'}-${card.id}` : 'countdown';
    const hotIndex =
      mode === 'question' && unlocked && !answered && (Math.abs(dragSnap.x) > 30 || Math.abs(dragSnap.y) > 30)
        ? optionIndexFromSwipe(dragSnap.x, dragSnap.y, card?.options.length ?? 0)
        : null;
    const asCard = card ? shootoutCardAsPlayersCard(card) : null;
    return (
      <PlayersCardScale.Provider value={layout.s}>
        <View style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <StatusBar style="light" />
          {/* Same spot as the daily game's "3 of 10" label. */}
          <View style={{ height: layout.HEADER_H, alignItems: 'center', paddingTop: 17 }}>
            <ShootoutCloseButton onPress={confirmExit} />
            <ShootoutScoreHeader challenge={c} />
            <TotlText style={styles.playSub}>{playLabel}</TotlText>
          </View>
          <View style={{ alignItems: 'center' }}>
            {/* The game's swipe stack: blank cards behind, swipe left / down / right to answer. */}
            <RetroDailySwipeStack
              cardKey={stackKey}
              cardSize={{ width: cardW, height: cardH }}
              keepChildrenMounted
              smoothTap
              showNext={mode !== 'countdown'}
              showQueued={false}
              nextFace={<PlayersBackFace />}
              queuedFace={<PlayersBackFace />}
              dragX={dragX}
              dragY={dragY}
              disabled={mode !== 'question' || !unlocked || answered}
              onSwipeAway={(dx, dy) => {
                dragX.value = 0;
                dragY.value = 0;
                if (mode !== 'question' || !card) return;
                const pick = optionFromSwipe(dx, dy, card.options);
                if (pick) void submit(pick);
              }}
            >
              {mode === 'question' && asCard && !answered ? (
                <PlayersFlipIn
                  flipKey={`q-${asCard.id}`}
                  delayMs={flipDelay}
                  durationMs={FIRST_FLIP_MS}
                  front={<PlayersCountdownFace value="GO!" />}
                  back={<PlayersQuestionFace card={asCard} secondsLeft={secs} timerFraction={frac} />}
                />
              ) : mode === 'question' && asCard ? (
                // Answer sent: hold the question, clock stopped, until the reveal comes back.
                <PlayersQuestionFace card={asCard} secondsLeft={frozen.secs} timerFraction={frozen.frac} />
              ) : mode === 'reveal' && reveal && asCard ? (
                <PlayersFlipIn
                  flipKey={`r-${reveal.card.id}`}
                  delayMs={0}
                  durationMs={REVEAL_FLIP_MS}
                  front={<PlayersQuestionFace card={asCard} secondsLeft={frozen.secs} timerFraction={frozen.frac} />}
                  back={
                    <PlayersRevealFace card={shootoutCardAsPlayersCard(reveal.card)} correct={reveal.correct} timedOut={reveal.timedOut} />
                  }
                />
              ) : (
                <PlayersCountdownFace value={COUNTDOWN[countdownStep] ?? 'GO!'} />
              )}
            </RetroDailySwipeStack>
          </View>
          <View style={{ marginTop: layout.GAP, width: cardW, alignSelf: 'center' }}>
            {mode === 'question' && card ? (
              <Animated.View
                entering={SlideInDown.duration(TILES_RISE_MS)
                  .delay(flipDelay + FIRST_FLIP_MS * 0.6)
                  .easing(Easing.out(Easing.cubic))}
              >
                <PlayersAnswerTiles
                  options={card.options}
                  hotIndex={pickedCode ? card.options.findIndex((o) => o.clubCode === pickedCode) : hotIndex}
                  disabled={!unlocked || answered}
                  onPick={(opt) => void submit(opt)}
                />
                {sandbox && shootoutSandbox.answerFor(id) ? (
                  <TotlText style={styles.sandboxHint}>Sandbox answer: {shootoutSandbox.answerFor(id)}</TotlText>
                ) : null}
              </Animated.View>
            ) : null}
            {/* A decided round or Shootout goes straight to its result: nothing under the card. */}
            {mode === 'reveal' && reveal && !decided ? (
              <Animated.View entering={FadeIn.duration(250).delay(REVEAL_FLIP_MS)} style={{ gap: 14 }}>
                {/* One line, from the live challenge: what they picked once they've played, otherwise
                    "Waiting for … to play". */}
                <TotlText style={styles.outcome}>
                  {theirPickLine(c, reveal.card.id) ?? (outcomeLine(c, reveal.card.id) || reveal.line)}
                </TotlText>
                {/* Next card once it's yours; until then, who you're waiting on (the X goes back to Shootouts). */}
                {nextReady ? (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <PlayersButton label="Next card" arrow onPress={beginCountdown} />
                  </Animated.View>
                ) : theirPickLine(c, reveal.card.id) && c.status === 'active' ? (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <TotlText style={styles.waitingNext}>Waiting for {c.them.name} to play the next card…</TotlText>
                  </Animated.View>
                ) : null}
              </Animated.View>
            ) : null}
          </View>
        </View>
      </PlayersCardScale.Provider>
    );
  }

  // ── Between cards ──────────────────────────────────────────────────────
  const share = () =>
    void shareShootoutText(shootoutShareMessage(c), 'whatsapp').catch(() => setMessage("Couldn't open WhatsApp."));
  const rematch = () =>
    run(async () => {
      const { challenge } = await client.createPlayersShootout(c.them.id);
      void queryClient.invalidateQueries({ queryKey: listKey });
      navigation.replace('PlayersShootoutMatch', { id: challenge.id, sandbox });
    });

  // Finished: the full-time card is the screen. Confetti only the first time.
  if (c.status === 'finished') {
    const finished = c.games.filter((g) => g.result != null);
    const keys = ['final', ...finished.map((g) => `g${g.number}`)];
    return (
      <View style={styles.fill}>
        <ShootoutResultMoment
          challenge={c}
          game={finished[finished.length - 1] ?? null}
          final
          busy={busy}
          celebrate={!!seen && !seen.has('final')}
          headToHead={shootoutHeadToHead(allShootouts?.challenges ?? [], c)}
          onDone={goHome}
          onRematch={() => {
            markShootoutSeen(id, sandbox, keys);
            void rematch();
          }}
          onBackToList={() => {
            markShootoutSeen(id, sandbox, keys);
            goHome();
          }}
        />
      </View>
    );
  }

  const spec = shootoutCardSpec(c, now);
  const onPrimary = () => {
    if (!spec.primary) return;
    if (spec.primary.action === 'play') beginCountdown();
    else if (spec.primary.action === 'accept') void run(async () => store((await client.respondToPlayersShootout(id, true)).challenge));
    else void rematch();
  };
  const onLink = () => {
    if (!spec.link) return;
    if (spec.link.action === 'whatsapp') share();
    else if (spec.link.action === 'decline') void run(async () => store((await client.respondToPlayersShootout(id, false)).challenge));
    else goHome();
  };

  return (
    <View style={styles.fill}>
      <ShootoutCardScreen
        challenge={c}
        spec={spec}
        busy={busy}
        message={message}
        onClose={confirmExit}
        onPrimary={onPrimary}
        onLink={onLink}
      />
      {/* A round decided since you last looked: its result card, over the score. */}
      {moment ? (
        <ShootoutResultMoment
          key={moment.keys.join(',')}
          challenge={c}
          game={moment.game}
          final={false}
          onDone={() => {
            markShootoutSeen(id, sandbox, moment.keys);
            setSeen((prev) => new Set([...(prev ?? []), ...moment.keys]));
          }}
          onPlayNext={() => {
            markShootoutSeen(id, sandbox, moment.keys);
            setSeen((prev) => new Set([...(prev ?? []), ...moment.keys]));
            beginCountdown();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: PLAYERS_COLORS.navy },
  loadingScreen: {
    flex: 1,
    backgroundColor: PLAYERS_COLORS.paper,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  loading: { fontFamily: PLAYERS_FONTS.medium, fontSize: 16, color: PLAYERS_COLORS.inkSoft, textAlign: 'center' },
  playSub: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 30,
    lineHeight: 32,
    paddingTop: 4,
    marginTop: 6,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.whiteSoft,
  },
  outcome: {
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 20,
    lineHeight: 26,
    color: PLAYERS_COLORS.white,
    textAlign: 'center',
  },
  waitingNext: {
    fontFamily: PLAYERS_FONTS.body,
    fontSize: 16,
    lineHeight: 22,
    color: PLAYERS_COLORS.whiteSoft,
    textAlign: 'center',
  },
  sandboxHint: {
    fontFamily: PLAYERS_FONTS.body,
    fontSize: 13,
    color: PLAYERS_COLORS.whiteSoft,
    textAlign: 'center',
    marginTop: 10,
  },
});
