import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useGameweekState } from '../hooks/useGameweekState';
import { useLiveScores } from '../hooks/useLiveScores';
import { getLeagueAvatarUrl, getDefaultMlAvatar } from '../lib/leagueAvatars';
import type { Fixture } from './FixtureCard';

export interface MiniLeagueGwTableCardProps {
  leagueId: string;
  leagueCode: string;
  leagueName: string;
  members: Array<{ id: string; name: string }>;
  currentUserId?: string;
  currentGw: number | null;
  maxMemberCount?: number; // Max members across all leagues for consistent height
  avatar?: string | null; // League avatar
  // Optional mock data for Storybook/testing
  mockData?: {
    fixtures: Fixture[];
    picks: PickRow[];
    results: Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>;
    displayGw: number;
    isLive?: boolean;
  };
}

type ResultRow = {
  user_id: string;
  name: string;
  score: number;
  unicorns: number;
};

type PickRow = {
  user_id: string;
  gw: number;
  fixture_index: number;
  pick: "H" | "D" | "A";
};

function rowToOutcome(r: { result?: "H" | "D" | "A" | null }): "H" | "D" | "A" | null {
  return r.result === "H" || r.result === "D" || r.result === "A" ? r.result : null;
}

/**
 * Calculate minimum height needed for a card based on member count
 * Header: ~60px, Table header: ~32px, Each row: ~32px, Padding: ~24px
 */
function calculateCardHeight(maxMembers: number): number {
  const headerHeight = 60;
  const tableHeaderHeight = 32;
  const rowHeight = 32;
  const padding = 24;
  
  return headerHeight + tableHeaderHeight + (maxMembers * rowHeight) + padding;
}

/**
 * MiniLeagueGwTableCard - Compact card version of the GW table for horizontal scrolling
 * Shows league name, GW number, and results table in a fixed-width card (320px)
 * Clickable to navigate to the league page
 */
export default function MiniLeagueGwTableCard({
  leagueId,
  leagueCode,
  leagueName,
  members,
  currentUserId,
  currentGw,
  maxMemberCount: _maxMemberCount,
  avatar,
  mockData,
}: MiniLeagueGwTableCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayGw, setDisplayGw] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [results, setResults] = useState<Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>>([]);
  const [submittedUserIds, setSubmittedUserIds] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<ResultRow[]>([]);

  // Determine which GW to display based on game state
  const { state: currentGwState } = useGameweekState(currentGw);
  
  // Get live scores for the display GW
  const { liveScores: liveScoresMap } = useLiveScores(displayGw ?? undefined, undefined);

  // Convert liveScoresMap to a Record keyed by fixture_index
  const liveScores = useMemo(() => {
    const result: Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }> = {};
    if (!fixtures || fixtures.length === 0) return result;
    fixtures.forEach(fixture => {
      const apiMatchId = fixture.api_match_id;
      if (apiMatchId) {
        const liveScore = liveScoresMap.get(apiMatchId);
        if (liveScore) {
          result[fixture.fixture_index] = {
            homeScore: liveScore.home_score ?? 0,
            awayScore: liveScore.away_score ?? 0,
            status: liveScore.status || 'SCHEDULED',
            minute: liveScore.minute ?? null
          };
        }
      }
    });
    return result;
  }, [liveScoresMap, fixtures]);

  // Determine display GW: current if LIVE/RESULTS_PRE_GW, last completed if GW_OPEN/GW_PREDICTED
  useEffect(() => {
    if (mockData) {
      setDisplayGw(mockData.displayGw);
      setFixtures(mockData.fixtures);
      setPicks(mockData.picks);
      setResults(mockData.results);
      setLoading(false);
      return;
    }

    if (!currentGw) {
      setDisplayGw(null);
      return;
    }

    let alive = true;

    async function determineDisplayGw() {
      if (currentGwState === 'LIVE' || currentGwState === 'RESULTS_PRE_GW') {
        setDisplayGw(currentGw);
        return;
      }

      // For GW_OPEN or GW_PREDICTED, find last completed GW
      const { data: resultsData } = await supabase
        .from('app_gw_results')
        .select('gw')
        .order('gw', { ascending: false })
        .limit(1);

      if (!alive) return;

      const lastCompletedGw = resultsData && resultsData.length > 0 
        ? (resultsData[0] as any).gw 
        : null;

      setDisplayGw(lastCompletedGw || currentGw);
    }

    determineDisplayGw();

    return () => {
      alive = false;
    };
  }, [currentGw, currentGwState, mockData]);

  // Fetch data when displayGw is determined
  useEffect(() => {
    if (mockData) {
      return;
    }

    if (!displayGw || !leagueId) {
      setLoading(false);
      return;
    }

    let alive = true;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const { data: fixturesData, error: fixturesError } = await supabase
          .from('app_fixtures')
          .select('id, gw, fixture_index, home_name, away_name, home_team, away_team, home_code, away_code, kickoff_time, api_match_id')
          .eq('gw', displayGw)
          .order('fixture_index', { ascending: true });

        if (fixturesError) throw fixturesError;
        if (!alive) return;

        setFixtures((fixturesData as Fixture[]) ?? []);

        const memberIds = members.map(m => m.id);
        const { data: picksData, error: picksError } = await supabase
          .from('app_picks')
          .select('user_id, gw, fixture_index, pick')
          .eq('gw', displayGw)
          .in('user_id', memberIds);

        if (picksError) throw picksError;
        if (!alive) return;

        setPicks((picksData ?? []) as PickRow[]);

        // Fetch submissions to filter out members who didn't submit
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('app_gw_submissions')
          .select('user_id')
          .eq('gw', displayGw)
          .in('user_id', memberIds)
          .not('submitted_at', 'is', null);

        if (submissionsError) {
          console.error('[MiniLeagueGwTableCard] Error fetching submissions:', submissionsError);
        }
        if (!alive) return;

        // Create Set of user IDs who submitted
        const submitted = new Set<string>();
        if (submissionsData) {
          submissionsData.forEach((s: any) => {
            submitted.add(s.user_id);
          });
        }
        
        // Debug logging for "Prem Predictions" league
        if (leagueName?.toLowerCase().includes('prem')) {
          console.log('[MiniLeagueGwTableCard] Prem Predictions debug:', {
            leagueName,
            displayGw,
            totalMembers: members.length,
            memberIds: memberIds,
            memberNames: members.map(m => m.name),
            submissionsCount: submissionsData?.length || 0,
            submittedUserIds: Array.from(submitted),
            submittedNames: members.filter(m => submitted.has(m.id)).map(m => m.name),
            notSubmittedNames: members.filter(m => !submitted.has(m.id)).map(m => m.name),
          });
        }
        
        setSubmittedUserIds(submitted);

        const { data: resultsData, error: resultsError } = await supabase
          .from('app_gw_results')
          .select('gw, fixture_index, result')
          .eq('gw', displayGw);

        if (resultsError) throw resultsError;
        if (!alive) return;

        setResults((resultsData ?? []) as Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>);

        setLoading(false);
      } catch (err: any) {
        console.error('[MiniLeagueGwTableCard] Error fetching data:', err);
        if (alive) {
          setError(err?.message || 'Failed to load data');
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      alive = false;
    };
  }, [displayGw, leagueId, members, mockData]);

  // Calculate rows from picks and results/live scores
  useEffect(() => {
    if (!displayGw || fixtures.length === 0) {
      setRows([]);
      return;
    }

    const outcomes = new Map<number, "H" | "D" | "A">();
    const fixturesForGw = fixtures.filter(f => f.gw === displayGw);

    const hasLiveScores = fixturesForGw.some((f) => {
      const liveScore = liveScores[f.fixture_index];
      return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
    });

    if (hasLiveScores && displayGw === currentGw) {
      fixturesForGw.forEach((f) => {
        const liveScore = liveScores[f.fixture_index];
        if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
          if (liveScore.homeScore > liveScore.awayScore) {
            outcomes.set(f.fixture_index, 'H');
          } else if (liveScore.awayScore > liveScore.homeScore) {
            outcomes.set(f.fixture_index, 'A');
          } else {
            outcomes.set(f.fixture_index, 'D');
          }
        }
      });
    } else {
      results.forEach((r) => {
        if (r.gw !== displayGw) return;
        const out = rowToOutcome(r);
        if (out) outcomes.set(r.fixture_index, out);
      });
    }

    // CRITICAL: Only include members who have submitted for this GW
    // Filter out members who didn't submit (like Steve in the user's example)
    const calculatedRows: ResultRow[] = members
      .filter((m) => submittedUserIds.has(m.id))
      .map((m) => ({
        user_id: m.id,
        name: m.name,
        score: 0,
        unicorns: 0,
      }));

    const picksByFixture = new Map<number, Array<{ user_id: string; pick: "H" | "D" | "A" }>>();
    picks.forEach((p) => {
      if (p.gw !== displayGw) return;
      // Also filter picks to only include from users who submitted
      if (!submittedUserIds.has(p.user_id)) return;
      const arr = picksByFixture.get(p.fixture_index) ?? [];
      arr.push({ user_id: p.user_id, pick: p.pick });
      picksByFixture.set(p.fixture_index, arr);
    });

    Array.from(outcomes.entries()).forEach(([idx, out]) => {
      const these = picksByFixture.get(idx) ?? [];
      const correctIds = these.filter((p) => p.pick === out).map((p) => p.user_id);

      correctIds.forEach((uid) => {
        const r = calculatedRows.find((x) => x.user_id === uid);
        if (r) r.score += 1;
      });

      // Unicorns: only one person got it right AND at least 3 members submitted
      if (correctIds.length === 1 && submittedUserIds.size >= 3) {
        const r = calculatedRows.find((x) => x.user_id === correctIds[0]);
        if (r) r.unicorns += 1;
      }
    });

    calculatedRows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name));
    setRows(calculatedRows);
  }, [displayGw, fixtures, picks, results, members, liveScores, currentGw, submittedUserIds]);

  // Force isLive to true for testing - remove this later
  const isLive = true; // mockData?.isLive ?? (hasLiveFixtures && displayGw === currentGw);
  
  // Calculate fixed height based on actual submitted members for this league
  // CRITICAL: Use actual rows.length (submitted members) to ensure all rows are visible
  // Don't use maxMemberCount as it might be from a different league and could make this card too small
  const memberCountForHeight = rows.length > 0 
    ? rows.length // Use actual submitted count for this league
    : (members.length); // Fallback to total members if rows not calculated yet
  const cardHeight = calculateCardHeight(memberCountForHeight);
  
  // maxMemberCount is passed but not used - we use actual rows.length instead for accurate height

  const cardContent = (
    <>
      <style>{`
        @keyframes flash {
          0%, 100% {
            background-color: rgb(209, 250, 229);
          }
          25% {
            background-color: rgb(167, 243, 208);
          }
          50% {
            background-color: rgb(209, 250, 229);
          }
          75% {
            background-color: rgb(167, 243, 208);
          }
        }
        @keyframes pulse-score {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
        .flash-user-row {
          animation: flash 1.5s ease-in-out 3;
        }
        .pulse-live-score {
          animation: pulse-score 2s ease-in-out infinite;
        }
      `}</style>
      {/* Compact Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#1C8376] to-[#1C8376]/90 border-b border-[#1C8376]/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <img
              src={getLeagueAvatarUrl({ id: leagueId, avatar })}
              alt={`${leagueName} avatar`}
              className="w-10 h-10 rounded-full flex-shrink-0 object-cover border-2 border-white/30 shadow-sm"
              onError={(e) => {
                // Fallback to default ML avatar if custom avatar fails
                const target = e.target as HTMLImageElement;
                const defaultAvatar = getDefaultMlAvatar(leagueId);
                const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
                if (target.src !== fallbackSrc) {
                  target.src = fallbackSrc;
                }
              }}
            />
            <h3 className="text-sm font-bold text-white truncate drop-shadow-sm">
              {leagueName}
            </h3>
            {isLive && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white shadow-sm flex-shrink-0">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                <span className="text-[10px] font-semibold">LIVE</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-2 pb-4 flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8 flex-1">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1C8376]"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 flex-1">
            <div className="text-xs text-red-500">{error}</div>
          </div>
        ) : !displayGw ? (
          <div className="text-center py-8 flex-1">
            <div className="text-xs text-slate-500">No gameweek available</div>
          </div>
        ) : (
          <>
            {/* Table */}
            {rows.length > 0 ? (
              <div className="overflow-visible flex-1 -mx-4">
                <div className="overflow-visible bg-white">
                  <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', backgroundColor: '#ffffff', width: '100%' }}>
                    <thead className="sticky top-0" style={{ 
                      position: 'sticky', 
                      top: 0, 
                      zIndex: 25, 
                      backgroundColor: '#ffffff', 
                      display: 'table-header-group'
                    } as any}>
                      <tr style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                        <th className="py-2 text-left font-semibold text-xs uppercase tracking-wide" style={{ backgroundColor: '#ffffff', width: '24px', paddingLeft: '0.5rem', paddingRight: '0.25rem', color: '#1C8376' }}>#</th>
                        <th className="py-2 text-left font-semibold text-xs uppercase tracking-wide" style={{ backgroundColor: '#ffffff', color: '#1C8376', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                          Player
                        </th>
                        <th className="py-2 text-center font-semibold uppercase tracking-wide" style={{ backgroundColor: '#ffffff', width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#1C8376', fontSize: '0.5rem' }}>
                          Score
                        </th>
                        {members.length >= 3 && <th className="py-2 text-center font-semibold text-xs" style={{ backgroundColor: '#ffffff', width: '32px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#1C8376', fontSize: '1rem' }}>🦄</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const isMe = r.user_id === currentUserId;
                        return (
                          <tr 
                            key={r.user_id} 
                            className={isMe ? 'flash-user-row' : ''}
                            style={{
                              position: 'relative',
                              backgroundColor: '#ffffff',
                              ...(i < rows.length - 1 ? { borderBottom: '1px solid #e2e8f0' } : {})
                            }}
                          >
                            <td className="py-2 text-left tabular-nums whitespace-nowrap" style={{ 
                              paddingLeft: '0.5rem', 
                              paddingRight: '0.25rem',
                              backgroundColor: '#ffffff',
                              width: '24px',
                              fontSize: '0.75rem'
                            }}>
                              {i + 1}
                            </td>
                            <td className="py-2 truncate whitespace-nowrap" style={{ backgroundColor: '#ffffff', paddingLeft: '0.5rem', paddingRight: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem' }}>
                              <div className="flex items-center gap-2">
                                {isLive && (
                                  <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse flex-shrink-0" style={{ minWidth: '8px', minHeight: '8px' }}></div>
                                )}
                                <span>{r.name}</span>
                              </div>
                            </td>
                            <td className={`py-2 text-center tabular-nums font-bold ${isLive ? 'pulse-live-score' : ''}`} style={{ width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#ffffff', color: '#1C8376', fontSize: '0.75rem' }}>{r.score}</td>
                            {members.length >= 3 && <td className={`py-2 text-center tabular-nums ${isLive ? 'pulse-live-score' : ''}`} style={{ width: '32px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#ffffff', fontSize: '0.75rem' }}>{r.unicorns}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 flex-1">
                <div className="text-xs text-slate-500">
                  No results for GW {displayGw}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <Link
      to={`/league/${leagueCode}`}
      className="w-[320px] flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible hover:shadow-md transition-shadow block no-underline"
      style={{ 
        minHeight: `${cardHeight}px`,
        height: 'auto', // Use auto to allow card to grow to fit all rows
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {cardContent}
    </Link>
  );
}

