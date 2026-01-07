import { useMemo, memo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getLeagueAvatarUrl, getDefaultMlAvatar } from '../lib/leagueAvatars';
import { ordinal, toStringSet } from '../lib/helpers';
import { useGameweekState } from '../hooks/useGameweekState';
import type { GameweekState } from '../lib/gameweekState';
import UserAvatar from './UserAvatar';

export type LeagueRow = {
  id: string;
  name: string;
  code: string;
  memberCount?: number;
  submittedCount?: number;
  avatar?: string | null;
  created_at?: string | null;
  start_gw?: number | null;
};

export type LeagueMember = { 
  id: string; 
  name: string;
};

export type LeagueData = {
  id: string;
  members: LeagueMember[];
  userPosition: number | null;
  positionChange: 'up' | 'down' | 'same' | null;
  submittedMembers?: Set<string> | string[]; // Set or Array of user IDs who have submitted for current GW
  sortedMemberIds?: string[]; // Member IDs in ML table order (1st to last)
  latestGwWinners?: Set<string> | string[]; // Set or Array of members who topped the most recent completed GW
  latestRelevantGw?: number | null; // The GW number that latestGwWinners is from (needed to know when to hide shiny chips)
  webUserIds?: Set<string> | string[]; // Set or Array of user IDs who have picks in Web table (mirrored picks)
  seasonLeaderName?: string | null; // Name of the player currently top of the season table (sorted by OCP)
};

export type MiniLeagueCardProps = {
  row: LeagueRow;
  data?: LeagueData;
  unread: number;
  submissions?: { allSubmitted: boolean; submittedCount: number; totalCount: number };
  leagueDataLoading: boolean;
  currentGw: number | null;
  showRanking?: boolean; // If false, hide member count and user position (default: true)
  onTableClick?: (leagueId: string) => void; // Callback when table icon is clicked
  hidePlayerChips?: boolean; // If true, hide the player chips (default: false)
  showSeasonLeader?: boolean; // If true, show season leader name with trophy (default: false) - EXPERIMENTAL ONLY
};

/**
 * Mini League Card component - displays league info with member chips, position, and unread badge
 * Used on HomePage and Tables page
 */
export const MiniLeagueCard = memo(function MiniLeagueCard({
  row,
  data,
  unread,
  submissions,
  leagueDataLoading,
  currentGw,
  showRanking = true,
  onTableClick,
  hidePlayerChips = false,
  showSeasonLeader = false,
}: MiniLeagueCardProps) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueCard.tsx:54',message:'MiniLeagueCard render',data:{leagueId:row.id,leagueName:row.name,hidePlayerChips,hasData:!!data,dataMembersLength:data?.members?.length,leagueDataLoading,currentGw},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const members = data?.members ?? [];
  const userPosition = data?.userPosition;
  const badge = unread > 0 ? Math.min(unread, 99) : 0;

  // Check current GW state - shiny chips should ONLY show during RESULTS_PRE_GW
  const { state: currentGwState } = useGameweekState(currentGw);

  // Use ref to track previous values and prevent unnecessary recalculations
  const prevMemberChipsRef = useRef<JSX.Element[]>([]);
  const prevDataKeyRef = useRef<string>('');
  const prevCurrentGwStateRef = useRef<GameweekState | null>(null);
  
  const memberChips = useMemo(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueCard.tsx:78',message:'memberChips useMemo entry',data:{leagueId:row.id,leagueName:row.name,hidePlayerChips,leagueDataLoading,hasData:!!data,dataMembersLength:data?.members?.length,prevChipsLength:prevMemberChipsRef.current.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // If no data, return empty array (chips will appear when data loads)
    if (!data) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueCard.tsx:86',message:'Early return: no data',data:{leagueId:row.id,leagueDataLoading},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return [];
    }
    
    const baseMembers = data.members ?? [];
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueCard.tsx:86',message:'Base members check',data:{leagueId:row.id,baseMembersLength:baseMembers.length,members:baseMembers.map(m=>({id:m.id,name:m.name}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (!baseMembers.length) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueCard.tsx:87',message:'No base members - returning empty or prev',data:{leagueId:row.id,prevChipsLength:prevMemberChipsRef.current.length,returningEmpty:prevMemberChipsRef.current.length===0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // If no members, clear chips only if we had chips before (league might have been emptied)
      // Otherwise keep previous chips to prevent flash
      if (prevMemberChipsRef.current.length > 0) {
        // Only clear if we're sure this league should be empty (not just loading)
        // For now, keep previous chips to be safe
        return prevMemberChipsRef.current;
      }
      return [];
    }

    // Create stable key for data comparison
    const submittedKey = data.submittedMembers instanceof Set 
      ? Array.from(data.submittedMembers).sort().join(',')
      : (data.submittedMembers?.join(',') ?? '');
    const winnersKey = data.latestGwWinners instanceof Set
      ? Array.from(data.latestGwWinners).sort().join(',')
      : (data.latestGwWinners?.join(',') ?? '');
    const webUsersKey = data.webUserIds instanceof Set
      ? Array.from(data.webUserIds).sort().join(',')
      : (data.webUserIds?.join(',') ?? '');
    const sortedIdsKey = data.sortedMemberIds?.join(',') ?? '';
    const membersKey = baseMembers.map(m => `${m.id}:${m.name}`).join(',');
    const dataKey = `${data.id}:${data.userPosition}:${data.latestRelevantGw}:${submittedKey}:${winnersKey}:${webUsersKey}:${sortedIdsKey}:${membersKey}:${currentGw}:${currentGwState}`;
    
    // If data hasn't changed, return previous chips
    if (dataKey === prevDataKeyRef.current && currentGwState === prevCurrentGwStateRef.current) {
      return prevMemberChipsRef.current;
    }

    const orderedMembers =
      data.sortedMemberIds && data.sortedMemberIds.length > 0
        ? data.sortedMemberIds
            .map((id) => baseMembers.find((m) => m.id === id))
            .filter((m): m is LeagueMember => m !== undefined)
        : [...baseMembers].sort((a, b) => a.name.localeCompare(b.name));

    const submittedSet = toStringSet(data.submittedMembers);
    const winnersSet = toStringSet(data.latestGwWinners);
    const webUserSet = toStringSet(data.webUserIds);

    // Check if this is API Test league
    const isApiTestLeague = row.name === "API Test";
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueCard.tsx:130',message:'Creating chips from ordered members',data:{leagueId:row.id,orderedMembersLength:orderedMembers.length,orderedMemberIds:orderedMembers.map(m=>m.id),submittedCount:submittedSet.size,winnersCount:winnersSet.size,webUsersCount:webUserSet.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const result = orderedMembers.slice(0, 8).map((member, index) => {
      const hasSubmitted = submittedSet.has(member.id);
      const isLatestWinner = winnersSet.has(member.id);
      const isWebUser = webUserSet.has(member.id); // User has picks in Web table (mirrored)

      // GPU-optimized: Use CSS classes instead of inline styles
      let chipClassName = 'chip-container rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 w-6 h-6';
      
      // Show shiny chip ONLY during RESULTS_PRE_GW state (when GW has finished)
      // This ensures winners only show after a GW has fully finished, not during GW_OPEN or LIVE
      const shouldShowShiny = isLatestWinner && 
        data.latestRelevantGw !== null && 
        data.latestRelevantGw !== undefined &&
        currentGw !== null && 
        currentGwState === 'RESULTS_PRE_GW' &&
        (data.latestRelevantGw < currentGw || data.latestRelevantGw === currentGw);
      
      if (shouldShowShiny) {
        // Shiny chip for last GW winner (already GPU-optimized with transforms)
        chipClassName += ' bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 font-semibold relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]';
      } else if (hasSubmitted) {
        // Green = picked (GPU-optimized class)
        chipClassName += ' chip-green';
        // Add blue border for Web-mirrored picks (users who have picks in Web table)
        if (isWebUser) {
          // Use box-shadow for more visible blue outline on green background
          chipClassName += ' border-2 border-blue-600';
        } else if (isApiTestLeague) {
          // Keep blue border for API Test league (for backward compatibility)
          chipClassName += ' border-2 border-blue-600';
        }
      } else {
        // Grey = not picked (GPU-optimized class)
        chipClassName += ' chip-grey';
      }

      // GPU-optimized: Use transform instead of marginLeft
      if (index > 0) {
        chipClassName += ' chip-overlap';
      }

      // For Web users with submitted picks, add blue outline with box-shadow for visibility
      const chipStyle = hasSubmitted && isWebUser 
        ? { boxShadow: '0 0 0 2px #2563eb, 0 0 0 4px rgba(37, 99, 235, 0.3)' }
        : undefined;

      return (
        <div 
          key={member.id} 
          className={chipClassName} 
          title={member.name}
          style={chipStyle}
        >
          <UserAvatar
            userId={member.id}
            name={member.name}
            size={24}
            className="border-0"
            fallbackToInitials={true}
          />
        </div>
      );
    });
    
    // Store for next render
    prevDataKeyRef.current = dataKey;
    prevCurrentGwStateRef.current = currentGwState;
    prevMemberChipsRef.current = result;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueCard.tsx:192',message:'memberChips useMemo exit - returning result',data:{leagueId:row.id,resultLength:result.length,chipKeys:result.map((r:any)=>r.key)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    return result;
  }, [data, leagueDataLoading, row.name, currentGw, currentGwState]);

  const extraMembers = useMemo(() => {
    if (!data) return 0;
    const orderedMemberIds =
      (data.sortedMemberIds && data.sortedMemberIds.length > 0
        ? data.sortedMemberIds
        : data.members?.map((m) => m.id)) ?? [];
    const totalMembers = orderedMemberIds.length;
    return totalMembers > 8 ? totalMembers - 8 : 0;
  }, [data]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm w-full relative">
      <Link
        to={`/league/${row.code}`}
        className="block p-6 !bg-white dark:!bg-slate-800 no-underline relative z-20"
      >
        <div className="flex items-center gap-3 relative">
          {/* League Avatar Badge */}
          <div className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-700">
            <img
              src={getLeagueAvatarUrl(row)}
              alt={`${row.name} avatar`}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                // Fallback to default ML avatar if custom avatar fails
                const target = e.target as HTMLImageElement;
                const defaultAvatar = getDefaultMlAvatar(row.id);
                const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
                if (target.src !== fallbackSrc) {
                  target.src = fallbackSrc;
                } else {
                  // If default also fails, show calendar icon
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('svg')) {
                    parent.innerHTML = `
                      <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    `;
                  }
                }
              }}
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 relative">
            {/* Table Button - Positioned at top right */}
            {onTableClick && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTableClick(row.id);
                }}
                className="absolute top-0 right-0 px-3 py-1.5 flex items-center justify-center rounded-full bg-[#1C8376] text-white flex-shrink-0 shadow-sm z-10"
                title="View GW table"
                aria-label="View gameweek table"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {/* List/ranking icon */}
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
              </button>
            )}
            {/* Line 1: League Name */}
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate pr-12">{row.name}</div>

            {/* Line 2: Season Leader - EXPERIMENTAL ONLY - only show if showSeasonLeader prop is true */}
            {showSeasonLeader && data?.seasonLeaderName && (
              <div className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-slate-400 dark:text-slate-500"
                >
                  <g>
                    <path fill="currentColor" d="M16 3c1.1046 0 2 0.89543 2 2h2c1.1046 0 2 0.89543 2 2v1c0 2.695 -2.1323 4.89 -4.8018 4.9941 -0.8777 1.5207 -2.4019 2.6195 -4.1982 2.9209V19h3c0.5523 0 1 0.4477 1 1s-0.4477 1 -1 1H8c-0.55228 0 -1 -0.4477 -1 -1s0.44772 -1 1 -1h3v-3.085c-1.7965 -0.3015 -3.32148 -1.4 -4.19922 -2.9209C4.13175 12.8895 2 10.6947 2 8V7c0 -1.10457 0.89543 -2 2 -2h2c0 -1.10457 0.89543 -2 2 -2zm-8 7c0 2.2091 1.79086 4 4 4 2.2091 0 4 -1.7909 4 -4V5H8zM4 8c0 1.32848 0.86419 2.4532 2.06055 2.8477C6.02137 10.5707 6 10.2878 6 10V7H4zm14 2c0 0.2878 -0.0223 0.5706 -0.0615 0.8477C19.1353 10.4535 20 9.32881 20 8V7h-2z" strokeWidth="1"></path>
                  </g>
                </svg>
                <span className="truncate">{data.seasonLeaderName}</span>
              </div>
            )}

            {/* Line 3: All Submitted Status - only show when showRanking is true */}
            {showRanking && submissions?.allSubmitted && (
              <span className="text-xs font-normal text-[#1C8376] whitespace-nowrap">All Submitted</span>
            )}

            {/* Line 4: Ranking (Member Count and User Position) */}
            {showRanking && (
            <div className="flex items-center gap-2">
              {/* Member Count */}
              <div className="flex items-center gap-1">
                <svg
                  className="w-4 h-4 text-slate-500 dark:text-slate-400"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g clipPath="url(#clip0_4045_135263)">
                    <path
                      d="M14.0001 14V13.7C14.0001 13.0489 14.0001 12.7234 13.925 12.4571C13.7361 11.7874 13.2127 11.264 12.543 11.0751C12.2767 11 11.9512 11 11.3001 11H8.36675C7.71566 11 7.39011 11 7.12387 11.0751C6.45414 11.264 5.93072 11.7874 5.74184 12.4571C5.66675 12.7234 5.66675 13.0489 5.66675 13.7V14"
                      stroke="currentColor"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 11.6667V10.6C2 10.0422 2 9.76328 2.05526 9.53311C2.23083 8.80181 2.80181 8.23083 3.53311 8.05526C3.76328 8 4.04219 8 4.6 8H4.66667"
                      stroke="currentColor"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12.3334 6.33333C12.3334 7.622 11.2887 8.66667 10.0001 8.66667C8.71142 8.66667 7.66675 7.622 7.66675 6.33333C7.66675 5.04467 8.71142 4 10.0001 4C11.2887 4 12.3334 5.04467 12.3334 6.33333Z"
                      stroke="currentColor"
                      strokeWidth="1.33333"
                    />
                    <path
                      d="M7.33325 2.92025C6.94237 2.36557 6.27397 2 5.51507 2C4.31009 2 3.33325 2.92165 3.33325 4.05857C3.33325 4.95488 3.94038 5.7174 4.7878 6"
                      stroke="currentColor"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                    />
                  </g>
                  <defs>
                    <clipPath id="clip0_4045_135263">
                      <rect width="16" height="16" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{members.length}</span>
              </div>

              {/* User Position - ML Ranking */}
              {userPosition !== null && userPosition !== undefined ? (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-[#1C8376]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ordinal(userPosition)}</span>
                  {data?.positionChange === "up" && <span className="text-emerald-600 text-xs">▲</span>}
                  {data?.positionChange === "down" && <span className="text-red-600 text-xs">▼</span>}
                  {data?.positionChange === "same" && <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-[#1C8376]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">—</span>
                </div>
              )}
            </div>
            )}

            {/* Player Chips - ordered by ML table position (1st to last) */}
            {!hidePlayerChips && (
              <div className="flex items-center mt-1 py-0.5">
                {/* #region agent log */}
                {(() => {
                  fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueCard.tsx:369',message:'Rendering chips container',data:{leagueId:row.id,hidePlayerChips,memberChipsLength:memberChips.length,hasMemberChips:memberChips.length>0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                  return null;
                })()}
                {/* #endregion */}
                {memberChips}
                {extraMembers > 0 && (
                  <div
                    className={`chip-container chip-grey rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${
                      extraMembers > 0 ? "chip-overlap" : ""
                    }`}
                    style={{
                      width: "24px",
                      height: "24px",
                    }}
                  >
                    +{extraMembers}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Unread Badge and Arrow - Top Right */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 z-30">
          {badge > 0 && (
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#1C8376] text-white text-xs font-bold">
              {badge}
            </span>
          )}
          <svg className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  // CRITICAL: Must check sortedMemberIds to ensure chips re-render when order changes
  const prevSortedIds = prevProps.data?.sortedMemberIds?.join(',') ?? '';
  const nextSortedIds = nextProps.data?.sortedMemberIds?.join(',') ?? '';
  
  // Compare members arrays deeply
  const prevMembers = prevProps.data?.members ?? [];
  const nextMembers = nextProps.data?.members ?? [];
  const membersEqual = prevMembers.length === nextMembers.length &&
    prevMembers.every((m, i) => nextMembers[i]?.id === m.id && nextMembers[i]?.name === m.name);
  
  // Compare Sets/Arrays for submittedMembers, latestGwWinners, webUserIds
  const prevSubmitted = prevProps.data?.submittedMembers instanceof Set 
    ? Array.from(prevProps.data.submittedMembers).sort().join(',')
    : (prevProps.data?.submittedMembers?.join(',') ?? '');
  const nextSubmitted = nextProps.data?.submittedMembers instanceof Set
    ? Array.from(nextProps.data.submittedMembers).sort().join(',')
    : (nextProps.data?.submittedMembers?.join(',') ?? '');
  
  const prevWinners = prevProps.data?.latestGwWinners instanceof Set
    ? Array.from(prevProps.data.latestGwWinners).sort().join(',')
    : (prevProps.data?.latestGwWinners?.join(',') ?? '');
  const nextWinners = nextProps.data?.latestGwWinners instanceof Set
    ? Array.from(nextProps.data.latestGwWinners).sort().join(',')
    : (nextProps.data?.latestGwWinners?.join(',') ?? '');
  
  const prevWebUsers = prevProps.data?.webUserIds instanceof Set
    ? Array.from(prevProps.data.webUserIds).sort().join(',')
    : (prevProps.data?.webUserIds?.join(',') ?? '');
  const nextWebUsers = nextProps.data?.webUserIds instanceof Set
    ? Array.from(nextProps.data.webUserIds).sort().join(',')
    : (nextProps.data?.webUserIds?.join(',') ?? '');
  
  return (
    prevProps.row.id === nextProps.row.id &&
    prevProps.row.name === nextProps.row.name &&
    prevProps.unread === nextProps.unread &&
    prevProps.leagueDataLoading === nextProps.leagueDataLoading &&
    prevProps.currentGw === nextProps.currentGw &&
    prevProps.showRanking === nextProps.showRanking &&
    prevProps.data?.id === nextProps.data?.id &&
    prevProps.data?.userPosition === nextProps.data?.userPosition &&
    prevProps.data?.positionChange === nextProps.data?.positionChange &&
    prevProps.data?.latestRelevantGw === nextProps.data?.latestRelevantGw &&
    membersEqual &&
    prevSortedIds === nextSortedIds && // CRITICAL: Re-render when sortedMemberIds changes
    prevSubmitted === nextSubmitted &&
    prevWinners === nextWinners &&
    prevWebUsers === nextWebUsers &&
    prevProps.data?.seasonLeaderName === nextProps.data?.seasonLeaderName &&
    prevProps.submissions?.allSubmitted === nextProps.submissions?.allSubmitted &&
    prevProps.submissions?.submittedCount === nextProps.submissions?.submittedCount &&
    prevProps.onTableClick === nextProps.onTableClick
  );
});


