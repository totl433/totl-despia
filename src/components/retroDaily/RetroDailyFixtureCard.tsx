import { ordinal } from '../../lib/retroDaily/buildPuzzle';
import { retroBadgeUrl } from '../../lib/retroDaily/badges';
import { getTeamColor } from '../../lib/retroDaily/teamColors';
import type { RetroFixture } from '../../lib/retroDaily/mockPuzzle';

/** Fixture face — badges, diagonal colours, debug finish ranks. */
export default function RetroDailyFixtureCard({ fixture }: { fixture: RetroFixture }) {
  const homeColor = getTeamColor(fixture.homeCode, fixture.homeName);
  const awayColor = getTeamColor(fixture.awayCode, fixture.awayName);
  const homeBadge = retroBadgeUrl(fixture.homeCode);
  const awayBadge = retroBadgeUrl(fixture.awayCode);
  const gap =
    fixture.homeFinish != null && fixture.awayFinish != null
      ? Math.abs(fixture.homeFinish - fixture.awayFinish)
      : null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-white shadow-lg">
      <div className="bg-white px-4 pb-4 pt-3.5">
        <p className="text-center text-sm font-bold text-slate-500">{fixture.kickoffLabel}</p>
        {gap != null ? (
          <p className="mt-1 text-center text-[11px] font-bold text-slate-400">Gap {gap} · debug ranks</p>
        ) : null}
        <div className="mt-4 flex items-start justify-between gap-2">
          <TeamSide name={fixture.homeName} badge={homeBadge} color={homeColor} finish={fixture.homeFinish} />
          <TeamSide name={fixture.awayName} badge={awayBadge} color={awayColor} finish={fixture.awayFinish} />
        </div>
      </div>
      <div className="relative min-h-[140px] flex-1 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: homeColor, clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: awayColor, clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
        />
      </div>
    </div>
  );
}

function TeamSide({
  name,
  badge,
  color,
  finish,
}: {
  name: string;
  badge: string;
  color: string;
  finish: number | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center">
      {badge ? (
        <img
          src={badge}
          alt=""
          className="h-[88px] w-[88px] object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className="flex h-[88px] w-[88px] items-center justify-center rounded-full text-xl font-black text-white"
          style={{ backgroundColor: color }}
        >
          {name.slice(0, 3).toUpperCase()}
        </div>
      )}
      <p className="mt-2 text-center text-sm font-black text-slate-900">{name}</p>
      {finish != null ? (
        <p className="mt-0.5 text-center text-xs font-extrabold text-teal-700">{ordinal(finish)}</p>
      ) : null}
    </div>
  );
}
