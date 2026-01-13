import { Link } from 'react-router-dom';
import { useMemo, useState, useEffect, useRef } from 'react';
import { MiniLeagueCard, type LeagueRow, type LeagueData } from './MiniLeagueCard';
import { HorizontalScrollContainer } from './HorizontalScrollContainer';
import Section from './Section';
import MiniLeagueGwTableCard from './MiniLeagueGwTableCard';
import type { GameweekState } from '../lib/gameweekState';

interface MiniLeaguesSectionProps {
  leagues: LeagueRow[];
  leagueData: Record<string, any>;
  leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
  unreadByLeague: Record<string, number>;
  leagueDataLoading: boolean;
  currentGw: number | null;
  onTableClick?: (leagueId: string) => void;
  currentUserId?: string;
  gameState?: GameweekState | null;
  hideLiveTables?: boolean; // If true, always show default card view, never show live tables
  hidePlayerChips?: boolean; // If true, hide player chips on mini league cards
  showSeasonLeader?: boolean; // If true, show season leader name with trophy (default: false)
  onCreateJoinClick?: () => void; // Callback for "Create or Join" button in empty state
}

export function MiniLeaguesSection({
  leagues,
  leagueData,
  leagueSubmissions,
  unreadByLeague,
  leagueDataLoading,
  currentGw,
  onTableClick,
  currentUserId,
  gameState,
  hideLiveTables = false,
  hidePlayerChips = false,
  showSeasonLeader = false,
  onCreateJoinClick,
}: MiniLeaguesSectionProps) {
  // Determine if we should show toggle buttons (LIVE or RESULTS_PRE_GW states)
  const isLive = gameState === 'LIVE';
  const isResultsPreGw = gameState === 'RESULTS_PRE_GW';
  const showToggleButtons = (isLive || isResultsPreGw) && !hideLiveTables;
  
  // State for toggle between cards and live tables
  // Default to live tables during LIVE or RESULTS_PRE_GW states (unless hideLiveTables is true)
  const [showLiveTables, setShowLiveTables] = useState(showToggleButtons && !hideLiveTables);
  
  // Track previous gameweek to detect when user moves to next GW
  const prevGwRef = useRef<number | null>(currentGw);
  
  // Reset to overview only when user moves to next gameweek (not just when state changes)
  useEffect(() => {
    // If gameweek changed, reset live tables view
    if (prevGwRef.current !== null && currentGw !== null && prevGwRef.current !== currentGw) {
      setShowLiveTables(false);
    }
    // Update ref to current GW
    prevGwRef.current = currentGw;
  }, [currentGw]);
  
  // Update showLiveTables when game state changes to LIVE or RESULTS_PRE_GW (unless hideLiveTables is true)
  useEffect(() => {
    if (showToggleButtons && !hideLiveTables) {
      setShowLiveTables(true);
    }
  }, [showToggleButtons, hideLiveTables]);
  
  // Memoize card data transformations to prevent unnecessary re-renders
  // Use ref to track previous values and only create new objects when content actually changes
  const prevCardDataRef = useRef<Record<string, LeagueData | undefined>>({});
  const prevLeagueDataKeysRef = useRef<string>('');
  const memoizedCardData = useMemo(() => {
    const currentKeys = Object.keys(leagueData).sort().join(',');
    
    // Quick check: if keys haven't changed and we have previous data, check if content changed
    if (currentKeys === prevLeagueDataKeysRef.current && Object.keys(prevCardDataRef.current).length > 0) {
      let hasChanges = false;
      for (const leagueId in leagueData) {
        const data = leagueData[leagueId];
        const prevData = prevCardDataRef.current[leagueId];
        
        if (!prevData || !data) {
          hasChanges = true;
          break;
        }
        
        // Deep comparison of key properties
        if (
          data.id !== prevData.id ||
          data.userPosition !== prevData.userPosition ||
          data.positionChange !== prevData.positionChange ||
          data.latestRelevantGw !== prevData.latestRelevantGw ||
          data.seasonLeaderName !== prevData.seasonLeaderName ||
          data.members?.length !== prevData.members?.length ||
          (data.sortedMemberIds?.join(',') ?? '') !== (prevData.sortedMemberIds?.join(',') ?? '') ||
          (data.submittedMembers instanceof Set ? Array.from(data.submittedMembers).sort().join(',') : (data.submittedMembers?.join(',') ?? '')) !==
          (prevData.submittedMembers instanceof Set ? Array.from(prevData.submittedMembers).sort().join(',') : (prevData.submittedMembers?.join(',') ?? '')) ||
          (data.latestGwWinners instanceof Set ? Array.from(data.latestGwWinners).sort().join(',') : (data.latestGwWinners?.join(',') ?? '')) !==
          (prevData.latestGwWinners instanceof Set ? Array.from(prevData.latestGwWinners).sort().join(',') : (prevData.latestGwWinners?.join(',') ?? '')) ||
          (data.webUserIds instanceof Set ? Array.from(data.webUserIds).sort().join(',') : (data.webUserIds?.join(',') ?? '')) !==
          (prevData.webUserIds instanceof Set ? Array.from(prevData.webUserIds).sort().join(',') : (prevData.webUserIds?.join(',') ?? ''))
        ) {
          hasChanges = true;
          break;
        }
        
        // Check if members array changed
        if (data.members && prevData.members) {
          if (data.members.length !== prevData.members.length ||
              data.members.some((m: any, i: number) => !prevData.members[i] || m.id !== prevData.members[i].id || m.name !== prevData.members[i].name)) {
            hasChanges = true;
            break;
          }
        }
      }
      
      if (!hasChanges) {
        return prevCardDataRef.current;
      }
    }
    
    // Content changed, create new objects
    const result: Record<string, LeagueData | undefined> = {};
    for (const leagueId in leagueData) {
      const data = leagueData[leagueId];
      result[leagueId] = data ? {
        id: data.id,
        members: data.members,
        userPosition: data.userPosition,
        positionChange: data.positionChange,
        submittedMembers: data.submittedMembers,
        sortedMemberIds: data.sortedMemberIds,
        latestGwWinners: data.latestGwWinners,
        latestRelevantGw: data.latestRelevantGw,
        webUserIds: data.webUserIds,
        seasonLeaderName: data.seasonLeaderName
      } : undefined;
    }
    
    prevCardDataRef.current = result;
    prevLeagueDataKeysRef.current = currentKeys;
    return result;
  }, [leagueData]);

  // Calculate max member count across all leagues for consistent card heights
  const maxMemberCount = useMemo(() => {
    if (!leagueData || Object.keys(leagueData).length === 0) return 0;
    return Math.max(
      ...Object.values(leagueData)
        .filter(data => data?.members)
        .map(data => data.members.length),
      0
    );
  }, [leagueData]);

  // Toggle component for mobile header
  // Show toggle buttons on main Home page, but not on HomeExperimental (when hideLiveTables is true)
  const toggleComponent = showToggleButtons && !hideLiveTables ? (
    <div className="lg:hidden flex items-center gap-2">
      {showLiveTables ? (
        <button
          onClick={() => setShowLiveTables(false)}
          className="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          Default View
        </button>
      ) : (
        <button
          onClick={() => setShowLiveTables(true)}
          className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors bg-[#1C8376] text-white"
        >
          View Live Tables
        </button>
      )}
    </div>
  ) : null;
  
  // Live indicator for header (like GamesSection) - ONLY for HomeExperimental when showing live tables
  // Main Home page should NOT have this - it should have live indicators on individual cards instead
  // Only show when actually displaying live tables, not in default view
  const liveIndicator = hideLiveTables && showLiveTables && (gameState === 'LIVE' || gameState === 'RESULTS_PRE_GW') ? (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs sm:text-sm font-medium">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
      <span>Live</span>
    </div>
  ) : null;

  if (leagues.length === 0) {
    return (
      <Section 
        title="Mini Leagues" 
        className="mt-8"
        headerRight={hideLiveTables ? liveIndicator : toggleComponent}
        infoTitle="Mini Leagues"
        infoDescription={`A Mini League is a head-to-head competition for up to 8 players.

You compete each Gameweek and across the full season — with one overall winner at the end of the season.

(TB) Predictions submitted

(TB) Predictions not submitted yet

(TB) Gameweek winner!

Chips are ordered by the current league table.

Start a Mini League →

How To Play →`}
      >
        <div className="p-6 bg-white rounded-lg border border-slate-200 text-center">
          <div className="text-slate-600 mb-3">You don't have any mini leagues yet.</div>
          {onCreateJoinClick ? (
            <button
              onClick={onCreateJoinClick}
              className="w-full px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-lg no-underline border-0 cursor-pointer"
            >
              Create or Join
            </button>
          ) : (
            <Link 
              to="/create-league" 
              className="inline-block px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-lg no-underline"
            >
              Create one now!
            </Link>
          )}
        </div>
      </Section>
    );
  }

  return (
    <Section 
      title="Mini Leagues" 
      subtitle={showLiveTables && currentGw ? `Gameweek ${currentGw} Live Tables` : undefined}
      className="mt-8"
      headerRight={hideLiveTables ? liveIndicator : toggleComponent}
      infoTitle="Mini Leagues"
      infoDescription={`A Mini League is a head-to-head competition for up to 8 players.

You compete each Gameweek and across the full season — with one overall winner at the end of the season.

(TB) Predictions submitted

(TB) Predictions not submitted yet

(TB) Gameweek winner!

Chips are ordered by the current league table.

Start a Mini League →

How To Play →`}
    >
      {/* Desktop: Always show default view - never switches to live tables */}
      <div className="hidden lg:flex lg:flex-col lg:gap-4">
        {leagues.map((l) => {
          const unread = unreadByLeague?.[l.id] ?? 0;
          const cardData = memoizedCardData[l.id];
          return (
            <MiniLeagueCard
              key={l.id}
              row={l as LeagueRow}
              data={cardData}
              unread={unread}
              submissions={leagueSubmissions[l.id]}
              leagueDataLoading={leagueDataLoading}
              currentGw={currentGw}
              onTableClick={onTableClick}
              hidePlayerChips={hidePlayerChips}
              showSeasonLeader={showSeasonLeader}
            />
          );
        })}
      </div>

      {/* Mobile: Conditionally show live tables or default view */}
      {showLiveTables ? (
        // Live Tables View - Horizontal scroll of table cards
        <div className="lg:hidden">
          <HorizontalScrollContainer>
            {leagues.map((league) => {
              const cardData = memoizedCardData[league.id];
              const members = cardData?.members || [];
              // CRITICAL FIX: Always render the card - let it handle its own loading state
              // This prevents tables from disappearing when data is temporarily empty or loading
              // The card will show a loading spinner if members are empty or data is loading
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeaguesSection.tsx:285',message:'Rendering MiniLeagueGwTableCard',data:{leagueId:league.id,leagueName:league.name,hasCardData:!!cardData,membersLength:members.length,showLiveTables,currentGw,leagueDataKeys:Object.keys(leagueData).length,memoizedKeys:Object.keys(memoizedCardData).length,leagueDataLoading,willRender:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              return (
                <MiniLeagueGwTableCard
                  key={league.id}
                  leagueId={league.id}
                  leagueCode={league.code}
                  leagueName={league.name}
                  members={members}
                  currentUserId={currentUserId}
                  currentGw={currentGw}
                  maxMemberCount={maxMemberCount}
                  avatar={league.avatar}
                  unread={unreadByLeague[league.id] ?? 0}
                />
              );
            })}
          </HorizontalScrollContainer>
        </div>
      ) : (
        // Mobile: Default Overview View - Horizontal scroll with batches
        <div className="lg:hidden">
          <HorizontalScrollContainer>
            {Array.from({ length: Math.ceil(leagues.length / 3) }).map((_, batchIdx) => {
              const startIdx = batchIdx * 3;
              const batchLeagues = leagues.slice(startIdx, startIdx + 3);
              
              return (
                <div key={batchIdx} className="flex flex-col rounded-xl bg-white dark:bg-slate-800 overflow-hidden shadow-sm w-[320px]">
                  {batchLeagues.map((l, index) => {
                    const unread = unreadByLeague?.[l.id] ?? 0;
                    const cardData = memoizedCardData[l.id];
                    
                    return (
                      <div key={l.id} className={index < batchLeagues.length - 1 ? 'relative' : ''}>
                        {index < batchLeagues.length - 1 && (
                          <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200 dark:bg-slate-700 z-30 pointer-events-none" />
                        )}
                        <div className="[&>div]:border-0 [&>div]:shadow-none [&>div]:rounded-none [&>div]:bg-transparent relative z-20 [&>div>a]:!p-4">
                              <MiniLeagueCard
                                row={l as LeagueRow}
                                data={cardData}
                                unread={unread}
                                submissions={leagueSubmissions[l.id]}
                                leagueDataLoading={leagueDataLoading}
                                currentGw={currentGw}
                                showRanking={false}
                                onTableClick={onTableClick}
                                hidePlayerChips={hidePlayerChips}
                                showSeasonLeader={showSeasonLeader}
                              />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </HorizontalScrollContainer>
        </div>
      )}
    </Section>
  );
}


