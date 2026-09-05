import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { isFounderAdmin } from '../lib/adminIds';
import {
  createMockRetroPuzzle,
  RETRO_TIMER_MS,
  type RetroFixture,
  type RetroPick,
  type RetroPuzzle,
} from '../lib/retroDaily/mockPuzzle';
import RetroDailyIntroCard from '../components/retroDaily/RetroDailyIntroCard';
import RetroDailyCountdownCard from '../components/retroDaily/RetroDailyCountdownCard';
import RetroDailyPromoteFlipCard, {
  RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS,
  RETRO_PROMOTE_FLIP_DELAY_MS,
  RETRO_PROMOTE_FLIP_MS,
} from '../components/retroDaily/RetroDailyPromoteFlipCard';
import RetroDailyFixtureCard from '../components/retroDaily/RetroDailyFixtureCard';
import RetroDailyLogoBack from '../components/retroDaily/RetroDailyLogoBack';
import RetroDailyRevealCard, {
  resultMatchesPick,
  RETRO_REVEAL_FLIP_MS,
  RETRO_REVEAL_HOLD_MS,
  type RetroRoundOutcome,
} from '../components/retroDaily/RetroDailyRevealCard';
import RetroDailyScoreCard, { retroScoreBlurb } from '../components/retroDaily/RetroDailyScoreCard';
import RetroDailyRulesModal from '../components/retroDaily/RetroDailyRulesModal';
import RetroDailySwipeStack, {
  DRAW_THRESHOLD,
  SWIPE_THRESHOLD,
} from '../components/retroDaily/RetroDailySwipeStack';
import RetroDailyProgressPips from '../components/retroDaily/RetroDailyProgressPips';
import { ensureRetroPixelFont } from '../lib/retroDaily/pixelFont';

type Phase = 'intro' | 'countdown' | 'playing' | 'reveal' | 'score';

const BG = '#0B1F3A';

/**
 * Admin web prototype: Retro Totl Daily — replica of the Expo admin build.
 */
export default function RetroTotlDailyPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isFounderAdmin(user?.id);

  const [puzzle, setPuzzle] = useState<RetroPuzzle>(() => createMockRetroPuzzle());
  const fixtures = puzzle.fixtures;
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [outcomes, setOutcomes] = useState<RetroRoundOutcome[]>([]);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [lastTimedOut, setLastTimedOut] = useState(false);
  const [revealFixture, setRevealFixture] = useState<RetroFixture | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [timerPct, setTimerPct] = useState(1);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [interactive, setInteractive] = useState(true);
  const [cardKey, setCardKey] = useState('intro');
  const [flipKey, setFlipKey] = useState(0);
  const [flyAwayNonce, setFlyAwayNonce] = useState(0);
  const [pixelFontReady, setPixelFontReady] = useState(false);

  const timerEpoch = useRef(0);
  const timerRaf = useRef(0);
  const phaseRef = useRef(phase);
  const interactiveRef = useRef(interactive);
  const fixtureRef = useRef(fixtures[0] ?? null);
  const indexRef = useRef(0);
  const lastCorrectRef = useRef(false);
  const fixturesLenRef = useRef(fixtures.length);
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
  const playChrome = phase === 'countdown' || phase === 'playing' || phase === 'reveal';
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

  useEffect(() => {
    if (!loading && user && !isAdmin) navigate('/profile');
  }, [loading, user, isAdmin, navigate]);

  // Wait for PressStart2P so the first season card never flashes monospace
  useEffect(() => {
    let cancelled = false;
    ensureRetroPixelFont().then(() => {
      if (!cancelled) setPixelFontReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const restart = useCallback(() => {
    timerEpoch.current += 1;
    setPuzzle(createMockRetroPuzzle());
    setPhase('intro');
    setIndex(0);
    setCountdown(3);
    setOutcomes([]);
    setLastCorrect(false);
    setLastTimedOut(false);
    setRevealFixture(null);
    setTimerPct(1);
    setDragX(0);
    setDragY(0);
    setInteractive(true);
    setCardKey('intro');
    setFlipKey(0);
  }, []);

  // Countdown 3 → 2 → 1 → first fixture
  useEffect(() => {
    if (phase !== 'countdown') return;
    setInteractive(false);
    if (countdown < 1) return;
    const id = window.setTimeout(() => {
      if (countdown <= 1) {
        setPhase('playing');
        setIndex(0);
        setCardKey(`play-0-${Date.now()}`);
        setFlipKey((k) => k + 1);
      } else {
        setCountdown((c) => c - 1);
      }
    }, 1000);
    return () => window.clearTimeout(id);
  }, [countdown, phase]);

  // Celebrate correct picks as the score face flips in
  useEffect(() => {
    if (phase !== 'reveal' || !lastCorrect) return;
    const id = window.setTimeout(() => {
      void confetti({ particleCount: 160, spread: 70, origin: { y: 0.25 } });
    }, RETRO_REVEAL_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [flipKey, lastCorrect, phase]);

  // Unlock swipes + run timer after promote / reveal flip
  useEffect(() => {
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
          ? 280 // settle after programmatic swipe — no promote flip
          : (fromCountdown ? RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS : RETRO_PROMOTE_FLIP_DELAY_MS) +
            RETRO_PROMOTE_FLIP_MS
        : RETRO_REVEAL_HOLD_MS + RETRO_REVEAL_FLIP_MS;
    const epoch = ++timerEpoch.current;
    const isPlaying = phase === 'playing';

    const unlockId = window.setTimeout(() => {
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
      // Reveal → score sheet: unlock swipe. Streak continues via on-card 3-2-1.
      if (phase === 'reveal' && !(lastCorrectRef.current && indexRef.current < fixturesLenRef.current - 1)) {
        setInteractive(true);
      }
    }, hold);

    const timeoutId = isPlaying
      ? window.setTimeout(() => {
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
      window.clearTimeout(unlockId);
      if (timeoutId) window.clearTimeout(timeoutId);
      cancelAnimationFrame(timerRaf.current);
      timerEpoch.current += 1;
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

  const advanceFromReveal = useCallback((opts?: { instant?: boolean }) => {
    timerEpoch.current += 1;
    setDragX(0);
    setDragY(0);
    if (lastCorrectRef.current && indexRef.current < fixturesLenRef.current - 1) {
      const next = indexRef.current + 1;
      setIndex(next);
      setPhase('playing');
      setCardKey(
        opts?.instant ? `play-${next}-instant-${Date.now()}` : `play-${next}-${Date.now()}`
      );
      if (!opts?.instant) setFlipKey((k) => k + 1);
      setInteractive(false);
      return;
    }
    setPhase('score');
    setCardKey(`score-${Date.now()}`);
    setInteractive(true);
    if (lastCorrectRef.current && indexRef.current === fixturesLenRef.current - 1) {
      void confetti({ particleCount: 280, spread: 90, origin: { y: 0.3 } });
    }
  }, []);

  /** After 3-2-1 on a correct streak — swipe the reveal away onto the next fixture. */
  const swipeToNextFixture = useCallback(() => {
    setFlyAwayNonce((n) => n + 1);
  }, []);

  const onSwipeAway = useCallback((dx: number, dy: number) => {
    timerEpoch.current += 1;
    setDragX(0);
    setDragY(0);
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
        // Programmatic (or manual) swipe after 3-2-1 — plant next fixture under the fly-off
        advanceFromReveal({ instant: true });
        return;
      }
      // Run over — swipe to score sheet
      setPhase('score');
      setCardKey(`score-${Date.now()}`);
      setInteractive(true);
      if (lastCorrectRef.current && indexRef.current === fixturesLenRef.current - 1) {
        void confetti({ particleCount: 280, spread: 90, origin: { y: 0.3 } });
      }
    }
  }, [advanceFromReveal]);

  const commitPick = useCallback(
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
      setDragX(0);
      setDragY(0);
    },
    [phase, interactive, fixture]
  );

  if (loading || !user || !pixelFontReady) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: BG }}>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const timerRunning = phase === 'playing' && interactive;
  // During promote flip (before unlock) still show countdown at 10 — skip the white “current” pip flash
  const secondsLeft = timerRunning ? Math.max(1, Math.ceil(timerPct * 10)) : 10;
  const pipTimerPct = timerRunning ? timerPct : 1;

  const logoBack = <RetroDailyLogoBack seasonLabel={puzzle.seasonFull} />;
  const scoreBlurb = retroScoreBlurb(score, fixtures.length, perfect);
  const scoreFace = (
    <RetroDailyScoreCard
      seasonLabel={puzzle.seasonFull}
      fixtures={fixtures}
      outcomes={outcomes}
      score={score}
      perfect={perfect}
      userId={user.id}
      userNameFallback={
        (typeof user.user_metadata?.display_name === 'string' && user.user_metadata.display_name) ||
        user.email?.split('@')[0] ||
        'Player'
      }
    />
  );

  let face: React.ReactNode = null;
  if (phase === 'intro') {
    face = <RetroDailyIntroCard seasonLabel={puzzle.seasonFull} />;
  } else if (phase === 'countdown') {
    face = <RetroDailyCountdownCard value={countdown} />;
  } else if (phase === 'playing' && fixture) {
    face = fromInstant ? (
      <RetroDailyFixtureCard fixture={fixture} />
    ) : (
      <RetroDailyPromoteFlipCard
        fixture={fixture}
        flipKey={flipKey}
        seasonLabel={puzzle.seasonFull}
        holdMs={fromCountdown ? RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS : RETRO_PROMOTE_FLIP_DELAY_MS}
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
  } else {
    face = logoBack;
  }

  const absX = Math.abs(dragX);
  const absY = Math.abs(dragY);
  const highlightHome =
    phase === 'playing' && interactive && dragX < 0 && absX >= absY * 1.15 && absX > 30;
  const highlightAway =
    phase === 'playing' && interactive && dragX > 0 && absX >= absY * 1.15 && absX > 30;
  const highlightDraw =
    phase === 'playing' && interactive && dragY > 0 && absY >= absX * 1.05 && absY > 30;

  return (
    <div
      className="fixed left-0 right-0 flex flex-col overflow-hidden text-white"
      style={{
        backgroundColor: BG,
        top: 'var(--app-offset-top, 0px)',
        height: 'var(--app-height, 100svh)',
        maxHeight: 'var(--app-height, 100svh)',
      }}
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.85rem,env(safe-area-inset-bottom,0px))]">
        <header className="relative mb-1.5 flex min-h-11 shrink-0 items-center justify-center py-0.5">
          <button
            type="button"
            aria-label="Close"
            onClick={() => navigate('/admin-data')}
            className="absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-2xl leading-none hover:bg-white/10"
          >
            ×
          </button>
          <div className="flex flex-col items-center px-12">
            <h1 className="text-sm font-black leading-tight">Retro Totl Daily</h1>
            <p
              className="mt-1 text-lg leading-none text-white sm:text-xl"
              style={{ fontFamily: "'PressStart2P', monospace" }}
            >
              {puzzle.seasonFull}
            </p>
          </div>
          <Link
            to="/admin/retro-totl-daily/scoreboard"
            className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-extrabold text-white/90 hover:text-white"
          >
            Scoreboard
          </Link>
        </header>

        {phase === 'score' ? (
          <p className="mb-2 shrink-0 px-2 text-center text-sm font-extrabold leading-snug text-white/85">
            {scoreBlurb}
          </p>
        ) : null}

        {/* Measured slot — SwipeStack sizes the card in px (Safari-safe) */}
        <div className="min-h-0 w-full flex-1">
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
            disabled={
              !interactive ||
              phase === 'countdown' ||
              phase === 'score' ||
              (phase === 'reveal' && revealContinues)
            }
            onDrag={(dx, dy) => {
              setDragX(dx);
              setDragY(dy);
            }}
            onSwipeAway={onSwipeAway}
          >
            {face}
          </RetroDailySwipeStack>
        </div>

        {/* Buttons + pips always visible — never covered by Safari chrome */}
        <div className="mt-3 flex w-full shrink-0 flex-col items-center">
          {phase === 'intro' ? (
            <div className="flex w-full items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="rounded-full border-[1.5px] border-white px-5 py-3 text-sm font-extrabold text-white"
              >
                Rules
              </button>
              <Link
                to="/admin/retro-totl-daily/scoreboard"
                className="rounded-full border-[1.5px] border-white/50 px-5 py-3 text-sm font-extrabold text-white/90 hover:border-white hover:text-white"
              >
                Scoreboard
              </Link>
            </div>
          ) : null}

          {playChrome ? (
            <div className="flex w-full flex-col items-center gap-2.5">
              <div className="flex w-full gap-2.5">
                {(
                  [
                    ['H', 'Home Win', highlightHome],
                    ['D', 'Draw', highlightDraw],
                    ['A', 'Away Win', highlightAway],
                  ] as const
                ).map(([pick, label, hot]) => (
                  <button
                    key={pick}
                    type="button"
                    disabled={phase !== 'playing' || !interactive}
                    onClick={() => commitPick(pick)}
                    className={`h-12 flex-1 rounded-2xl text-sm font-extrabold text-white disabled:opacity-50 sm:h-14 ${
                      hot ? 'bg-[#1C8376] scale-105' : 'bg-white/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <RetroDailyProgressPips
                total={fixtures.length}
                completed={outcomes.length}
                current={index}
                mode={phase === 'playing' ? 'countdown' : 'progress'}
                secondsLeft={secondsLeft}
                timerPct={pipTimerPct}
              />
            </div>
          ) : null}

          {phase === 'score' ? (
            <div className="flex w-full flex-col items-center gap-2.5">
              <button
                type="button"
                onClick={restart}
                className="h-12 w-full rounded-2xl bg-[#1C8376] text-base font-extrabold text-white sm:h-14"
              >
                Play again
              </button>
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
            </div>
          ) : null}
        </div>
      </div>

      <RetroDailyRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
