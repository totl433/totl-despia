import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { isFounderAdmin } from '../lib/adminIds';
import {
  createPlayersPuzzle,
  PLAYERS_TIMER_MS,
  type PlayersClubOption,
  type PlayersPuzzle,
} from '../lib/retroPlayers/buildPuzzle';
import RetroDailyCountdownCard from '../components/retroDaily/RetroDailyCountdownCard';
import RetroDailyLogoBack from '../components/retroDaily/RetroDailyLogoBack';
import RetroDailyProgressPips from '../components/retroDaily/RetroDailyProgressPips';
import RetroDailySwipeStack, {
  DRAW_THRESHOLD,
  SWIPE_THRESHOLD,
} from '../components/retroDaily/RetroDailySwipeStack';
import { ensureRetroPixelFont } from '../lib/retroDaily/pixelFont';
import { retroBadgeUrl } from '../lib/retroDaily/badges';
import RetroPlayersIntroCard from '../components/retroPlayers/RetroPlayersIntroCard';
import RetroPlayersCard from '../components/retroPlayers/RetroPlayersCard';
import RetroPlayersPromoteFlipCard, {
  RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS,
  RETRO_PROMOTE_FLIP_DELAY_MS,
  RETRO_PROMOTE_FLIP_MS,
} from '../components/retroPlayers/RetroPlayersPromoteFlipCard';
import RetroPlayersRevealCard, {
  PLAYERS_REVEAL_FLIP_MS,
  PLAYERS_REVEAL_HOLD_MS,
  type PlayersRoundOutcome,
} from '../components/retroPlayers/RetroPlayersRevealCard';
import RetroPlayersRulesModal from '../components/retroPlayers/RetroPlayersRulesModal';
import RetroPlayersScoreCard, { playersScoreBlurb } from '../components/retroPlayers/RetroPlayersScoreCard';

type Phase = 'intro' | 'countdown' | 'playing' | 'reveal' | 'score';

const BG = '#0B1F3A';

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
 * Retro Totl Daily — The Players
 * Same shell as RTD: player name + three clubs. Public shareable URL.
 */
export default function RetroTotlDailyPlayersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isFounderAdmin(user?.id);

  const [puzzle, setPuzzle] = useState<PlayersPuzzle>(() => createPlayersPuzzle());
  const cards = puzzle.cards;
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [outcomes, setOutcomes] = useState<PlayersRoundOutcome[]>([]);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [lastTimedOut, setLastTimedOut] = useState(false);
  const [revealCard, setRevealCard] = useState<(typeof cards)[0] | null>(null);
  const [timerPct, setTimerPct] = useState(1);
  const [interactive, setInteractive] = useState(true);
  const [cardKey, setCardKey] = useState('intro');
  const [flipKey, setFlipKey] = useState(0);
  const [flyAwayNonce, setFlyAwayNonce] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pixelFontReady, setPixelFontReady] = useState(false);
  const [hotCode, setHotCode] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);

  const timerEpoch = useRef(0);
  const timerRaf = useRef(0);
  const phaseRef = useRef(phase);
  const interactiveRef = useRef(interactive);
  const cardRef = useRef(cards[0] ?? null);
  const indexRef = useRef(0);
  const lastCorrectRef = useRef(false);
  const cardsLenRef = useRef(cards.length);
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
    setDragX(0);
    setDragY(0);
  }, []);

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

  useEffect(() => {
    if (phase !== 'reveal' || !lastCorrect) return;
    const id = window.setTimeout(() => {
      void confetti({ particleCount: 160, spread: 70, origin: { y: 0.25 } });
    }, PLAYERS_REVEAL_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [flipKey, lastCorrect, phase]);

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'reveal') {
      setInteractive(phase === 'intro' || phase === 'score');
      setTimerPct(1);
      return;
    }

    setInteractive(false);
    setTimerPct(1);
    setHotCode(null);
    setDragX(0);
    setDragY(0);
    const hold =
      phase === 'playing'
        ? fromInstant
          ? 280
          : (fromCountdown ? RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS : RETRO_PROMOTE_FLIP_DELAY_MS) +
            RETRO_PROMOTE_FLIP_MS
        : PLAYERS_REVEAL_HOLD_MS + PLAYERS_REVEAL_FLIP_MS;
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
      ? window.setTimeout(() => {
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
      window.clearTimeout(unlockId);
      if (timeoutId) window.clearTimeout(timeoutId);
      cancelAnimationFrame(timerRaf.current);
      timerEpoch.current += 1;
    };
  }, [cardKey, cards, fromCountdown, fromInstant, index, phase]);

  const commitPick = useCallback((pick: PlayersClubOption) => {
    if (phaseRef.current !== 'playing' || !interactiveRef.current) return;
    const c = cardRef.current;
    if (!c) return;
    timerEpoch.current += 1;
    cancelAnimationFrame(timerRaf.current);
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
    setDragX(0);
    setDragY(0);
  }, []);

  const advanceFromReveal = useCallback((opts?: { instant?: boolean }) => {
    timerEpoch.current += 1;
    setHotCode(null);
    setDragX(0);
    setDragY(0);
    if (lastCorrectRef.current && indexRef.current < cardsLenRef.current - 1) {
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
    if (lastCorrectRef.current && indexRef.current === cardsLenRef.current - 1) {
      void confetti({ particleCount: 280, spread: 90, origin: { y: 0.3 } });
    }
  }, []);

  const swipeToNext = useCallback(() => {
    setFlyAwayNonce((n) => n + 1);
  }, []);

  const startFromIntro = useCallback(() => {
    if (phaseRef.current !== 'intro') return;
    timerEpoch.current += 1;
    setPhase('countdown');
    setCountdown(3);
    setCardKey(`countdown-${Date.now()}`);
    setInteractive(false);
  }, []);

  const onSwipeAway = useCallback(
    (dx: number, dy: number) => {
      timerEpoch.current += 1;
      setDragX(0);
      setDragY(0);
      setHotCode(null);
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
    [advanceFromReveal, commitPick, restart]
  );

  if (!pixelFontReady) {
    return <div className="h-full w-full" style={{ backgroundColor: BG }} />;
  }

  const secondsLeft = Math.max(0, Math.ceil(timerPct * (PLAYERS_TIMER_MS / 1000)));
  const pipTimerPct = phase === 'playing' ? timerPct : 1;
  const scoreBlurb = playersScoreBlurb(score, cards.length, perfect);
  const logoBack = <RetroDailyLogoBack seasonLabel="The Players" />;
  const scoreFace = (
    <RetroPlayersScoreCard cards={cards} outcomes={outcomes} score={score} perfect={perfect} />
  );

  let face: ReactNode = null;
  if (phase === 'intro') {
    face = <RetroPlayersIntroCard />;
  } else if (phase === 'countdown') {
    face = <RetroDailyCountdownCard value={countdown} />;
  } else if (phase === 'playing' && card) {
    face = fromInstant ? (
      <RetroPlayersCard card={card} />
    ) : (
      <RetroPlayersPromoteFlipCard
        card={card}
        flipKey={flipKey}
        holdMs={fromCountdown ? RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS : RETRO_PROMOTE_FLIP_DELAY_MS}
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

  const absX = Math.abs(dragX);
  const absY = Math.abs(dragY);
  const highlightLeft =
    phase === 'playing' && interactive && dragX < 0 && absX >= absY * 1.15 && absX > 30;
  const highlightMid =
    phase === 'playing' && interactive && dragY > 0 && absY >= absX * 1.05 && absY > 30;
  const highlightRight =
    phase === 'playing' && interactive && dragX > 0 && absX >= absY * 1.15 && absX > 30;

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden text-white"
      style={{ backgroundColor: BG }}
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.85rem,env(safe-area-inset-bottom,0px))]">
        <header className="relative mb-1.5 flex min-h-11 shrink-0 items-center justify-center py-0.5">
          <button
            type="button"
            aria-label="Close"
            onClick={() => navigate(isAdmin ? '/admin-data' : '/')}
            className="absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-2xl leading-none hover:bg-white/10"
          >
            ×
          </button>
          <div className="flex flex-col items-center px-12">
            <h1 className="text-sm font-black leading-tight">Retro Totl Daily</h1>
            <p
              className="mt-1 text-center text-[13px] leading-tight text-white sm:text-base"
              style={{ fontFamily: "'PressStart2P', monospace" }}
            >
              The Players
            </p>
          </div>
          <Link
            to="/admin/retro-totl-daily/players/scoreboard"
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

        <div className="min-h-0 w-full flex-1">
          <RetroDailySwipeStack
            cardKey={cardKey}
            seasonLabel="The Players"
            showNext={showNext}
            showQueued={showQueued}
            flyAwayNonce={flyAwayNonce}
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
            disabled={
              !interactive ||
              phase === 'countdown' ||
              phase === 'score' ||
              (phase === 'reveal' && revealContinues)
            }
            tapAdvances={phase === 'intro' || (phase === 'reveal' && !revealContinues)}
            onDrag={(dx, dy) => {
              setDragX(dx);
              setDragY(dy);
            }}
            onSwipeAway={onSwipeAway}
          >
            {face}
          </RetroDailySwipeStack>
        </div>

        <div className="mt-3 flex w-full shrink-0 flex-col items-center">
          {phase === 'intro' ? (
            <div className="flex w-full flex-col items-center gap-2.5">
              <button
                type="button"
                onClick={startFromIntro}
                className="h-12 w-full rounded-2xl bg-[#1C8376] text-base font-extrabold text-white sm:h-14"
              >
                Start
              </button>
              <div className="flex w-full items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRulesOpen(true)}
                  className="inline-flex items-center justify-center rounded-full border-[1.5px] border-white px-5 py-3 text-sm font-extrabold text-white"
                >
                  Rules
                </button>
                <Link
                  to="/admin/retro-totl-daily/players/scoreboard"
                  className="inline-flex items-center justify-center rounded-full border-[1.5px] border-white/50 px-5 py-3 text-sm font-extrabold text-white/90 hover:border-white hover:text-white"
                >
                  Scoreboard
                </Link>
              </div>
            </div>
          ) : null}

          {phase === 'reveal' && !revealContinues && interactive ? (
            <button
              type="button"
              onClick={() => advanceFromReveal({ instant: true })}
              className="mb-2.5 h-12 w-full rounded-2xl bg-[#1C8376] text-base font-extrabold text-white sm:h-14"
            >
              See score
            </button>
          ) : null}
          {phase === 'playing' ? (
            <div className="flex w-full flex-col items-center gap-2.5">
              <div className="flex w-full gap-2.5">
                {(card?.options ?? []).map((opt, i) => {
                  const dragHot =
                    (i === 0 && highlightLeft) ||
                    (i === 1 && highlightMid) ||
                    (i === 2 && highlightRight);
                  const hot = dragHot || hotCode === opt.clubCode;
                  const badge = retroBadgeUrl(opt.clubCode);
                  return (
                    <button
                      key={opt.clubCode}
                      type="button"
                      disabled={!interactive}
                      onClick={() => commitPick(opt)}
                      onPointerDown={() => setHotCode(opt.clubCode)}
                      onPointerUp={() => setHotCode(null)}
                      onPointerLeave={() => setHotCode(null)}
                      className={`flex h-[4.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-white disabled:opacity-50 sm:h-[4.75rem] ${
                        hot ? 'bg-[#1C8376] scale-[1.03]' : 'bg-white/20'
                      }`}
                    >
                      {badge ? (
                        <img src={badge} alt="" className="h-7 w-7 object-contain sm:h-8 sm:w-8" />
                      ) : null}
                      <span className="line-clamp-2 text-center text-[11px] font-extrabold leading-tight sm:text-xs">
                        {opt.clubName}
                      </span>
                    </button>
                  );
                })}
              </div>
              <RetroDailyProgressPips
                total={cards.length}
                completed={outcomes.length}
                current={index}
                mode="countdown"
                secondsLeft={secondsLeft}
                timerPct={pipTimerPct}
              />
            </div>
          ) : null}
          {phase === 'reveal' ? (
            <div className="flex w-full flex-col items-center gap-2.5">
              <RetroDailyProgressPips
                total={cards.length}
                completed={outcomes.length}
                current={index}
                mode="progress"
                secondsLeft={secondsLeft}
                timerPct={1}
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
            </div>
          ) : null}
        </div>
      </div>

      <RetroPlayersRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
