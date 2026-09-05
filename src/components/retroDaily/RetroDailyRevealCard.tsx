import { useEffect, useState } from 'react';
import { retroBadgeUrl } from '../../lib/retroDaily/badges';
import type { RetroFixture, RetroPick } from '../../lib/retroDaily/mockPuzzle';
import { pickLabel } from '../../lib/retroDaily/mockPuzzle';
import RetroDailyTotlPattern from './RetroDailyTotlPattern';
import RetroDailyFlip from './RetroDailyFlip';

/** Sit on the loading face before revealing the score. */
export const RETRO_REVEAL_HOLD_MS = 2000;
/** Transition duration into the score face (kept for parent unlock timing). */
export const RETRO_REVEAL_FLIP_MS = 420;
/** Seconds shown on the score face before auto-advancing (3 → 2 → 1). */
export const RETRO_REVEAL_NEXT_BEAT_MS = 900;

export function resultMatchesPick(fixture: RetroFixture, pick: RetroPick | null): boolean {
  return pick != null && pick === fixture.result;
}

export type RetroRoundOutcome = {
  fixture: RetroFixture;
  pick: RetroPick | null;
  correct: boolean;
  timedOut: boolean;
};

/** Exact Ionicons `football` glyph — white, bob + spin like Expo. */
function FootballIcon({ size = 56 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      fill="#FFFFFF"
    >
      <path d="M256,48C141.31,48,48,141.31,48,256s93.31,208,208,208,208-93.31,208-208S370.69,48,256,48ZM399,352H353.78a8,8,0,0,1-6.91-4l-16.14-27.68a8,8,0,0,1-.86-6l14.86-59.92a8,8,0,0,1,4.65-5.45l28.1-11.9a8,8,0,0,1,8.34,1.3l41.63,35.82a8,8,0,0,1,2.69,7.26,174.75,174.75,0,0,1-24.28,66.68A8,8,0,0,1,399,352ZM134.52,237.13l28.1,11.9a8,8,0,0,1,4.65,5.45l14.86,59.92a8,8,0,0,1-.86,6L165.13,348a8,8,0,0,1-6.91,4H113a8,8,0,0,1-6.82-3.81,174.75,174.75,0,0,1-24.28-66.68,8,8,0,0,1,2.69-7.26l41.63-35.82A8,8,0,0,1,134.52,237.13Zm256.94-87.24-18.07,51.38A8,8,0,0,1,369,206l-29.58,12.53a8,8,0,0,1-8.26-1.24l-56.26-47.19A8,8,0,0,1,272,164V130.42a8,8,0,0,1,3.56-6.65l42.83-28.54a8,8,0,0,1,7.66-.67A176.92,176.92,0,0,1,390,142,8,8,0,0,1,391.46,149.89ZM193.6,95.23l42.84,28.54a8,8,0,0,1,3.56,6.65V164a8,8,0,0,1-2.86,6.13l-56.26,47.19a8,8,0,0,1-8.26,1.24L143,206a8,8,0,0,1-4.43-4.72l-18.07-51.38A8,8,0,0,1,122,142a176.92,176.92,0,0,1,64-47.48A8,8,0,0,1,193.6,95.23Zm17.31,327.46L191.18,373a8,8,0,0,1,.52-7l15.17-26a8,8,0,0,1,6.91-4h84.44a8,8,0,0,1,6.91,4l15.18,26a8,8,0,0,1,.53,7l-19.59,49.67a8,8,0,0,1-5.69,4.87,176.58,176.58,0,0,1-79,0A8,8,0,0,1,210.91,422.69Z" />
    </svg>
  );
}

function BounceDot({ delayMs }: { delayMs: number }) {
  return (
    <span
      className="mx-1 inline-block h-[10px] w-[10px] rounded-full bg-white"
      style={{
        animation: 'retroDot 0.64s ease-in-out infinite',
        animationDelay: `${delayMs}ms`,
      }}
    />
  );
}

/** Teal hold face: bouncing ball + dots while waiting for the score. */
function LoadingFace() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[28px] bg-[#0F766E] px-6 shadow-lg">
      <RetroDailyTotlPattern />
      <div
        className="relative z-[1] mb-[18px]"
        style={{ animation: 'retroBall 0.84s ease-in-out infinite' }}
      >
        <div style={{ animation: 'retroSpin 0.9s linear infinite' }}>
          <FootballIcon size={56} />
        </div>
      </div>
      <p
        className="relative z-[1] mb-4 text-center text-[11px] leading-[18px] text-white"
        style={{ fontFamily: "'PressStart2P', monospace" }}
      >
        Checking result…
      </p>
      <div className="relative z-[1] flex items-center">
        <BounceDot delayMs={0} />
        <BounceDot delayMs={140} />
        <BounceDot delayMs={280} />
      </div>
      <style>{`
        @keyframes retroBall {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        @keyframes retroSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes retroDot {
          0%, 100% { transform: translateY(0); opacity: 0.45; }
          50% { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function ScoreFace({
  fixture,
  correct,
  timedOut,
  nextCountdown,
  swipeHint,
}: {
  fixture: RetroFixture;
  correct: boolean;
  timedOut: boolean;
  /** Small 3-2-1 at the bottom when continuing the streak. */
  nextCountdown: number | null;
  /** Shown when the run ends — swipe to the score sheet. */
  swipeHint: boolean;
}) {
  const statusBg = correct ? '#1C8376' : '#DC2626';
  const statusLabel = timedOut ? 'TOO SLOW!' : correct ? 'CORRECT' : 'INCORRECT';

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-[28px] bg-white p-5 shadow-lg">
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex items-center justify-between gap-2">
          <TeamMini code={fixture.homeCode} name={fixture.homeName} />
          <p className="min-w-[72px] text-center text-3xl font-black text-slate-900">
            {fixture.homeScore}–{fixture.awayScore}
          </p>
          <TeamMini code={fixture.awayCode} name={fixture.awayName} />
        </div>
        <div
          className={`mx-auto mt-6 rounded-full px-5 py-2 text-sm font-black text-white ${correct ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: statusBg }}
        >
          {statusLabel}
        </div>
      </div>
      <div className="flex h-14 items-center justify-center">
        {nextCountdown != null ? (
          <p
            key={nextCountdown}
            className="text-5xl font-black tabular-nums leading-none text-slate-500"
            style={{
              fontFamily: "'PressStart2P', monospace",
              animation: 'retroRevealCount 0.35s ease-out',
            }}
          >
            {nextCountdown}
          </p>
        ) : swipeHint ? (
          <p className="text-center text-sm font-extrabold text-slate-600">Swipe to see your score</p>
        ) : null}
      </div>
      <style>{`
        @keyframes retroRevealCount {
          from { transform: scale(0.7); opacity: 0.35; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function TeamMini({ code, name }: { code: string; name: string }) {
  const src = retroBadgeUrl(code);
  return (
    <div className="flex flex-1 flex-col items-center">
      {src ? (
        <img
          src={src}
          alt=""
          className="h-16 w-16 object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      <p className="mt-2 text-center text-xs font-extrabold leading-tight text-slate-900">{name}</p>
    </div>
  );
}

/**
 * Holds on loading, then flips to score.
 * Streak continues → small 3-2-1 then onAutoAdvance.
 * Run over (wrong / last) → “Swipe to see your score” (parent unlocks swipe).
 */
export default function RetroDailyRevealCard({
  fixture,
  correct,
  timedOut,
  flipKey = 0,
  holdMs = RETRO_REVEAL_HOLD_MS,
  flipMs = RETRO_REVEAL_FLIP_MS,
  beatMs = RETRO_REVEAL_NEXT_BEAT_MS,
  autoContinue = false,
  swipeReady = false,
  onAutoAdvance,
}: {
  fixture: RetroFixture;
  correct: boolean;
  timedOut: boolean;
  flipKey?: number;
  holdMs?: number;
  flipMs?: number;
  beatMs?: number;
  /** True when the next fixture should auto-appear after 3-2-1. */
  autoContinue?: boolean;
  /** Parent has unlocked swipe for the score-sheet path. */
  swipeReady?: boolean;
  onAutoAdvance?: () => void;
}) {
  const [showScore, setShowScore] = useState(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);

  useEffect(() => {
    setShowScore(false);
    setNextCountdown(null);
    const id = window.setTimeout(() => setShowScore(true), holdMs);
    return () => window.clearTimeout(id);
  }, [fixture.id, flipKey, holdMs]);

  useEffect(() => {
    if (!showScore || !autoContinue || !onAutoAdvance) return;
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => setNextCountdown(3), Math.max(0, flipMs + 80))
    );
    timers.push(window.setTimeout(() => setNextCountdown(2), flipMs + 80 + beatMs));
    timers.push(window.setTimeout(() => setNextCountdown(1), flipMs + 80 + beatMs * 2));
    timers.push(
      window.setTimeout(() => {
        setNextCountdown(null);
        onAutoAdvance();
      }, flipMs + 80 + beatMs * 3)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [showScore, autoContinue, flipMs, beatMs, onAutoAdvance, fixture.id, flipKey]);

  return (
    <RetroDailyFlip
      resetKey={`${flipKey}-${fixture.id}-${correct}-${timedOut}`}
      showB={showScore}
      durationMs={flipMs}
      faceA={<LoadingFace />}
      faceB={
        <ScoreFace
          fixture={fixture}
          correct={correct}
          timedOut={timedOut}
          nextCountdown={autoContinue ? nextCountdown : null}
          swipeHint={!autoContinue && swipeReady}
        />
      }
    />
  );
}

export { pickLabel };
