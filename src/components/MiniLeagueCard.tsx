import { useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { getLeagueAvatarUrl, getDefaultMlAvatar } from '../lib/leagueAvatars';
import { ordinal, initials, toStringSet } from '../lib/helpers';

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
};

export type MiniLeagueCardProps = {
  row: LeagueRow;
  data?: LeagueData;
  unread: number;
  submissions?: { allSubmitted: boolean; submittedCount: number; totalCount: number };
  leagueDataLoading: boolean;
  currentGw: number | null;
  showRanking?: boolean; // If false, hide member count and user position (default: true)
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
}: MiniLeagueCardProps) {
  const members = data?.members ?? [];
  const userPosition = data?.userPosition;
  const badge = unread > 0 ? Math.min(unread, 99) : 0;
  
  // Debug logging
  console.log('[MiniLeagueCard] Rendering:', {
    leagueName: row.name,
    showRanking,
    hasData: !!data,
    membersCount: members.length,
    userPosition,
  });

  const memberChips = useMemo(() => {
    if (leagueDataLoading || !data) return [];
    const baseMembers = data.members ?? [];
    if (!baseMembers.length) return [];

    const orderedMembers =
      data.sortedMemberIds && data.sortedMemberIds.length > 0
        ? data.sortedMemberIds
            .map((id) => baseMembers.find((m) => m.id === id))
            .filter((m): m is LeagueMember => m !== undefined)
        : [...baseMembers].sort((a, b) => a.name.localeCompare(b.name));

    const submittedSet = toStringSet(data.submittedMembers);
    const winnersSet = toStringSet(data.latestGwWinners);

    // Check if this is API Test league
    const isApiTestLeague = row.name === "API Test";
    
    return orderedMembers.slice(0, 8).map((member, index) => {
      const hasSubmitted = submittedSet.has(member.id);
      const isLatestWinner = winnersSet.has(member.id);

      // GPU-optimized: Use CSS classes instead of inline styles
      let chipClassName = 'chip-container rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 w-6 h-6';
      
      // Only show shiny chip if latestRelevantGw matches currentGw (same GW)
      // If currentGw > latestRelevantGw, a new GW has been published - hide shiny chips
      const shouldShowShiny = isLatestWinner && data.latestRelevantGw !== null && currentGw !== null && data.latestRelevantGw === currentGw;
      
      if (shouldShowShiny) {
        // Shiny chip for last GW winner (already GPU-optimized with transforms)
        chipClassName += ' bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 font-semibold relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]';
      } else if (hasSubmitted) {
        // Green = picked (GPU-optimized class)
        chipClassName += ' chip-green';
        // Add bold blue border for Test API submissions
        if (isApiTestLeague) {
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

      return (
        <div key={member.id} className={chipClassName} title={member.name}>
          {initials(member.name)}
        </div>
      );
    });
  }, [data, leagueDataLoading, row.name, currentGw]);

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
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm w-full">
      <Link
        to={`/league/${row.code}`}
        className="block p-6 !bg-white no-underline hover:text-inherit relative z-20"
      >
        <div className="flex items-start gap-3 relative">
          {/* League Avatar Badge */}
          <div className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center overflow-hidden bg-slate-100">
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

          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {/* Line 1: League Name */}
            <div className="text-base font-semibold text-slate-900 truncate">{row.name}</div>

            {/* Line 2: All Submitted Status - only show when showRanking is true */}
            {showRanking && submissions?.allSubmitted && (
              <span className="text-xs font-normal text-[#1C8376] whitespace-nowrap">All Submitted</span>
            )}

            {/* Line 3: Ranking (Member Count and User Position) */}
            {showRanking && (
            <div className="flex items-center gap-2">
              {/* Member Count */}
              <div className="flex items-center gap-1">
                <svg
                  className="w-4 h-4 text-slate-500"
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
                <span className="text-sm font-semibold text-slate-900">{members.length}</span>
              </div>

              {/* User Position - ML Ranking */}
              {userPosition !== null && userPosition !== undefined ? (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-[#1C8376]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-900">{ordinal(userPosition)}</span>
                  {data?.positionChange === "up" && <span className="text-green-600 text-xs">▲</span>}
                  {data?.positionChange === "down" && <span className="text-red-600 text-xs">▼</span>}
                  {data?.positionChange === "same" && <span className="text-slate-400 text-xs">—</span>}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-[#1C8376]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-400">—</span>
                </div>
              )}
            </div>
            )}

            {/* Player Chips - ordered by ML table position (1st to last) */}
            <div className="flex items-center mt-1 py-0.5">
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
          </div>
        </div>

        {/* Unread Badge and Arrow - Top Right */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 z-30">
          {badge > 0 && (
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#1C8376] text-white text-xs font-bold">
              {badge}
            </span>
          )}
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    </div>
  );
});


