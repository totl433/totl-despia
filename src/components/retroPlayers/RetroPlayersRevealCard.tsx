import { useEffect, useRef } from 'react';
import { retroBadgeUrl } from '../../lib/retroDaily/badges';
import type { PlayersCard, PlayersClubOption } from '../../lib/retroPlayers/buildPuzzle';

/** How long a correct answer stays up before the next card. */
export const PLAYERS_RESULT_HOLD_MS = 900;

export type PlayersRoundOutcome = {
  card: PlayersCard;
  pick: PlayersClubOption | null;
  correct: boolean;
  timedOut: boolean;
};

function ResultFace({
  card,
  correct,
  timedOut,
  swipeHint,
}: {
  card: PlayersCard;
  correct: boolean;
  timedOut: boolean;
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
  const onAutoAdvanceRef = useRef(onAutoAdvance);
  onAutoAdvanceRef.current = onAutoAdvance;

  useEffect(() => {
    if (!autoContinue) return;
    const id = window.setTimeout(() => onAutoAdvanceRef.current(), PLAYERS_RESULT_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [autoContinue, flipKey]);

  return (
    <ResultFace
      card={card}
      correct={correct}
      timedOut={timedOut}
      swipeHint={!autoContinue && swipeReady}
    />
  );
}
