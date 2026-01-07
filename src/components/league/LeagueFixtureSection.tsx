import DateHeader from '../DateHeader';
import LeagueFixtureCard, { type Fixture, type PickRow, type LiveScore } from './LeagueFixtureCard';

export interface LeagueFixtureSectionProps {
  label: string;
  fixtures: Fixture[];
  picksByFixture: Map<number, PickRow[]>;
  members: Array<{ id: string; name: string }>;
  outcomes: Map<number, "H" | "D" | "A">;
  liveScores: Record<number, LiveScore>;
  submittedMap: Map<string, boolean>;
  picksGw: number;
  isApiTestLeague?: boolean;
  isFirstSection?: boolean;
  hasLiveGames?: boolean;
  allGamesFinished?: boolean;
  allSubmitted?: boolean;
  resultsPublished?: boolean;
  deadlinePassed?: boolean;
  whoDidntSubmit?: string[];
  liveFixturesCount?: number;
  hasStarted?: boolean;
}

/**
 * LeagueFixtureSection - Displays a date-grouped section of fixtures
 * Used in GW Picks tab
 */
export default function LeagueFixtureSection({
  label,
  fixtures,
  picksByFixture,
  members,
  outcomes,
  liveScores,
  submittedMap,
  picksGw,
  isApiTestLeague = false,
  isFirstSection = false,
  hasLiveGames = false,
  allGamesFinished = false,
  allSubmitted = false,
  resultsPublished = false,
  deadlinePassed = false,
  whoDidntSubmit = [],
  liveFixturesCount,
  hasStarted = false,
}: LeagueFixtureSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <DateHeader date={label} className="text-lg font-normal" />
        {isFirstSection && (
          <>
            {/* API Test league badges */}
            {isApiTestLeague && hasLiveGames && liveFixturesCount !== undefined && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-sm font-bold border border-red-700 shadow-sm" style={{ marginTop: '-2px' }}>
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                <span className="text-xs sm:text-sm font-medium opacity-90">Live</span>
                <span className="flex items-baseline gap-0.5">
                  <span className="text-base sm:text-lg font-extrabold">{liveFixturesCount}</span>
                  <span className="text-xs sm:text-sm font-medium opacity-90">/</span>
                  <span className="text-sm sm:text-base font-semibold opacity-80">{fixtures.length}</span>
                </span>
              </span>
            )}
            {isApiTestLeague && allGamesFinished && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#1C8376]/10 text-[#1C8376]/90 text-sm font-bold border border-emerald-300 shadow-sm" style={{ marginTop: '-2px' }}>
                Round Complete!
              </span>
            )}
            {isApiTestLeague && !hasStarted && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold border border-blue-300 shadow-sm" style={{ marginTop: '-2px' }}>
                All Submitted
              </span>
            )}
            
            {/* Regular league badges */}
            {!isApiTestLeague && (() => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LeagueFixtureSection.tsx:79',message:'Checking Round Complete conditions',data:{isApiTestLeague,allSubmitted,resultsPublished,allGamesFinished,shouldShow:allSubmitted && resultsPublished && allGamesFinished},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
              // #endregion
              return allSubmitted && resultsPublished && allGamesFinished;
            })() && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#1C8376]/10 text-[#1C8376]/90 text-sm font-bold border border-emerald-300 shadow-sm" style={{ marginTop: '-2px' }}>
                Round Complete!
              </span>
            )}
            {!isApiTestLeague && allSubmitted && !resultsPublished && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold border border-blue-300 shadow-sm" style={{ marginTop: '-2px' }}>
                All Submitted
              </span>
            )}
            {!isApiTestLeague && deadlinePassed && !allSubmitted && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-sm font-bold border border-orange-300 shadow-sm" style={{ marginTop: '-2px' }}>
                Deadline Passed {whoDidntSubmit.length > 0 && `(${whoDidntSubmit.join(', ')} didn't submit)`}
              </span>
            )}
          </>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden">
        <ul>
          {fixtures.map((f) => {
            try {
              const picks = picksByFixture.get(f.fixture_index) ?? [];
              const outcome = outcomes.get(f.fixture_index) || null;
              const liveScore = liveScores[f.fixture_index] || null;
              
              return (
                <LeagueFixtureCard
                  key={`${f.gw}-${f.fixture_index}`}
                  fixture={f}
                  picks={picks}
                  members={members}
                  outcome={outcome}
                  liveScore={liveScore}
                  submittedMap={submittedMap}
                  picksGw={picksGw}
                  isApiTestLeague={isApiTestLeague}
                />
              );
            } catch (error) {
              console.error("Error rendering fixture:", error, f);
              return (
                <li key={`${f.gw}-${f.fixture_index}`} className="p-4 text-red-500">
                  Error loading fixture: {f.fixture_index}
                </li>
              );
            }
          })}
          {!fixtures.length && (
            <li className="p-4 text-slate-500 dark:text-slate-400">
              No fixtures.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

