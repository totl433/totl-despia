import React from 'react';

export interface StreakStatCardProps {
  label: string;
  streakCount: number;
  gwRange: string; // e.g., "GW6–GW10"
  subcopy?: string;
  extraLine?: string; // Optional extra fun line
  loading?: boolean;
  className?: string;
}

export const StreakStatCard = React.memo(function StreakStatCard({
  label,
  streakCount,
  gwRange,
  subcopy,
  extraLine,
  loading = false,
  className = '',
}: StreakStatCardProps) {
  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 ${className}`}>
        <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">{label}</div>
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 ${className}`}>
      <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">{label}</div>
      <div className="text-4xl font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-baseline gap-2">
        <span>{streakCount}</span>
        <span className="text-base font-normal text-slate-600 dark:text-slate-400">
          Top 25% from {gwRange}
        </span>
      </div>
      {extraLine && (
        <div className="text-sm text-slate-500 dark:text-slate-400 italic mb-2">"{extraLine}"</div>
      )}
      {subcopy && (
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-2 italic">"{subcopy}"</div>
      )}
    </div>
  );
});

