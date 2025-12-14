import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { MiniLeagueCard, type LeagueRow, type LeagueData } from './MiniLeagueCard';
import { HorizontalScrollContainer } from './HorizontalScrollContainer';
import Section from './Section';

interface MiniLeaguesSectionProps {
  leagues: LeagueRow[];
  leagueData: Record<string, any>;
  leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
  unreadByLeague: Record<string, number>;
  leagueDataLoading: boolean;
  currentGw: number | null;
}

export function MiniLeaguesSection({
  leagues,
  leagueData,
  leagueSubmissions,
  unreadByLeague,
  leagueDataLoading,
  currentGw
}: MiniLeaguesSectionProps) {
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

  if (!leagueDataLoading && leagues.length === 0) {
    return (
      <Section 
        title="Mini Leagues" 
        className="mt-6"
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

  if (leagues.length === 0) {
    return (
      <Section 
        title="Mini Leagues" 
        className="mt-6"
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
          <div className="text-slate-600">Loading leagues...</div>
        </div>
      </Section>
    );
  }

  return (
    <Section 
      title="Mini Leagues" 
      className="mt-6"
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
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
      </HorizontalScrollContainer>
    </Section>
  );
}


