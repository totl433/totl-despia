import { retroBadgeUrl } from '../../lib/retroDaily/badges';
import { getTeamColor } from '../../lib/retroDaily/teamColors';
import type { RetroFixture } from '../../lib/retroDaily/mockPuzzle';

/** Fixture face — badges + diagonal colours (no finish ranks on web). */
export default function RetroDailyFixtureCard({ fixture }: { fixture: RetroFixture }) {
  const homeColor = getTeamColor(fixture.homeCode, fixture.homeName);
  const awayColor = getTeamColor(fixture.awayCode, fixture.awayName);
  const homeBadge = retroBadgeUrl(fixture.homeCode);
  const awayBadge = retroBadgeUrl(fixture.awayCode);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-white shadow-lg">
      <div className="shrink-0 bg-white px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-3.5">
        <p className="text-center text-xs font-bold text-slate-500 sm:text-sm">{fixture.kickoffLabel}</p>
        {/* Equal columns + locked badge wells so crests always line up */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
          <TeamSide name={fixture.homeName} badge={homeBadge} color={homeColor} />
          <TeamSide name={fixture.awayName} badge={awayBadge} color={awayColor} />
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
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

function TeamSide({ name, badge, color }: { name: string; badge: string; color: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center sm:h-[88px] sm:w-[88px]">
        {badge ? (
          <img
            src={badge}
            alt=""
            className="max-h-full max-w-full object-contain object-center"
            draggable={false}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.visibility = 'hidden';
            }}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center rounded-full text-lg font-black text-white sm:text-xl"
            style={{ backgroundColor: color }}
          >
            {name.slice(0, 3).toUpperCase()}
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] w-full text-center text-xs font-black leading-tight text-slate-900 sm:text-sm">
        {name}
      </p>
    </div>
  );
}
