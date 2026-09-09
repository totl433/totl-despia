import type { PlayersCard } from '../../lib/retroPlayers/buildPuzzle';

/**
 * Front face — player + one season clue (e.g. 96/97). Club answers sit below.
 */
export default function RetroPlayersCard({ card }: { card: PlayersCard }) {
  return (
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-[28px] bg-white p-5 shadow-lg">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-slate-400">
          Card {card.index + 1}/10
        </p>
        <p className="mt-5 text-lg font-black text-slate-900">{card.playerName}</p>
        <div className="mt-4 flex h-20 w-20 items-center justify-center">
          <span
            className="text-slate-900"
            style={{ fontFamily: "'PressStart2P', monospace", fontSize: 42, lineHeight: 1 }}
            aria-hidden
          >
            ?
          </span>
        </div>
        {card.questionSeason ? (
          <p
            className="mt-3 text-slate-900"
            style={{ fontFamily: "'PressStart2P', monospace", fontSize: 16, lineHeight: 1.35 }}
          >
            {card.questionSeason}
          </p>
        ) : null}
        <p className="mt-2 text-sm font-extrabold text-slate-500">Which club that season?</p>
      </div>
    </div>
  );
}
