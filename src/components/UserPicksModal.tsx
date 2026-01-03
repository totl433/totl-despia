import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import GameweekFixturesCardList from './GameweekFixturesCardList';
import type { Fixture, LiveScore } from './FixtureCard';
import { useLiveScores } from '../hooks/useLiveScores';
import { useGameweekState } from '../hooks/useGameweekState';

export interface UserPicksModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string | null;
  gw: number;
  globalRank?: number;
  fallbackGw?: number | null; // Previous GW to show if current GW deadline hasn't passed
}

export default function UserPicksModal({
  isOpen,
  onClose,
  userId,
  userName,
  gw,
  globalRank,
  fallbackGw,
}: UserPicksModalProps) {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [picks, setPicks] = useState<Record<number, "H" | "D" | "A">>({});
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveScoresByFixtureIndex, setLiveScoresByFixtureIndex] = useState<Map<number, LiveScore>>(new Map());
  const [gwRankPercent, setGwRankPercent] = useState<number | undefined>(undefined);
  const [displayGw, setDisplayGw] = useState<number>(gw); // The GW we're actually displaying

  // Use centralized game state system for deadline checks
  const { state: gwState } = useGameweekState(gw);
  // SAFE: Only show picks if we're CERTAIN deadline has passed (state is not null)
  const deadlinePassed = gwState !== null && 
    (gwState === 'DEADLINE_PASSED' || gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW');

  // Get live scores for the displayed gameweek
  const { liveScores: liveScoresMap } = useLiveScores(displayGw, undefined);

  // Fetch fixtures and picks when modal opens
  useEffect(() => {
    if (!isOpen || !userId || !gw) {
      setLoading(false);
      return;
    }

    let alive = true;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Use centralized game state (already calculated by useGameweekState hook above)
        // deadlinePassed is derived from gwState
        
        // Determine which GW to display
        let gwToDisplay = gw;
        let shouldShowFallback = false;
        
        // If deadline hasn't passed and we have a fallback GW, try showing that instead
        if (!deadlineHasPassed && fallbackGw) {
          // Check if user has picks for fallback GW
          const { data: fallbackSubmission } = await supabase
            .from('app_gw_submissions')
            .select('submitted_at')
            .eq('gw', fallbackGw)
            .eq('user_id', userId)
            .maybeSingle();
          
          if (fallbackSubmission?.submitted_at) {
            // User submitted for fallback GW, show that instead
            gwToDisplay = fallbackGw;
            shouldShowFallback = true;
          }
        }
        
        if (!alive) return;
        
        setDisplayGw(gwToDisplay);
        
        // If deadline hasn't passed and no fallback to show, don't fetch picks
        if (!deadlineHasPassed && !shouldShowFallback) {
          setLoading(false);
          setHasSubmitted(null);
          setPicks({});
          setFixtures([]);
          return;
        }

        // Fetch fixtures for the gameweek we're displaying
        const { data: fxData, error: fxError } = await supabase
          .from('app_fixtures')
          .select('id, gw, fixture_index, home_name, away_name, home_team, away_team, home_code, away_code, kickoff_time, api_match_id')
          .eq('gw', gwToDisplay)
          .order('fixture_index', { ascending: true });

        if (fxError) {
          throw new Error(`Failed to load fixtures: ${fxError.message}`);
        }

        if (!alive) return;

        const fixturesList = (fxData as Fixture[]) ?? [];
        setFixtures(fixturesList);

        // Fetch picks for this user and gameweek
        const { data: picksData, error: picksError } = await supabase
          .from('app_picks')
          .select('fixture_index, pick')
          .eq('gw', gwToDisplay)
          .eq('user_id', userId);

        if (picksError) {
          throw new Error(`Failed to load picks: ${picksError.message}`);
        }

        if (!alive) return;

        // Convert picks array to Record<fixture_index, pick>
        const picksMap: Record<number, "H" | "D" | "A"> = {};
        (picksData ?? []).forEach((p: any) => {
          picksMap[p.fixture_index] = p.pick;
        });
        setPicks(picksMap);

        // Check if user has submitted for this gameweek
        const { data: submissionData, error: submissionError } = await supabase
          .from('app_gw_submissions')
          .select('submitted_at')
          .eq('gw', gwToDisplay)
          .eq('user_id', userId)
          .maybeSingle();

        if (submissionError) {
          console.error('[UserPicksModal] Error checking submission:', submissionError);
        }

        if (!alive) return;

        // User has submitted if there's a submission record with a non-null submitted_at
        const submitted = Boolean(submissionData?.submitted_at);
        setHasSubmitted(submitted);

        // Calculate gameweek ranking percentage
        if (submitted) {
          const { data: gwPointsData, error: gwPointsError } = await supabase
            .from('app_v_gw_points')
            .select('user_id, points')
            .eq('gw', gwToDisplay);

          if (!gwPointsError && gwPointsData && gwPointsData.length > 0) {
            // Sort by points descending
            const sorted = [...gwPointsData].sort((a, b) => (b.points || 0) - (a.points || 0));
            
            // Find user's rank (handling ties - same rank for same points)
            let userRank = 1;
            let userPoints: number | null = null;
            for (let i = 0; i < sorted.length; i++) {
              if (i > 0 && sorted[i - 1].points !== sorted[i].points) {
                userRank = i + 1;
              }
              if (sorted[i].user_id === userId) {
                userPoints = sorted[i].points || 0;
                break;
              }
            }

            // Calculate rank percentage: (rank / total_users) * 100
            // This is already the percentile, so we can use it directly
            const totalUsers = sorted.length;
            const rankPercent = Math.round((userRank / totalUsers) * 100);
            
            // Debug logging to help identify discrepancies
            console.log('[UserPicksModal] Percentage calculation:',
              'GW:', gwToDisplay,
              'UserId:', userId,
              'UserRank:', userRank,
              'TotalUsers:', totalUsers,
              'UserPoints:', userPoints,
              'RankPercent:', rankPercent,
              'Top5:', sorted.slice(0, 5).map(u => ({ userId: u.user_id, points: u.points }))
            );
            
            if (alive) {
              setGwRankPercent(rankPercent);
            }
          }
        } else {
          if (alive) {
            setGwRankPercent(undefined);
          }
        }

        setLoading(false);
      } catch (err: any) {
        console.error('[UserPicksModal] Error fetching data:', err);
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
  }, [isOpen, userId, gw, fallbackGw]);

  // Update live scores map when fixtures or live scores change
  useEffect(() => {
    if (fixtures.length === 0) {
      setLiveScoresByFixtureIndex(new Map());
      return;
    }

    const updatedMap = new Map<number, LiveScore>();
    liveScoresMap.forEach((score) => {
      if (score.gw === gw) {
        const fixture = fixtures.find(f => f.api_match_id === score.api_match_id);
        if (fixture) {
          updatedMap.set(fixture.fixture_index, {
            status: score.status || 'SCHEDULED',
            minute: score.minute ?? null,
            homeScore: score.home_score ?? 0,
            awayScore: score.away_score ?? 0,
            home_team: score.home_team ?? null,
            away_team: score.away_team ?? null,
            goals: score.goals?.map(g => ({
              team: g.team || '',
              scorer: g.scorer || '',
              minute: g.minute ?? null,
            })) ?? undefined,
            red_cards: score.red_cards?.map(r => ({
              team: r.team || '',
              player: r.player || '',
              minute: r.minute ?? null,
            })) ?? undefined,
          });
        }
      }
    });
    setLiveScoresByFixtureIndex(updatedMap);
  }, [fixtures, liveScoresMap, gw]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        style={{
          animation: 'fadeIn 200ms ease-out',
          zIndex: 999999,
        }}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4 z-[1000000]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-picks-modal-title"
        onClick={(e) => {
          // Close if clicking on backdrop
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className="relative max-w-2xl w-full max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-h-[90vh] overflow-y-auto pt-8 pb-4">
            {loading ? (
              <div className="bg-white rounded-3xl shadow-2xl p-12 flex items-center justify-center">
                <div className="text-slate-500">Loading picks...</div>
              </div>
            ) : error ? (
              <div className="bg-white rounded-3xl shadow-2xl p-12 flex items-center justify-center">
                <div className="text-red-500">{error}</div>
              </div>
            ) : !deadlinePassed && displayGw === gw && gwState !== null ? (
              <div className="bg-white rounded-3xl shadow-2xl p-12 flex flex-col items-center justify-center">
                <div className="text-slate-500 text-lg font-medium mb-2">Predictions hidden</div>
                <div className="text-slate-400 text-sm">Predictions for GW {gw} will be visible after the deadline</div>
              </div>
            ) : fixtures.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-2xl p-12 flex items-center justify-center">
                <div className="text-slate-500">No fixtures available for this gameweek</div>
              </div>
            ) : hasSubmitted === false || (hasSubmitted === null && Object.keys(picks).length === 0) ? (
              <div className="bg-white rounded-3xl shadow-2xl p-12 flex flex-col items-center justify-center">
                <div className="text-slate-500 text-lg font-medium mb-2">Hasn't submitted</div>
                <div className="text-slate-400 text-sm">{userName || 'User'} hasn't submitted picks for GW {displayGw}</div>
              </div>
            ) : (
              <GameweekFixturesCardList
                gw={displayGw}
                fixtures={fixtures}
                picks={picks}
                liveScores={liveScoresByFixtureIndex}
                userName={userName || 'User'}
                globalRank={globalRank}
                gwRankPercent={gwRankPercent}
                className="!pt-4 sm:!pt-6"
              />
            )}
          </div>
          
          {/* Close button - underneath the card, bottom right */}
          <div className="flex justify-end mt-4">
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6 text-white font-bold"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // Render to document.body using portal to ensure it's above everything
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }

  return content;
}

