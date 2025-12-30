import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateLastGwRank, calculateFormRank, calculateSeasonRank } from '../lib/helpers';
import html2canvas from 'html2canvas';

export interface GameweekResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gw: number;
  nextGw?: number | null; // Next GW if published
  mockResults?: GwResults | null; // For Storybook/testing - bypasses data fetching
}

export interface GwResults {
  score: number;
  totalFixtures: number;
  gwRank: number | null;
  gwRankTotal: number | null;
  trophies: {
    gw: boolean;
    form5: boolean;
    form10: boolean;
    overall: boolean;
  };
  mlVictories: number;
  leaderboardChanges: {
    overall: { before: number | null; after: number | null; change: number | null };
    form5: { before: number | null; after: number | null; change: number | null };
    form10: { before: number | null; after: number | null; change: number | null };
  };
}

export default function GameweekResultsModal({
  isOpen,
  onClose,
  gw,
  nextGw,
  mockResults,
}: GameweekResultsModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GwResults | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Fetch all data for this GW
  useEffect(() => {
    if (!isOpen || !gw) {
      setLoading(false);
      return;
    }

    // If mockResults provided, use them (for Storybook/testing)
    if (mockResults !== undefined) {
      setResults(mockResults);
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setLoading(false);
      return;
    }

    let alive = true;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // 1. Get GW score and rank
        const { data: gwPointsData, error: gwPointsError } = await supabase
          .from('app_v_gw_points')
          .select('user_id, points')
          .eq('gw', gw);

        if (gwPointsError) throw new Error(`Failed to load GW points: ${gwPointsError.message}`);
        if (!alive) return;

        const allGwPoints = (gwPointsData ?? []).map((p: any) => ({
          user_id: p.user_id,
          gw: gw,
          points: p.points || 0,
        }));

        const userGwPoints = allGwPoints.find((p) => p.user_id === user.id);
        const score = userGwPoints?.points || 0;

        // Calculate GW rank
        const gwRankData = calculateLastGwRank(user.id, gw, allGwPoints);
        const gwRank = gwRankData?.rank || null;
        const gwRankTotal = gwRankData?.total || null;

        // Get total fixtures for this GW
        const { data: fixturesData } = await supabase
          .from('app_fixtures')
          .select('id')
          .eq('gw', gw);
        const totalFixtures = fixturesData?.length || 10;

        if (!alive) return;

        // 2. Calculate trophies earned in THIS GW
        const trophies = {
          gw: false,
          form5: false,
          form10: false,
          overall: false,
        };

        // GW trophy: finished #1 in this GW
        if (gwRank === 1) {
          trophies.gw = true;
        }

        // 5-form trophy: finished #1 in 5-form after this GW (if GW >= 5)
        if (gw >= 5) {
          const { data: allPointsForForm } = await supabase
            .from('app_v_gw_points')
            .select('user_id, gw, points')
            .gte('gw', gw - 4)
            .lte('gw', gw);

          const { data: overallData } = await supabase
            .from('app_v_ocp_overall')
            .select('user_id, name, ocp');

          if (allPointsForForm && overallData) {
            const form5Rank = calculateFormRank(
              user.id,
              gw - 4,
              gw,
              allPointsForForm.map((p: any) => ({
                user_id: p.user_id,
                gw: p.gw,
                points: p.points || 0,
              })),
              overallData.map((o: any) => ({
                user_id: o.user_id,
                name: o.name,
                ocp: o.ocp || 0,
              }))
            );
            if (form5Rank?.rank === 1) {
              trophies.form5 = true;
            }
          }
        }

        // 10-form trophy: finished #1 in 10-form after this GW (if GW >= 10)
        if (gw >= 10) {
          const { data: allPointsForForm } = await supabase
            .from('app_v_gw_points')
            .select('user_id, gw, points')
            .gte('gw', gw - 9)
            .lte('gw', gw);

          const { data: overallData } = await supabase
            .from('app_v_ocp_overall')
            .select('user_id, name, ocp');

          if (allPointsForForm && overallData) {
            const form10Rank = calculateFormRank(
              user.id,
              gw - 9,
              gw,
              allPointsForForm.map((p: any) => ({
                user_id: p.user_id,
                gw: p.gw,
                points: p.points || 0,
              })),
              overallData.map((o: any) => ({
                user_id: o.user_id,
                name: o.name,
                ocp: o.ocp || 0,
              }))
            );
            if (form10Rank?.rank === 1) {
              trophies.form10 = true;
            }
          }
        }

        // Overall trophy: finished #1 in overall after this GW
        const { data: overallData } = await supabase
          .from('app_v_ocp_overall')
          .select('user_id, name, ocp');

        if (overallData) {
          const overallRank = calculateSeasonRank(
            user.id,
            overallData.map((o: any) => ({
              user_id: o.user_id,
              name: o.name,
              ocp: o.ocp || 0,
            }))
          );
          if (overallRank?.rank === 1) {
            trophies.overall = true;
          }
        }

        if (!alive) return;

        // 3. Count ML victories (leagues where user finished #1 for this GW)
        let mlVictories = 0;

        // Get all leagues user is in
        const { data: userLeagues } = await supabase
          .from('league_members')
          .select('league_id')
          .eq('user_id', user.id);

        if (userLeagues && userLeagues.length > 0) {
          const leagueIds = userLeagues.map((l: any) => l.league_id);

          // For each league, check if user won
          for (const leagueId of leagueIds) {
            // Get all members of this league
            const { data: members } = await supabase
              .from('league_members')
              .select('user_id')
              .eq('league_id', leagueId);

            if (!members || members.length < 2) continue; // Need at least 2 members

            const memberIds = members.map((m: any) => m.user_id);

            // Get GW points for all members
            const { data: leagueGwPoints } = await supabase
              .from('app_v_gw_points')
              .select('user_id, points')
              .eq('gw', gw)
              .in('user_id', memberIds);

            if (!leagueGwPoints || leagueGwPoints.length === 0) continue;

            // Get picks for unicorn calculation (if league has 3+ members)
            let unicornCounts: Map<string, number> = new Map();
            if (members.length >= 3) {
              const { data: allPicks } = await supabase
                .from('app_picks')
                .select('fixture_index, pick, user_id')
                .eq('gw', gw)
                .in('user_id', memberIds);

              const { data: results } = await supabase
                .from('app_gw_results')
                .select('fixture_index, result')
                .eq('gw', gw);

              if (allPicks && results) {
                // Count unicorns per user
                const fixturePicks = new Map<number, Map<'H' | 'D' | 'A', string[]>>();
                allPicks.forEach((pick: any) => {
                  if (!fixturePicks.has(pick.fixture_index)) {
                    fixturePicks.set(pick.fixture_index, new Map());
                  }
                  const picks = fixturePicks.get(pick.fixture_index)!;
                  if (!picks.has(pick.pick)) {
                    picks.set(pick.pick, []);
                  }
                  picks.get(pick.pick)!.push(pick.user_id);
                });

                results.forEach((result: any) => {
                  const picks = fixturePicks.get(result.fixture_index);
                  if (picks) {
                    const correctPicks = picks.get(result.result);
                    if (correctPicks && correctPicks.length === 1) {
                      // Only one person got it right - unicorn!
                      const userId = correctPicks[0];
                      unicornCounts.set(userId, (unicornCounts.get(userId) || 0) + 1);
                    }
                  }
                });
              }
            }

            // Sort by points (desc), then unicorns (desc)
            const sorted = [...leagueGwPoints]
              .map((p: any) => ({
                user_id: p.user_id,
                points: p.points || 0,
                unicorns: unicornCounts.get(p.user_id) || 0,
              }))
              .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return b.unicorns - a.unicorns;
              });

            // Check if user is first (and not a draw)
            if (sorted.length > 0 && sorted[0].user_id === user.id) {
              const isDraw =
                sorted.length > 1 &&
                sorted[0].points === sorted[1].points &&
                sorted[0].unicorns === sorted[1].unicorns;
              if (!isDraw) {
                mlVictories++;
              }
            }
          }
        }

        if (!alive) return;

        // 4. Calculate leaderboard changes (before vs after this GW)
        const leaderboardChanges = {
          overall: { before: null as number | null, after: null as number | null, change: null as number | null },
          form5: { before: null as number | null, after: null as number | null, change: null as number | null },
          form10: { before: null as number | null, after: null as number | null, change: null as number | null },
        };

        // Get overall data before and after
        const { data: overallDataForChanges } = await supabase
          .from('app_v_ocp_overall')
          .select('user_id, name, ocp');

        if (overallDataForChanges) {
          // After: current overall rank
          const afterOverall = calculateSeasonRank(
            user.id,
            overallDataForChanges.map((o: any) => ({
              user_id: o.user_id,
              name: o.name,
              ocp: o.ocp || 0,
            }))
          );
          leaderboardChanges.overall.after = afterOverall?.rank || null;

          // Before: calculate overall rank up to GW-1
          if (gw > 1) {
            const { data: allPointsBefore } = await supabase
              .from('app_v_gw_points')
              .select('user_id, gw, points')
              .lt('gw', gw);

            if (allPointsBefore) {
              const usersBefore = new Set(allPointsBefore.map((p: any) => p.user_id));
              const overallBefore = Array.from(usersBefore).map((uid) => {
                const points = allPointsBefore
                  .filter((p: any) => p.user_id === uid)
                  .reduce((sum, p) => sum + (p.points || 0), 0);
                const userData = overallDataForChanges.find((o: any) => o.user_id === uid);
                return {
                  user_id: uid,
                  name: userData?.name || null,
                  ocp: points,
                };
              });

              const beforeOverall = calculateSeasonRank(user.id, overallBefore);
              leaderboardChanges.overall.before = beforeOverall?.rank || null;
            }
          }
        }

        // Calculate form changes
        if (gw >= 5) {
          const { data: allPointsForForm } = await supabase
            .from('app_v_gw_points')
            .select('user_id, gw, points')
            .gte('gw', Math.max(1, gw - 4))
            .lte('gw', gw);

          const { data: overallDataForForm } = await supabase
            .from('app_v_ocp_overall')
            .select('user_id, name, ocp');

          if (allPointsForForm && overallDataForForm) {
            // After: 5-form rank including this GW
            const afterForm5 = calculateFormRank(
              user.id,
              gw - 4,
              gw,
              allPointsForForm.map((p: any) => ({
                user_id: p.user_id,
                gw: p.gw,
                points: p.points || 0,
              })),
              overallDataForForm.map((o: any) => ({
                user_id: o.user_id,
                name: o.name,
                ocp: o.ocp || 0,
              }))
            );
            leaderboardChanges.form5.after = afterForm5?.rank || null;

            // Before: 5-form rank up to GW-1
            if (gw > 5) {
              const beforeForm5 = calculateFormRank(
                user.id,
                gw - 5,
                gw - 1,
                allPointsForForm
                  .filter((p: any) => p.gw < gw)
                  .map((p: any) => ({
                    user_id: p.user_id,
                    gw: p.gw,
                    points: p.points || 0,
                  })),
                overallDataForForm.map((o: any) => ({
                  user_id: o.user_id,
                  name: o.name,
                  ocp: o.ocp || 0,
                }))
              );
              leaderboardChanges.form5.before = beforeForm5?.rank || null;
            }
          }
        }

        if (gw >= 10) {
          const { data: allPointsForForm } = await supabase
            .from('app_v_gw_points')
            .select('user_id, gw, points')
            .gte('gw', Math.max(1, gw - 9))
            .lte('gw', gw);

          const { data: overallDataForForm } = await supabase
            .from('app_v_ocp_overall')
            .select('user_id, name, ocp');

          if (allPointsForForm && overallDataForForm) {
            // After: 10-form rank including this GW
            const afterForm10 = calculateFormRank(
              user.id,
              gw - 9,
              gw,
              allPointsForForm.map((p: any) => ({
                user_id: p.user_id,
                gw: p.gw,
                points: p.points || 0,
              })),
              overallDataForForm.map((o: any) => ({
                user_id: o.user_id,
                name: o.name,
                ocp: o.ocp || 0,
              }))
            );
            leaderboardChanges.form10.after = afterForm10?.rank || null;

            // Before: 10-form rank up to GW-1
            if (gw > 10) {
              const beforeForm10 = calculateFormRank(
                user.id,
                gw - 10,
                gw - 1,
                allPointsForForm
                  .filter((p: any) => p.gw < gw)
                  .map((p: any) => ({
                    user_id: p.user_id,
                    gw: p.gw,
                    points: p.points || 0,
                  })),
                overallDataForForm.map((o: any) => ({
                  user_id: o.user_id,
                  name: o.name,
                  ocp: o.ocp || 0,
                }))
              );
              leaderboardChanges.form10.before = beforeForm10?.rank || null;
            }
          }
        }

        // Calculate changes
        if (leaderboardChanges.overall.before !== null && leaderboardChanges.overall.after !== null) {
          leaderboardChanges.overall.change = leaderboardChanges.overall.before - leaderboardChanges.overall.after;
        }
        if (leaderboardChanges.form5.before !== null && leaderboardChanges.form5.after !== null) {
          leaderboardChanges.form5.change = leaderboardChanges.form5.before - leaderboardChanges.form5.after;
        }
        if (leaderboardChanges.form10.before !== null && leaderboardChanges.form10.after !== null) {
          leaderboardChanges.form10.change = leaderboardChanges.form10.before - leaderboardChanges.form10.after;
        }

        if (!alive) return;

        setResults({
          score,
          totalFixtures,
          gwRank,
          gwRankTotal,
          trophies,
          mlVictories,
          leaderboardChanges,
        });

        setLoading(false);
      } catch (err: any) {
        console.error('[GameweekResultsModal] Error fetching data:', err);
        if (alive) {
          setError(err?.message || 'Failed to load results');
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      alive = false;
    };
  }, [isOpen, user?.id, gw]);

  // Share functionality
  const handleShare = async () => {
    if (!cardRef.current || isSharing) return;

    setIsSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imageUrl = canvas.toDataURL('image/png', 0.95);
      setShareImageUrl(imageUrl);
      setShowShareSheet(true);
      setIsSharing(false);
    } catch (error) {
      console.error('[GameweekResultsModal] Error generating share image:', error);
      setIsSharing(false);
    }
  };

  // Continue to next GW
  const handleContinue = async () => {
    if (!nextGw || isTransitioning || !user?.id) return;

    setIsTransitioning(true);
    try {
      const { error } = await supabase
        .from('user_notification_preferences')
        .update({
          current_viewing_gw: nextGw,
        })
        .eq('user_id', user.id);

      if (error) {
        // Try upsert if no row exists
        await supabase
          .from('user_notification_preferences')
          .upsert({
            user_id: user.id,
            current_viewing_gw: nextGw,
            preferences: {},
          }, {
            onConflict: 'user_id',
          });
      }

      // Dispatch event and reload
      window.dispatchEvent(new CustomEvent('gwTransition', { detail: { newGw: nextGw } }));
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error) {
      console.error('[GameweekResultsModal] Error transitioning GW:', error);
      setIsTransitioning(false);
    }
  };

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

  const trophyCount = Object.values(results?.trophies || {}).filter(Boolean).length;

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
        aria-labelledby="gw-results-modal-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          ref={cardRef}
          className="relative max-w-lg w-full bg-white rounded-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="text-slate-500">Loading results...</div>
            </div>
          ) : error ? (
            <div className="p-12 flex items-center justify-center">
              <div className="text-red-500">{error}</div>
            </div>
          ) : results ? (
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1">
                  Gameweek {gw} Results
                </h2>
              </div>

              {/* Score */}
              <div className="text-center mb-6">
                <div className="text-5xl sm:text-6xl font-bold text-emerald-600 mb-2">
                  {results.score}/{results.totalFixtures}
                </div>
                <div className="text-slate-600 text-sm">Correct Predictions</div>
              </div>

              {/* Trophies - only show if > 0 */}
              {trophyCount > 0 && (
                <div className="mb-6 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200">
                  <div className="text-center mb-3">
                    <div className="text-lg font-bold text-yellow-800 mb-2">🏆 Trophies Earned!</div>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {results.trophies.gw && (
                        <div className="px-3 py-1.5 bg-yellow-400 rounded-full text-yellow-900 font-bold text-sm">
                          GW Winner
                        </div>
                      )}
                      {results.trophies.form5 && (
                        <div className="px-3 py-1.5 bg-yellow-400 rounded-full text-yellow-900 font-bold text-sm">
                          5-Week Form
                        </div>
                      )}
                      {results.trophies.form10 && (
                        <div className="px-3 py-1.5 bg-yellow-400 rounded-full text-yellow-900 font-bold text-sm">
                          10-Week Form
                        </div>
                      )}
                      {results.trophies.overall && (
                        <div className="px-3 py-1.5 bg-yellow-400 rounded-full text-yellow-900 font-bold text-sm">
                          Overall Leader
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ML Victories */}
              {results.mlVictories > 0 && (
                <div className="mb-6 text-center">
                  <div className="text-lg font-semibold text-slate-700">
                    🎉 Won {results.mlVictories} Mini-League{results.mlVictories !== 1 ? 's' : ''}!
                  </div>
                </div>
              )}

              {/* Leaderboard Changes */}
              <div className="space-y-3 mb-6">
                {results.gwRank !== null && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">GW Rank</span>
                    <span className="text-slate-800 font-bold">
                      #{results.gwRank} of {results.gwRankTotal}
                    </span>
                  </div>
                )}

                {results.leaderboardChanges.overall.change !== null && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">Overall</span>
                    <span
                      className={`font-bold ${
                        results.leaderboardChanges.overall.change > 0
                          ? 'text-emerald-600'
                          : results.leaderboardChanges.overall.change < 0
                          ? 'text-red-600'
                          : 'text-slate-600'
                      }`}
                    >
                      {results.leaderboardChanges.overall.change > 0
                        ? `↑ Up ${results.leaderboardChanges.overall.change}`
                        : results.leaderboardChanges.overall.change < 0
                        ? `↓ Down ${Math.abs(results.leaderboardChanges.overall.change)}`
                        : 'No change'}
                    </span>
                  </div>
                )}

                {results.leaderboardChanges.form5.change !== null && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">5-Week Form</span>
                    <span
                      className={`font-bold ${
                        results.leaderboardChanges.form5.change > 0
                          ? 'text-emerald-600'
                          : results.leaderboardChanges.form5.change < 0
                          ? 'text-red-600'
                          : 'text-slate-600'
                      }`}
                    >
                      {results.leaderboardChanges.form5.change > 0
                        ? `↑ Up ${results.leaderboardChanges.form5.change}`
                        : results.leaderboardChanges.form5.change < 0
                        ? `↓ Down ${Math.abs(results.leaderboardChanges.form5.change)}`
                        : 'No change'}
                    </span>
                  </div>
                )}

                {results.leaderboardChanges.form10.change !== null && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">10-Week Form</span>
                    <span
                      className={`font-bold ${
                        results.leaderboardChanges.form10.change > 0
                          ? 'text-emerald-600'
                          : results.leaderboardChanges.form10.change < 0
                          ? 'text-red-600'
                          : 'text-slate-600'
                      }`}
                    >
                      {results.leaderboardChanges.form10.change > 0
                        ? `↑ Up ${results.leaderboardChanges.form10.change}`
                        : results.leaderboardChanges.form10.change < 0
                        ? `↓ Down ${Math.abs(results.leaderboardChanges.form10.change)}`
                        : 'No change'}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleShare}
                  disabled={isSharing}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {isSharing ? 'Generating...' : 'SHARE'}
                </button>

                {nextGw && (
                  <button
                    onClick={handleContinue}
                    disabled={isTransitioning}
                    className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isTransitioning ? 'Moving...' : `Move on to GW ${nextGw}`}
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6 text-slate-600 font-bold"
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

      {/* Share Sheet */}
      {showShareSheet && shareImageUrl && (
        <div className="fixed inset-0 bg-black/80 z-[1000001] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Share Your Results</h3>
            <img src={shareImageUrl} alt="Results" className="w-full rounded-lg mb-4" />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.share?.({
                    title: `Gameweek ${gw} Results`,
                    text: `I scored ${results?.score}/${results?.totalFixtures} in Gameweek ${gw}!`,
                    files: [
                      new File(
                        [shareImageUrl.split(',')[1]],
                        `gw${gw}-results.png`,
                        { type: 'image/png' }
                      ),
                    ],
                  });
                }}
                className="flex-1 py-2 px-4 bg-emerald-600 text-white rounded-lg font-medium"
              >
                Share
              </button>
              <button
                onClick={() => {
                  setShowShareSheet(false);
                  setTimeout(() => {
                    if (shareImageUrl) {
                      URL.revokeObjectURL(shareImageUrl);
                      setShareImageUrl(null);
                    }
                  }, 300);
                }}
                className="flex-1 py-2 px-4 bg-slate-200 text-slate-800 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }

  return content;
}

