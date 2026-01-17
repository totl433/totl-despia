import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameweekState } from '../hooks/useGameweekState';
import { getLeagueAvatarUrl, getDefaultMlAvatar } from '../lib/leagueAvatars';
import type { Fixture } from './FixtureCard';

export interface MiniLeagueGwTableCardProps {
  leagueId: string;
  leagueCode: string;
  leagueName: string;
  members: Array<{ id: string; name: string }>;
  rows: Array<{ user_id: string; name: string; score: number; unicorns: number }>; // Pre-calculated rows
  rowsLoading?: boolean;
  currentUserId?: string;
  currentGw: number | null;
  maxMemberCount?: number;
  avatar?: string | null;
  unread?: number;
  sharedFixtures: Fixture[];
  sharedGwResults: Record<number, "H" | "D" | "A">;
  mockData?: {
    fixtures: Fixture[];
    picks: Array<{ user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" }>;
    results: Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>;
    displayGw: number;
    isLive?: boolean;
    rows?: Array<{ user_id: string; name: string; score: number; unicorns: number }>;
  };
}

/**
 * Calculate minimum height needed for a card based on member count
 */
function calculateCardHeight(maxMembers: number): number {
  const headerHeight = 60;
  const tableHeaderHeight = 32;
  const rowHeight = 32;
  const padding = 24;
  return headerHeight + tableHeaderHeight + (maxMembers * rowHeight) + padding;
}

/**
 * MiniLeagueGwTableCard - Pure presentational component (like LeaderboardCard)
 * Receives pre-calculated rows - just renders them
 */
export default function MiniLeagueGwTableCard({
  leagueId,
  leagueCode,
  leagueName,
  members,
  rows,
  rowsLoading = false,
  currentGw,
  maxMemberCount: _maxMemberCount,
  avatar,
  unread = 0,
  sharedFixtures = [],
  sharedGwResults = {},
  mockData,
}: MiniLeagueGwTableCardProps) {
  const displayGw = mockData?.displayGw ?? currentGw;
  const displayRows = mockData?.rows ?? rows;
  
  // Determine if GW is live
  const { state: currentGwState } = useGameweekState(currentGw);
  const isLive = mockData?.isLive ?? (currentGwState === 'LIVE' && displayGw === currentGw);

  // Avoid a brief "No results for GW xx" flash while rows are still settling in.
  // If we momentarily have an empty array (e.g. during state/cached-data transitions),
  // show the spinner for a short grace window before showing the empty state.
  const [emptyGraceActive, setEmptyGraceActive] = useState(false);
  useEffect(() => {
    if (!displayGw) return;
    if (displayRows.length > 0) {
      setEmptyGraceActive(false);
      return;
    }
    // If rows are explicitly loading, we already show spinner; no need for grace.
    if (rowsLoading) return;
    // Only apply grace if we have enough context that data is expected soon.
    if (sharedFixtures.length === 0) return;

    setEmptyGraceActive(true);
    const t = window.setTimeout(() => setEmptyGraceActive(false), 1500);
    return () => window.clearTimeout(t);
  }, [displayGw, displayRows.length, rowsLoading, sharedFixtures.length]);
  
  // Check if all fixtures are finished (for winner badge)
  const allFixturesFinished = useMemo(() => {
    if (!displayGw || sharedFixtures.length === 0) return false;
    const fixturesForGw = sharedFixtures.filter(f => f.gw === displayGw);
    if (fixturesForGw.length === 0) return false;
    
    // Check if all fixtures have results
    const results = Object.keys(sharedGwResults).map(idx => ({
      fixture_index: Number(idx),
      result: sharedGwResults[Number(idx)] as "H" | "D" | "A",
    }));
    
    return fixturesForGw.every(f => {
      return results.some(r => r.fixture_index === f.fixture_index);
    });
  }, [displayGw, sharedFixtures, sharedGwResults]);
  
  const isFinished = allFixturesFinished;
  const isDraw = displayRows.length > 1 && displayRows[0]?.score === displayRows[1]?.score && displayRows[0]?.unicorns === displayRows[1]?.unicorns;
  
  // Calculate height based on actual rows
  const memberCountForHeight = displayRows.length > 0 ? displayRows.length : members.length;
  const cardHeight = calculateCardHeight(memberCountForHeight);
  
  const badge = unread > 0 ? Math.min(unread, 99) : 0;

  return (
    <Link
      to={`/league/${leagueCode}`}
      className="w-[320px] flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden block no-underline relative"
      style={{ 
        minHeight: `${cardHeight}px`,
        height: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <style>{`
        @keyframes pulse-score {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .pulse-live-score { animation: pulse-score 2s ease-in-out infinite; }
      `}</style>
      
      {/* Chat Badge */}
      {badge > 0 && (
        <div className="absolute top-3 right-3 z-30">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#1C8376] text-white text-xs font-bold shadow-sm">
            {badge}
          </span>
        </div>
      )}
      
      {/* Header */}
      <div className="px-4 py-3 bg-white dark:bg-slate-800 rounded-t-xl">
        <div className="flex items-center gap-2">
          <img
            src={getLeagueAvatarUrl({ id: leagueId, avatar })}
            alt={`${leagueName} avatar`}
            className="w-[47px] h-[47px] rounded-full flex-shrink-0 object-cover shadow-sm"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const defaultAvatar = getDefaultMlAvatar(leagueId);
              const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
              if (target.src !== fallbackSrc) {
                target.src = fallbackSrc;
              }
            }}
          />
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="text-base font-bold text-black dark:text-slate-200 truncate inline-flex items-center gap-1.5">
              {isLive && (
                <span
                  className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="truncate">{leagueName}</span>
            </h3>
            {displayRows.length > 0 && isFinished && !isLive && (
              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 text-white shadow-sm flex-shrink-0 w-fit">
                <span className="text-[10px] font-semibold">
                  {isDraw ? 'Draw!' : `${displayRows[0].name.length > 15 ? displayRows[0].name.substring(0, 15) + '...' : displayRows[0].name} Wins!`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-2 pb-4 flex-1 flex flex-col min-h-0">
        {!displayGw ? (
          <div className="text-center py-8 flex-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">No gameweek available</div>
          </div>
        ) : displayRows.length > 0 ? (
          <div className="overflow-visible flex-1 -mx-4">
            <div className="bg-white dark:bg-slate-800 px-4">
              <table className="w-full text-sm border-collapse dark:bg-slate-800" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead className="sticky top-0 bg-white dark:bg-slate-800" style={{ 
                  position: 'sticky', 
                  top: 0, 
                  zIndex: 25, 
                  display: 'table-header-group'
                } as any}>
                  <tr className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700" style={{
                    borderBottomColor: document.documentElement.classList.contains('dark') 
                      ? '#334155' 
                      : undefined
                  }}>
                    <th className="py-2 text-left font-semibold text-xs uppercase tracking-wide bg-white dark:bg-slate-800 w-6 pl-2 pr-1 text-[#1C8376]"></th>
                    <th className="py-2 text-left font-semibold text-xs text-slate-300 dark:text-slate-400 bg-white dark:bg-slate-800 pl-2 pr-2">
                      Player
                    </th>
                    <th className="py-2 text-center font-semibold text-xs text-slate-300 dark:text-slate-400 bg-white dark:bg-slate-800 w-10 pl-1 pr-1">
                      Score
                    </th>
                    {members.length >= 3 && <th className="py-2 text-center font-semibold text-xs bg-white dark:bg-slate-800 w-8 pl-1 pr-1 text-[#1C8376] text-base">🦄</th>}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r, i) => {
                    return (
                      <tr 
                        key={r.user_id} 
                        className=""
                        style={{
                          position: 'relative',
                          backgroundColor: document.documentElement.classList.contains('dark') 
                            ? '#0f172a' 
                            : '#ffffff',
                          ...(i < displayRows.length - 1 ? { 
                            borderBottom: document.documentElement.classList.contains('dark') 
                              ? '1px solid #334155' 
                              : '1px solid #e2e8f0' 
                          } : {})
                        }}
                      >
                        <td className="py-2 text-left tabular-nums whitespace-nowrap bg-white dark:bg-slate-800 w-6 pl-2 pr-1 text-xs dark:text-slate-200">
                          {i + 1}
                        </td>
                        <td className="py-2 truncate whitespace-nowrap bg-white dark:bg-slate-800 pl-2 pr-2 text-xs dark:text-slate-200">
                          <span className="inline-flex items-center gap-1 min-w-0">
                            {isLive && (
                              <span
                                className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse flex-shrink-0"
                                aria-hidden="true"
                              />
                            )}
                            <span className="truncate">{r.name}</span>
                          </span>
                        </td>
                        <td className={`py-2 text-center tabular-nums font-bold text-[#1C8376] text-xs bg-white dark:bg-slate-800 w-10 pl-1 pr-1 ${isLive ? 'pulse-live-score' : ''}`}>
                          {r.score}
                        </td>
                        {members.length >= 3 && (
                          <td className={`py-2 text-center tabular-nums text-xs bg-white dark:bg-slate-800 w-8 pl-1 pr-1 ${isLive ? 'pulse-live-score' : ''}`}>
                            {r.unicorns}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (rowsLoading || emptyGraceActive) ? (
          <div className="flex justify-center py-8 flex-1">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <div className="text-center py-6 flex-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              No results for GW {displayGw}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
