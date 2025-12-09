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
    <div className="space-y-0">
      <div className="flex items-center justify-between py-3 border-b border-slate-200">
        <span className="text-base text-slate-600">OCP</span>
        <span className="text-lg sm:text-xl font-bold text-slate-800">{ocp}</span>
      </div>
      <div className="flex items-center justify-between py-3 border-b border-slate-200">
        <span className="text-base text-slate-600">Mini Leagues</span>
        <span className="text-lg sm:text-xl font-bold text-slate-800">{miniLeaguesCount}</span>
      </div>
      <div className="flex items-center justify-between py-3">
        <span className="text-base text-slate-600">Streak</span>
        <span className="text-lg sm:text-xl font-bold text-slate-800">{weeksStreak}</span>
      </div>
    </div>
  );
});

