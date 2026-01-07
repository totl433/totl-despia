import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | React.ReactNode;
  subcopy?: string;
  loading?: boolean;
  className?: string;
}

export const StatCard = React.memo(function StatCard({
  label,
  value,
  subcopy,
  loading = false,
  className = '',
}: StatCardProps) {
  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 ${className}`}>
        <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">{label}</div>
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
      </div>
    );
  }

  // Check if value is a ReactNode (object) or string
  const isReactNode = typeof value === 'object' && value !== null;
  
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 ${className}`}>
      <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">{label}</div>
      <div className={`mb-1 flex items-baseline ${isReactNode ? '' : 'text-2xl font-bold text-slate-800 dark:text-slate-100'}`}>
        {value}
      </div>
      {subcopy && (
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">{subcopy}</div>
      )}
    </div>
  );
});

