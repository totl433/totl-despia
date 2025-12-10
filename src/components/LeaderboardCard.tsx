import { Link } from "react-router-dom";
import React from "react";

type LeaderboardCardProps = {
  title: string;
  badgeSrc?: string;
  badgeAlt?: string;
  linkTo: string;
  rank: number | null;
  total: number | null;
  score?: number;
  gw?: number;
  totalFixtures?: number;
  subtitle?: string;
  variant?: 'default' | 'lastGw'; // Special variant for Last GW card
};

export const LeaderboardCard = React.memo(function LeaderboardCard({
  title,
  badgeSrc,
  badgeAlt,
  linkTo,
  rank,
  total,
  score,
  gw,
  totalFixtures,
  subtitle,
  variant = 'default',
}: LeaderboardCardProps) {
  const displayText = rank && total && total > 0 
    ? `TOP ${Math.round((rank / total) * 100)}%`
    : "—";

  // Special variant for Last GW card (shows score prominently)
  if (variant === 'lastGw') {
    return (
      <Link to={linkTo} className="flex-shrink-0 w-[148px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden cursor-pointer block hover:shadow-md transition-shadow">
        <div className="p-3 h-full flex flex-col relative">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-baseline gap-[3px]" style={{ marginTop: '-4px' }}>
              {score !== undefined && totalFixtures !== undefined ? (
                <>
                  <span className="text-[#1C8376]" style={{ fontSize: '38px', fontWeight: 'normal', lineHeight: '1' }}>{score}</span>
                  <div className="flex items-baseline gap-[4px]">
                    <span className="text-slate-500" style={{ fontSize: '18px', fontWeight: 'normal', lineHeight: '1' }}>/</span>
                    <span className="text-slate-500" style={{ fontSize: '18px', fontWeight: 'normal', lineHeight: '1' }}>{totalFixtures}</span>
                  </div>
                </>
              ) : (
                <span className="leading-none text-slate-900">—</span>
              )}
            </div>
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="mt-auto">
            <div className="text-xs text-slate-500 mb-2">Gameweek {gw ?? '—'}</div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-slate-900">
                {displayText}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Default variant
  return (
    <Link to={linkTo} className="flex-shrink-0 w-[148px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden cursor-pointer block hover:shadow-md transition-shadow">
      <div className="p-3 h-full flex flex-col">
        <div className="flex items-start justify-between mb-2">
          {badgeSrc && <img src={badgeSrc} alt={badgeAlt || title} className="w-[32px] h-[32px]" />}
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <div className="mt-auto">
          <div className="text-xs text-slate-500 mb-2">{subtitle || title}</div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-900">
              {displayText}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
});

