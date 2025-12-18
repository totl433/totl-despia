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
      <div className={`bg-white rounded-xl shadow-md p-6 ${className}`}>
        <div className="text-sm text-slate-500 mb-2">{label}</div>
        <div className="h-8 bg-slate-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-md p-6 ${className}`}>
      <div className="text-sm font-medium text-slate-600 mb-2">{label}</div>
      <div className="text-2xl font-bold text-slate-800 mb-1">{value}</div>
      {subcopy && (
        <div className="text-sm text-slate-500 mt-2">{subcopy}</div>
      )}
    </div>
  );
});

