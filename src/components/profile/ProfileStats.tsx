import React from 'react';

export type ProfileStatsProps = {
  ocp: number;
  miniLeaguesCount: number;
  weeksStreak: number;
  loading?: boolean;
};

export const ProfileStats = React.memo(function ProfileStats({
  ocp,
  miniLeaguesCount,
  weeksStreak,
  loading = false,
}: ProfileStatsProps) {
  if (loading) {
    return (
      <div className="text-sm text-slate-500 py-4">Loading stats...</div>
    );
  }

  return (
    <div className="space-y-0 min-w-0">
      <div className="flex items-center justify-between py-3 border-b border-slate-200 gap-2">
        <span className="text-sm sm:text-base text-slate-600 flex-shrink-0">OCP</span>
        <span className="text-lg sm:text-xl font-bold text-slate-800 truncate text-right">{ocp}</span>
      </div>
      <div className="flex items-center justify-between py-3 border-b border-slate-200 gap-2">
        <span className="text-sm sm:text-base text-slate-600 flex-shrink-0">Mini Leagues</span>
        <span className="text-lg sm:text-xl font-bold text-slate-800 truncate text-right">{miniLeaguesCount}</span>
      </div>
      <div className="flex items-center justify-between py-3 gap-2">
        <span className="text-sm sm:text-base text-slate-600 flex-shrink-0">Streak</span>
        <span className="text-lg sm:text-xl font-bold text-slate-800 truncate text-right">{weeksStreak}</span>
      </div>
    </div>
  );
});

