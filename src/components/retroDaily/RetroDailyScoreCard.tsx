import type { RetroFixture } from '../../lib/retroDaily/mockPuzzle';
import { pickLabel, type RetroPick } from '../../lib/retroDaily/mockPuzzle';
import { retroBadgeUrl } from '../../lib/retroDaily/badges';
import type { RetroRoundOutcome } from './RetroDailyRevealCard';

/** Final score card with all fixtures. */
export default function RetroDailyScoreCard({
  seasonLabel,
  fixtures,
  outcomes,
  score,
  perfect,
}: {
  seasonLabel: string;
  fixtures: RetroFixture[];
  outcomes: RetroRoundOutcome[];
  score: number;
  perfect: boolean;
}) {
  const byId = new Map(outcomes.map((o) => [o.fixture.id, o]));
  const blurb = perfect
    ? 'Perfect ten — absolute scenes.'
    : score === 0
      ? 'Rough start — try another season.'
      : 'Solid run. Play again for a new year.';

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-white px-3.5 pb-2.5 pt-3 shadow-lg">
      <div className="mb-2 flex items-baseline gap-2.5 px-1">
        <span className="text-2xl text-slate-900" style={{ fontFamily: "'PressStart2P', monospace" }}>
          {score}/{fixtures.length}
        </span>
        <span className="text-[10px] text-teal-700" style={{ fontFamily: "'PressStart2P', monospace" }}>
          {seasonLabel}
        </span>
      </div>
      <p className="mb-2 px-1 text-[11px] font-bold text-slate-500">Retro Totl Daily · {blurb}</p>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {fixtures.map((fixture) => {
          const o = byId.get(fixture.id);
          const muted = !o;
          return (
            <div
              key={fixture.id}
              className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${muted ? 'opacity-35' : ''}`}
            >
              <Badge code={fixture.homeCode} />
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">
                {fixture.homeName} {fixture.homeScore}-{fixture.awayScore} {fixture.awayName}
              </span>
              <Badge code={fixture.awayCode} />
              <span className="w-5 text-center text-sm font-black">{o ? (o.correct ? '✓' : '✗') : '·'}</span>
              <span className="w-10 text-right text-[10px] font-bold text-slate-400">
                {o?.pick ? pickLabel(o.pick as RetroPick).slice(0, 1) : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ code }: { code: string }) {
  const src = retroBadgeUrl(code);
  if (!src) return <span className="h-[18px] w-[18px]" />;
  return <img src={src} alt="" className="h-[18px] w-[18px] object-contain" />;
}
