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
import RetroDailyLogoBack from '../components/retroDaily/RetroDailyLogoBack';
import RetroDailyRevealCard, {
  resultMatchesPick,
  RETRO_REVEAL_FLIP_MS,
  RETRO_REVEAL_HOLD_MS,
  type RetroRoundOutcome,
} from '../components/retroDaily/RetroDailyRevealCard';
import RetroDailyScoreCard from '../components/retroDaily/RetroDailyScoreCard';
import RetroDailyRulesModal from '../components/retroDaily/RetroDailyRulesModal';
import RetroDailySwipeStack, {
  DRAW_THRESHOLD,
  SWIPE_THRESHOLD,
} from '../components/retroDaily/RetroDailySwipeStack';

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
  const fromCountdown = cardKey.startsWith('play-0-');
  const revealLeadsToScore =
    phase === 'reveal' && !(lastCorrect && index < fixtures.length - 1);
  const showNext = phase !== 'score';
  const showQueued =
    phase === 'intro' ||
    phase === 'countdown' ||
    phase === 'playing' ||
    (phase === 'reveal' && !revealLeadsToScore);

  useEffect(() => {
    if (!loading && user && !isAdmin) navigate('/profile');
  }, [loading, user, isAdmin, navigate]);

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
        ? (fromCountdown ? RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS : RETRO_PROMOTE_FLIP_DELAY_MS) +
          RETRO_PROMOTE_FLIP_MS
        : RETRO_REVEAL_HOLD_MS + RETRO_REVEAL_FLIP_MS;
    const epoch = ++timerEpoch.current;
    const isPlaying = phase === 'playing';

    const unlockId = window.setTimeout(() => {
      if (timerEpoch.current !== epoch) return;
      setInteractive(true);
      if (!isPlaying) return;

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
  }, [cardKey, fixtures, fromCountdown, index, phase]);

  const pickFromSwipe = (dx: number, dy: number): RetroPick => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX >= SWIPE_THRESHOLD && absX > absY * 1.15) return dx > 0 ? 'A' : 'H';
    if (dy >= DRAW_THRESHOLD && dy > absX * 1.05) return 'D';
    if (absX >= absY) return dx >= 0 ? 'A' : 'H';
    return 'D';
  };

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
        const next = indexRef.current + 1;
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
      if (lastCorrectRef.current && indexRef.current === fixturesLenRef.current - 1) {
        void confetti({ particleCount: 280, spread: 90, origin: { y: 0.3 } });
      }
    }
  }, []);

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

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: BG }}>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const p = timerPct;
  const timerColor = `rgb(${Math.round(59 + (220 - 59) * (1 - p))},${Math.round(130 + (38 - 130) * (1 - p))},${Math.round(246 + (38 - 246) * (1 - p))})`;

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
    face = <RetroDailyCountdownCard value={countdown} />;
  } else if (phase === 'playing' && fixture) {
    face = (
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
        showNextHint={interactive}
        flipKey={flipKey}
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
      className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden text-white"
      style={{ backgroundColor: BG }}
    >
      <div
        className="mx-auto flex h-full w-full max-w-md min-h-0 flex-1 flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))]"
      >
        <header className="relative mb-2 flex h-10 shrink-0 items-center justify-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => navigate('/admin-data')}
            className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none hover:bg-white/10"
          >
            ×
          </button>
          <h1 className="text-lg font-black">Retro Totl Daily</h1>
          <Link
            to="/admin/retro-totl-daily/scoreboard"
            aria-label="Scoreboard"
            className="absolute right-0 flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-white/10"
          >
            🏆
          </Link>
        </header>

        <div className="mb-2 flex h-11 shrink-0 flex-col justify-center">
          {playChrome ? (
            <>
              <div className="h-3.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full origin-left rounded-full"
                  style={{ width: `${Math.max(0.5, timerPct * 100)}%`, backgroundColor: timerColor }}
                />
              </div>
              <p className="mt-1 text-center text-xs font-bold text-white/70">
                Fixture {Math.min(index + 1, fixtures.length)} / {fixtures.length}
              </p>
            </>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center py-1">
          <RetroDailySwipeStack
            cardKey={cardKey}
            seasonLabel={puzzle.seasonFull}
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
            disabled={!interactive || phase === 'countdown' || phase === 'score'}
            onDrag={(dx, dy) => {
              setDragX(dx);
              setDragY(dy);
            }}
            onSwipeAway={onSwipeAway}
          >
            {face}
          </RetroDailySwipeStack>
        </div>

        <div className="mt-2 flex min-h-[100px] shrink-0 flex-col items-center justify-center pb-1">
          {phase === 'intro' ? (
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="rounded-full border-[1.5px] border-white px-5 py-3 text-sm font-extrabold text-white"
              >
                Rules
              </button>
              <Link to="/admin/retro-totl-daily/scoreboard" className="mt-2.5 text-sm font-bold underline">
                Scoreboard
              </Link>
              <p className="mt-2 text-xs text-white/50">Swipe the card to start</p>
            </div>
          ) : null}

          {playChrome ? (
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
                  className={`h-14 flex-1 rounded-2xl text-sm font-extrabold text-white disabled:opacity-50 ${
                    hot ? 'bg-[#1C8376] scale-105' : 'bg-white/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {phase === 'score' ? (
            <button
              type="button"
              onClick={restart}
              className="h-14 w-full rounded-2xl bg-[#1C8376] text-base font-extrabold text-white"
            >
              Play again
            </button>
          ) : null}
        </div>
      </div>

      <RetroDailyRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
