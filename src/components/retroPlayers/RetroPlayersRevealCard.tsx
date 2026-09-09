import { useEffect, useState } from 'react';
import { retroBadgeUrl } from '../../lib/retroDaily/badges';
import RetroDailyTotlPattern from '../retroDaily/RetroDailyTotlPattern';
import RetroDailyFlip from '../retroDaily/RetroDailyFlip';
import type { PlayersCard, PlayersClubOption } from '../../lib/retroPlayers/buildPuzzle';

export const PLAYERS_REVEAL_HOLD_MS = 2000;
export const PLAYERS_REVEAL_FLIP_MS = 420;

export type PlayersRoundOutcome = {
  card: PlayersCard;
  pick: PlayersClubOption | null;
  correct: boolean;
  timedOut: boolean;
};

function LoadingFace() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[28px] bg-[#0F766E] px-6 shadow-lg">
      <RetroDailyTotlPattern />
      <p
        className="relative z-[1] text-center text-[11px] leading-[18px] text-white"
        style={{ fontFamily: "'PressStart2P', monospace" }}
      >
        Checking…
      </p>
    </div>
  );
}

function ResultFace({
  card,
  correct,
  timedOut,
  nextCountdown,
  swipeHint,
}: {
  card: PlayersCard;
  correct: boolean;
  timedOut: boolean;
  nextCountdown: number | null;
  swipeHint: boolean;
}) {
  const statusBg = correct ? '#1C8376' : '#DC2626';
  const statusLabel = timedOut ? 'TOO SLOW!' : correct ? 'CORRECT' : 'INCORRECT';
  const badge = retroBadgeUrl(card.correct.clubCode);

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-[28px] bg-white p-5 shadow-lg">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div
          className="rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wide text-white"
          style={{ backgroundColor: statusBg }}
        >
          {statusLabel}
        </div>
        <p className="mt-5 text-lg font-black text-slate-900">{card.playerName}</p>
        <div className="mt-4 flex h-20 w-20 items-center justify-center">
          {badge ? (
            <img src={badge} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
          ) : null}
        </div>
        <p className="mt-3 text-base font-extrabold text-slate-800">{card.correct.clubName}</p>
        {card.yearsAtClub ? (
          <p
            className="mt-1 text-slate-700"
            style={{ fontFamily: "'PressStart2P', monospace", fontSize: 10, lineHeight: 1.45 }}
          >
            {card.yearsAtClub}
          </p>
        ) : null}
        <p className="mt-1 text-sm font-bold text-slate-500">
          {card.appearances} Premier League appearance{card.appearances === 1 ? '' : 's'}
        </p>
      </div>
      <div className="shrink-0 text-center">
        {nextCountdown != null ? (
          <p className="text-sm font-extrabold text-slate-500">Next in {nextCountdown}…</p>
        ) : null}
        {swipeHint ? (
          <p className="text-sm font-extrabold text-slate-500">Swipe for your score</p>
        ) : null}
      </div>
    </div>
  );
}

export default function RetroPlayersRevealCard({
  card,
  correct,
  timedOut,
  flipKey,
  autoContinue,
  swipeReady,
  onAutoAdvance,
}: {
  card: PlayersCard;
  correct: boolean;
  timedOut: boolean;
  flipKey: number;
  autoContinue: boolean;
  swipeReady: boolean;
  onAutoAdvance: () => void;
}) {
  const [showResult, setShowResult] = useState(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);

  useEffect(() => {
    setShowResult(false);
    setNextCountdown(null);
    const id = window.setTimeout(() => setShowResult(true), PLAYERS_REVEAL_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [flipKey]);

  useEffect(() => {
    if (!showResult || !autoContinue) return;
    setNextCountdown(3);
    const a = window.setTimeout(() => setNextCountdown(2), 900);
    const b = window.setTimeout(() => setNextCountdown(1), 1800);
    const c = window.setTimeout(() => onAutoAdvance(), 2700);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
      window.clearTimeout(c);
    };
  }, [autoContinue, onAutoAdvance, showResult]);

  return (
    <RetroDailyFlip
      resetKey={flipKey}
      durationMs={PLAYERS_REVEAL_FLIP_MS}
      faceA={<LoadingFace />}
      faceB={
        <ResultFace
          card={card}
          correct={correct}
          timedOut={timedOut}
          nextCountdown={autoContinue ? nextCountdown : null}
          swipeHint={!autoContinue && swipeReady}
        />
      }
      showB={showResult}
    />
  );
}
