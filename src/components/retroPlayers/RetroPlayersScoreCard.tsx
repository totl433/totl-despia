import { retroBadgeUrl } from '../../lib/retroDaily/badges';
import type { PlayersCard } from '../../lib/retroPlayers/buildPuzzle';
import type { PlayersRoundOutcome } from './RetroPlayersRevealCard';

export function playersScoreBlurb(score: number, _total: number, perfect: boolean): string {
  if (perfect) return 'Perfect run — every club nailed.';
  if (score === 0) return 'Tough start. Have another go.';
  if (score <= 3) return 'A few legends spotted. Keep digging.';
  if (score <= 6) return 'Solid recall — the short stints bite.';
  return 'Nearly there — one more for glory.';
}

/** End-of-run sheet for The Players. */
export default function RetroPlayersScoreCard({
  cards,
  outcomes,
  score,
  perfect,
}: {
  cards: PlayersCard[];
  outcomes: PlayersRoundOutcome[];
  score: number;
  perfect: boolean;
}) {
  const byId = new Map(outcomes.map((o) => [o.card.id, o]));

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-white px-3 pb-2 pt-2.5 shadow-lg">
      <div className="shrink-0 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-slate-400">Your score</p>
        <p
          className="mt-1 text-slate-900"
          style={{ fontFamily: "'PressStart2P', monospace", fontSize: 22 }}
        >
          {score}/{cards.length}
        </p>
        {perfect ? (
          <p className="mt-1 text-xs font-extrabold text-[#1C8376]">PERFECT</p>
        ) : null}
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col justify-evenly py-0.5">
        {cards.map((card, i) => {
          const o = byId.get(card.id);
          const muted = !o;
          return (
            <div
              key={card.id}
              className={`flex h-full min-h-0 flex-1 items-center gap-2 px-1 ${
                i % 2 === 0 ? 'bg-slate-50/90' : 'bg-white'
              } ${muted ? 'opacity-40 blur-[2.5px]' : ''}`}
            >
              <div className="flex w-6 shrink-0 items-center justify-center">
                {o ? (
                  o.correct ? (
                    <span className="text-lg font-black leading-none text-emerald-600">✓</span>
                  ) : (
                    <span className="text-lg font-black leading-none text-red-600">✗</span>
                  )
                ) : (
                  <span className="text-slate-300">·</span>
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{card.playerName}</p>
              <p className="w-[3.25rem] shrink-0 text-right text-[11px] font-extrabold tabular-nums text-slate-500">
                {card.questionSeason ?? ''}
              </p>
              <img
                src={retroBadgeUrl(card.correct.clubCode)}
                alt=""
                className="h-5 w-5 shrink-0 object-contain"
              />
              <p className="w-10 shrink-0 text-right text-xs font-extrabold tabular-nums text-slate-600">
                {card.appearances}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
