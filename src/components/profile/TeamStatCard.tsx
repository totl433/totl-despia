import React from 'react';
import TeamBadge from '../TeamBadge';

export interface TeamStatCardProps {
  label: string;
  teamCode: string | null;
  teamName: string;
  percentage: number;
  isCorrect: boolean; // true for correct, false for incorrect
  subcopy?: string;
  loading?: boolean;
  className?: string;
}

export const TeamStatCard = React.memo(function TeamStatCard({
  label,
  teamCode,
  teamName,
  percentage,
  isCorrect,
  subcopy,
  loading = false,
  className = '',
}: TeamStatCardProps) {
  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 ${className}`}>
        <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">{label}</div>
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
      </div>
    );
  }

  // Format percentage - use whole number if it's a round number, otherwise 2dp
  const formattedPercentage = percentage % 1 === 0 
    ? percentage.toFixed(0) 
    : percentage.toFixed(2);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 ${className}`}>
      <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">{label}</div>
      <div className="flex items-center gap-3">
        <TeamBadge code={teamCode} size={32} />
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
            {teamName}
          </div>
          <div className={`text-base font-semibold ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formattedPercentage}% {isCorrect ? 'correct' : 'incorrect'}
          </div>
        </div>
      </div>
      {subcopy && (
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-3 italic">"{subcopy}"</div>
      )}
    </div>
  );
});

