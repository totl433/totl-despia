import React, { useState } from 'react';
import InfoSheet from '../InfoSheet';

export interface TrophyCabinetProps {
  gameweek: number;
  monthly: number;
  season: number;
  loading?: boolean;
}

export const TrophyCabinet = React.memo(function TrophyCabinet({
  gameweek,
  monthly,
  season,
  loading = false,
}: TrophyCabinetProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const trophies = [
    { label: 'Gameweek', count: gameweek },
    { label: 'Monthly', count: monthly },
    { label: 'Season', count: season },
  ];

  const totalTrophies = gameweek + monthly + season;

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6">
        <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">Leaderboard Trophy Cabinet</div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Leaderboard Trophy Cabinet</h2>
        <div
          className="w-4 h-4 rounded-full border border-slate-400 dark:border-slate-500 flex items-center justify-center cursor-pointer"
          onClick={() => setIsInfoOpen(true)}
          role="button"
          aria-label="Information about Trophy Cabinet"
        >
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">i</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {trophies.map((trophy) => (
          <div
            key={trophy.label}
            className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"
          >
            <div className="relative mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className={`w-10 h-10 text-yellow-500 ${trophy.count > 0 ? 'sparkle-trophy' : 'opacity-40'}`}
              >
                <g>
                  <path
                    fill="currentColor"
                    d="M16 3c1.1046 0 2 0.89543 2 2h2c1.1046 0 2 0.89543 2 2v1c0 2.695 -2.1323 4.89 -4.8018 4.9941 -0.8777 1.5207 -2.4019 2.6195 -4.1982 2.9209V19h3c0.5523 0 1 0.4477 1 1s-0.4477 1 -1 1H8c-0.55228 0 -1 -0.4477 -1 -1s0.44772 -1 1 -1h3v-3.085c-1.7965 -0.3015 -3.32148 -1.4 -4.19922 -2.9209C4.13175 12.8895 2 10.6947 2 8V7c0 -1.10457 0.89543 -2 2 -2h2c0 -1.10457 0.89543 -2 2 -2zm-8 7c0 2.2091 1.79086 4 4 4 2.2091 0 4 -1.7909 4 -4V5H8zM4 8c0 1.32848 0.86419 2.4532 2.06055 2.8477C6.02137 10.5707 6 10.2878 6 10V7H4zm14 2c0 0.2878 -0.0223 0.5706 -0.0615 0.8477C19.1353 10.4535 20 9.32881 20 8V7h-2z"
                    strokeWidth="1"
                  />
                </g>
              </svg>
              {trophy.count > 0 && (
                <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center border-2 border-white">
                  {trophy.count > 99 ? '99+' : trophy.count}
                </div>
              )}
            </div>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300 text-center">{trophy.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300 text-center">
        {totalTrophies > 0
          ? `You have ${totalTrophies} ${totalTrophies === 1 ? 'trophy' : 'trophies'}.`
          : 'No trophies yet.'}
      </div>

      <InfoSheet
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        title="Leaderboard Trophy Cabinet"
        description={`Gameweek and Monthly: you earn a trophy when you finish first on the global leaderboard for a completed gameweek or monthly period. If several players tie for first, everyone at the top gets a trophy.

Season: each champion finish counts as a trophy — every mini-league you won for the full season on season-long points among members, plus overall TOTL champion when you qualify. These only appear after the final gameweek (GW38) has every result in, not for mid-season table leaders.`}
      />
    </div>
  );
});
