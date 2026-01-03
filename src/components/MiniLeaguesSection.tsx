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
}: MiniLeaguesSectionProps) {
  // Determine if we should show toggle buttons (LIVE or RESULTS_PRE_GW states)
  const isLive = gameState === 'LIVE';
  const isResultsPreGw = gameState === 'RESULTS_PRE_GW';
  const showToggleButtons = isLive || isResultsPreGw;
  
  // State for toggle between cards and live tables
  // Default to live tables during LIVE or RESULTS_PRE_GW states
  const [showLiveTables, setShowLiveTables] = useState(showToggleButtons);
  
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
  
  // Update showLiveTables when game state changes to LIVE or RESULTS_PRE_GW
  useEffect(() => {
    if (showToggleButtons) {
      setShowLiveTables(true);
    }
  }, [showToggleButtons]);
  
  // Memoize card data transformations to prevent unnecessary re-renders
  const memoizedCardData = useMemo(() => {
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
        webUserIds: data.webUserIds
      } : undefined;
    }
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

  // Toggle component for mobile header - alternates between buttons
  // Show in both LIVE and RESULTS_PRE_GW states (until user moves to next GW)
  const toggleComponent = showToggleButtons ? (
    <div className="lg:hidden flex items-center gap-2">
      {showLiveTables ? (
        <button
          onClick={() => setShowLiveTables(false)}
          className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200"
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

  if (leagues.length === 0) {
    return (
      <Section 
        title="Mini Leagues" 
        className="mt-8"
        headerRight={toggleComponent}
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
          <Link 
            to="/create-league" 
            className="inline-block px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-lg hover:bg-[#1C8376]/80 transition-colors no-underline"
          >
            Create one now!
          </Link>
        </div>
      </Section>
    );
  }

  return (
    <Section 
      title="Mini Leagues" 
      subtitle={showLiveTables && currentGw ? `Gameweek ${currentGw} Live Tables` : undefined}
      className="mt-8"
      headerRight={toggleComponent}
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
      {showLiveTables ? (
        // Live Tables View - Horizontal scroll of table cards
        <div className="lg:hidden">
          <HorizontalScrollContainer>
            {leagues.map((league) => {
              const cardData = memoizedCardData[league.id];
              const members = cardData?.members || [];
              
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
        // Normal Overview View - Existing card layout
        <>
      {/* Mobile: Horizontal scroll with batches */}
      <div className="lg:hidden">
        <HorizontalScrollContainer>
          {Array.from({ length: Math.ceil(leagues.length / 3) }).map((_, batchIdx) => {
            const startIdx = batchIdx * 3;
            const batchLeagues = leagues.slice(startIdx, startIdx + 3);
            
            return (
              <div key={batchIdx} className="flex flex-col rounded-xl border bg-white overflow-hidden shadow-sm w-[320px]">
                {batchLeagues.map((l, index) => {
                  const unread = unreadByLeague?.[l.id] ?? 0;
                  const cardData = memoizedCardData[l.id];
                  
                  return (
                    <div key={l.id} className={index < batchLeagues.length - 1 ? 'relative' : ''}>
                      {index < batchLeagues.length - 1 && (
                        <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200 z-30 pointer-events-none" />
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

      {/* Desktop: Single column with individual cards */}
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
            />
          );
        })}
      </div>
      </>
      )}
    </Section>
  );
}


