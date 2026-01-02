import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateLastGwRank, calculateFormRank, calculateSeasonRank } from '../lib/helpers';
import { toPng } from 'html-to-image';
import ShareSheet from './ShareSheet';
import { fireConfettiCannon } from '../lib/confettiCannon';
import { getLeagueAvatarUrl, getDefaultMlAvatar } from '../lib/leagueAvatars';
import { formatPercentage } from '../lib/formatPercentage';

// Helper function to get ordinal suffix
function getOrdinalSuffix(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) {
    return 'st';
  }
  if (j === 2 && k !== 12) {
    return 'nd';
  }
  if (j === 3 && k !== 13) {
    return 'rd';
  }
  return 'th';
}

export interface GameweekResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gw: number;
  nextGw?: number | null; // Next GW if published
  mockResults?: GwResults | null; // For Storybook/testing - bypasses data fetching
  onLoadingChange?: (loading: boolean) => void; // Callback when loading state changes
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
  mlVictoryNames: string[]; // Names of the mini-leagues won
  mlVictoryData: Array<{ id: string; name: string; avatar: string | null }>; // Full league data for won leagues
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
  onLoadingChange,
}: GameweekResultsModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GwResults | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState<string>('');

  // Fetch all data for this GW
  useEffect(() => {
    if (!isOpen || !gw) {
      setLoading(false);
      onLoadingChange?.(false);
      return;
    }

    // If mockResults provided, use them (for Storybook/testing)
    if (mockResults !== undefined && mockResults !== null) {
      // Ensure mlVictoryData exists (for backwards compatibility)
      const resultsWithDefaults = {
        ...mockResults,
        mlVictoryData: mockResults.mlVictoryData || mockResults.mlVictoryNames?.map((name, idx) => ({
          id: `mock-${idx}`,
          name,
          avatar: null,
        })) || [],
      };
      setResults(resultsWithDefaults);
      setLoading(false);
      onLoadingChange?.(false);
      return;
    }

    if (!user?.id) {
      setLoading(false);
      onLoadingChange?.(false);
      return;
    }

    // TypeScript: user is guaranteed to be non-null after the check above
    const userId = user.id;

    let alive = true;

    async function fetchData() {
      setLoading(true);
      onLoadingChange?.(true);
      setError(null);

      try {
        // 1. Get GW score and rank
        const { data: gwPointsData, error: gwPointsError } = await supabase
          .from('app_v_gw_points')
          .select('user_id, points')
          .eq('gw', gw);

        if (gwPointsError) {
          throw new Error(`Failed to load GW points: ${gwPointsError.message}`);
        }
        if (!alive) return;


        const allGwPoints = (gwPointsData ?? []).map((p: any) => ({
          user_id: p.user_id,
          gw: gw,
          points: p.points || 0,
        }));

        const userGwPoints = allGwPoints.find((p) => p.user_id === userId);
        const score = userGwPoints?.points || 0;

        // Calculate GW rank
        const gwRankData = calculateLastGwRank(userId, gw, allGwPoints);
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
              userId,
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
              userId,
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
            userId,
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
        const mlVictoryNames: string[] = [];
        const mlVictoryData: Array<{ id: string; name: string; avatar: string | null }> = [];

        // Get all leagues user is in
        const { data: userLeagues } = await supabase
          .from('league_members')
          .select('league_id')
          .eq('user_id', userId);

        if (userLeagues && userLeagues.length > 0) {
          const leagueIds = userLeagues.map((l: any) => l.league_id);

          // For each league, check if user won
          for (const leagueId of leagueIds) {
            // Get league name and avatar
            const { data: leagueData, error: leagueError } = await supabase
              .from('leagues')
              .select('id, name, avatar')
              .eq('id', leagueId)
              .maybeSingle();
            
            const leagueName = leagueData?.name || 'Unknown League';
            const leagueAvatar = leagueData?.avatar || null;

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
            if (sorted.length > 0 && sorted[0].user_id === userId) {
              const isDraw =
                sorted.length > 1 &&
                sorted[0].points === sorted[1].points &&
                sorted[0].unicorns === sorted[1].unicorns;
              if (!isDraw) {
                mlVictories++;
                mlVictoryNames.push(leagueName);
                mlVictoryData.push({
                  id: leagueId,
                  name: leagueName,
                  avatar: leagueAvatar,
                });
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
            userId,
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

              const beforeOverall = calculateSeasonRank(userId, overallBefore);
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
              userId,
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
                userId,
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
              userId,
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
                userId,
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

        const finalResults = {
          score,
          totalFixtures,
          gwRank,
          gwRankTotal,
          trophies,
          mlVictories,
          mlVictoryNames,
          mlVictoryData,
          leaderboardChanges,
        };

        setResults(finalResults);
        setLoading(false);
        onLoadingChange?.(false);
      } catch (err: any) {
        if (alive) {
          setError(err?.message || 'Failed to load results');
          setLoading(false);
          onLoadingChange?.(false);
        }
      }
    }

    fetchData();

    return () => {
      alive = false;
    };
  }, [isOpen, user?.id, gw, mockResults]);

  // Share functionality
  const handleShare = async () => {
    if (isSharing || !results) {
      return;
    }

    // Get user name
    const displayUserName = user?.user_metadata?.display_name || user?.email || 'User';
    
    // Set userName and showShareSheet
    setUserName(displayUserName);
    setShareImageUrl(null); // Show loading state
    setIsSharing(true);
    // Open ShareSheet immediately with loading state
    setShowShareSheet(true);
    
    // Small delay to ensure state is updated before rendering capture component
    await new Promise(resolve => setTimeout(resolve, 100));
    setShowCaptureModal(true);
    
    // Wait longer for modal to fully render and layout to settle
    await new Promise(resolve => setTimeout(resolve, 1500));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Wait for ref to be set (with timeout)
    let retries = 0;
    while (!shareCardRef.current && retries < 15) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    // Force multiple reflows to ensure layout is calculated
    if (shareCardRef.current) {
      void shareCardRef.current.offsetHeight;
      void shareCardRef.current.offsetWidth;
      await new Promise(resolve => requestAnimationFrame(resolve));
      void shareCardRef.current.offsetHeight;
    }

    try {
      if (!shareCardRef.current) {
        throw new Error('Capture element not found - ref was not set after retries');
      }
      
      const element = shareCardRef.current;
      
      // Wait for all images in the element to load
      const images = element.querySelectorAll('img');
      await Promise.all(Array.from(images).map((img: HTMLImageElement) => {
        const isVolleyImage = img.src.includes('Volley') || img.src.includes('volley');
        const timeout = isVolleyImage ? 5000 : 3000;
        
        if (img.complete && img.naturalWidth > 0) {
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            img.style.display = 'none';
            img.style.visibility = 'hidden';
            img.style.opacity = '0';
            resolve(null);
          }, timeout);
          img.onload = () => {
            clearTimeout(timeoutId);
            resolve(null);
          };
          img.onerror = () => {
            clearTimeout(timeoutId);
            img.style.display = 'none';
            img.style.visibility = 'hidden';
            img.style.opacity = '0';
            resolve(null);
          };
        });
      }));
      
      // Additional wait to ensure everything is settled
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Hide any images that failed to load before capture
      Array.from(images).forEach((img: HTMLImageElement) => {
        if (!img.complete || img.naturalWidth === 0) {
          img.style.display = 'none';
          img.style.visibility = 'hidden';
          img.style.opacity = '0';
        }
      });
      
      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        quality: 0.95,
        cacheBust: true,
        filter: (node) => {
          // Skip any images that are hidden or failed to load
          if (node instanceof HTMLImageElement) {
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              return false;
            }
            if (!node.complete || node.naturalWidth === 0) {
              return false;
            }
          }
          return true;
        },
      });
      
      setShareImageUrl(dataUrl);
      setIsSharing(false);
      // Close capture modal after image is generated
      setShowCaptureModal(false);
    } catch (error) {
      setIsSharing(false);
      setShowCaptureModal(false);
    }
  };

  const handleCloseShareSheet = () => {
    setShowShareSheet(false);
    setIsSharing(false);
    setShowCaptureModal(false);
    setTimeout(() => {
      if (shareImageUrl) {
        URL.revokeObjectURL(shareImageUrl);
        setShareImageUrl(null);
      }
      // Close the modal after ShareSheet is closed
      onClose();
    }, 300);
  };

  // Continue to next GW
  const handleContinue = async () => {
    if (!nextGw || isTransitioning || !user?.id) return;

    const userId = user.id;
    setIsTransitioning(true);
    try {
      const { error } = await supabase
        .from('user_notification_preferences')
        .update({
          current_viewing_gw: nextGw,
        })
        .eq('user_id', userId);

      if (error) {
        // Try upsert if no row exists
        await supabase
          .from('user_notification_preferences')
          .upsert({
            user_id: userId,
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

  // Fire confetti when card is loaded (not during loading)
  useEffect(() => {
    if (isOpen && !loading && results !== null) {
      // Fire confetti once the card is fully loaded - fun pop effect!
      setTimeout(() => {
        fireConfettiCannon();
      }, 300);
    }
  }, [isOpen, loading, results]);

  // Clean up loading state when modal closes
  useEffect(() => {
    if (!isOpen) {
      onLoadingChange?.(false);
    }
  }, [isOpen, onLoadingChange]);

  // Don't render modal content until data is ready
  // But allow ShareSheet to render even when modal is closed
  // Keep component mounted if ShareSheet is open, even if modal is closed
  if (!isOpen && !showShareSheet) return null;
  if (loading || !results) {
    // Still allow ShareSheet to render if it's open
    if (showShareSheet) {
      return (
        <>
          {showShareSheet && (
            <div style={{ zIndex: 1000002 }}>
              <ShareSheet
                isOpen={showShareSheet}
                onClose={handleCloseShareSheet}
                imageUrl={shareImageUrl || ''}
                fileName={`gw${gw}-results.png`}
                gw={gw}
                userName={userName || user?.user_metadata?.display_name || user?.email || 'User'}
              />
            </div>
          )}
        </>
      );
    }
    
    // Show loading state with backdrop and spinner when modal is open but data isn't ready
    return (
      <>
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
          style={{
            animation: 'fadeIn 200ms ease-out',
            zIndex: 999999,
          }}
        />
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          style={{
            zIndex: 1000001,
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl p-12 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
            <p className="text-slate-600 text-sm">Loading results...</p>
          </div>
        </div>
      </>
    );
  }

  const trophyCount = Object.values(results?.trophies || {}).filter(Boolean).length;

  const content = (
    <>
      {/* Backdrop - hide when ShareSheet is open */}
      {!showShareSheet && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
          style={{
            animation: 'fadeIn 200ms ease-out',
            zIndex: 999999,
          }}
        />
      )}

      {/* Modal - hide when ShareSheet is open */}
      {!showShareSheet && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gw-results-modal-title"
          style={{
            zIndex: 1000001, // Above confetti (1000000) and backdrop (999999)
          }}
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
          {error ? (
            <div className="p-12 flex items-center justify-center">
              <div className="text-red-500">{error}</div>
            </div>
          ) : results ? (
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">
                  Gameweek {gw} Results
                </h2>
              </div>

              {/* Score */}
              <div className="relative mb-6">
                <div className="text-center">
                  <div className="mb-2 flex items-center justify-center gap-1">
                    <img
                      src="/assets/Volley/Volley-playing.png"
                      alt="Volley"
                      className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
                    />
                    <div className="text-5xl sm:text-6xl font-bold text-emerald-600">
                      {results.score}/{results.totalFixtures}
                    </div>
                  </div>
                </div>
              </div>

              {/* Trophies - only show if > 0 */}
              {trophyCount > 0 && (
                <div className="mb-6 p-4 bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 rounded-xl shadow-2xl shadow-slate-600/50 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]">
                  <div className="text-center mb-3 relative z-10">
                    <div className="text-lg font-bold text-white mb-2">Trophies Earned!</div>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      {results.trophies.gw && (
                        <div className="flex flex-col items-center">
                          <img
                            src="/assets/Icons/Trophy--Streamline-Rounded-Material-Pro-Free.svg"
                            alt="GW Winner"
                            className="w-12 h-12"
                          />
                          <span className="text-xs font-medium text-white mt-1">GW Winner</span>
                        </div>
                      )}
                      {results.trophies.form5 && (
                        <div className="flex flex-col items-center">
                          <img
                            src="/assets/5-week-form-badge.png"
                            alt="5-Week Form"
                            className="w-12 h-12"
                          />
                          <span className="text-xs font-medium text-white mt-1">5-Week Form</span>
                        </div>
                      )}
                      {results.trophies.form10 && (
                        <div className="flex flex-col items-center">
                          <img
                            src="/assets/10-week-form-badge.png"
                            alt="10-Week Form"
                            className="w-12 h-12"
                          />
                          <span className="text-xs font-medium text-white mt-1">10-Week Form</span>
                        </div>
                      )}
                      {results.trophies.overall && (
                        <div className="flex flex-col items-center">
                          <img
                            src="/assets/season-rank-badge.png"
                            alt="Overall Leader"
                            className="w-12 h-12"
                          />
                          <span className="text-xs font-medium text-white mt-1">Overall Leader</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ML Victories */}
              {results.mlVictories > 0 && (
                <div className="mb-6">
                  <div className="text-center mb-3">
                    <div className="text-lg font-semibold text-slate-700">
                      Won {results.mlVictories} Mini-League{results.mlVictories !== 1 ? 's' : ''}!
                    </div>
                  </div>
                  <div className="flex gap-2 justify-center">
                    {(results.mlVictoryData || results.mlVictoryNames?.map((name, idx) => ({
                      id: `fallback-${idx}`,
                      name,
                      avatar: null,
                    })) || []).map((league) => {
                      const defaultAvatar = getDefaultMlAvatar(league.id);
                      const avatarUrl = getLeagueAvatarUrl(league);
                      return (
                        <div
                          key={league.id}
                          className="flex flex-col items-center bg-slate-50 rounded-lg p-2 min-w-[80px]"
                        >
                          <img
                            src={avatarUrl}
                            alt={`${league.name} avatar`}
                            className="w-12 h-12 rounded-full object-cover mb-1"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
                              if (target.src !== fallbackSrc) {
                                target.src = fallbackSrc;
                              }
                            }}
                            onLoad={() => {}}
                          />
                          <div className="text-xs text-slate-600 text-center truncate max-w-[80px]">
                            {league.name.length > 8 ? `${league.name.substring(0, 8)}...` : league.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* GW Leaderboard - Prominent */}
            {results.gwRank !== null && results.gwRankTotal !== null && (() => {
              const rankPercent = (results.gwRank / results.gwRankTotal) * 100;
              const formatted = formatPercentage(rankPercent);
              return (
                <div className="mb-3 p-3 bg-slate-50 rounded-xl">
                  <div className="text-center">
                    <span className="text-slate-700 font-semibold text-xs mb-1 block">Gameweek {gw} Leaderboard</span>
                    <div className="flex items-end justify-center gap-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-slate-800 font-bold text-3xl">
                          {results.gwRank}
                        </span>
                        <span className="text-slate-600 text-sm">{getOrdinalSuffix(results.gwRank)} of {results.gwRankTotal}</span>
                      </div>
                      {formatted && (
                        <span className={`text-2xl font-bold ${
                          formatted.isTop ? 'text-emerald-700' : 'text-orange-600'
                        }`}>
                          {formatted.text}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Other Leaderboard Stats - Compact */}
            {(results.leaderboardChanges.overall.after !== null || 
              results.leaderboardChanges.form5.after !== null || 
              results.leaderboardChanges.form10.after !== null) && (
              <div className="mb-4 p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-center gap-3">
                  {results.leaderboardChanges.overall.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">Overall:</span>
                      {results.leaderboardChanges.overall.change !== null && results.leaderboardChanges.overall.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.overall.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.overall.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.overall.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.overall.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.overall.after}</span>
                      )}
                    </div>
                  )}
                  {results.leaderboardChanges.form5.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">5W:</span>
                      {results.leaderboardChanges.form5.change !== null && results.leaderboardChanges.form5.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.form5.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.form5.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.form5.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.form5.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.form5.after}</span>
                      )}
                    </div>
                  )}
                  {results.leaderboardChanges.form10.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">10W:</span>
                      {results.leaderboardChanges.form10.change !== null && results.leaderboardChanges.form10.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.form10.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.form10.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.form10.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.form10.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.form10.after}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleShare}
                  disabled={isSharing}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSharing ? (
                    'Generating...'
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                      SHARE
                    </>
                  )}
                </button>
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
      )}

      {/* Temporary modal for capture - invisible but in viewport for html-to-image */}
      {showCaptureModal && results && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: 0,
            overflow: 'hidden',
          }}
        >
          <div
            ref={shareCardRef}
            style={{
              maxWidth: '512px',
              width: '100%',
            }}
            className="bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
          {/* Green Header */}
          <div style={{ 
            backgroundColor: '#1C8376', 
            paddingTop: '6px', 
            paddingBottom: '6px',
            paddingLeft: '16px',
            paddingRight: '16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            minHeight: '50px'
          }}>
            <img 
              src="/assets/badges/totl-logo1.svg" 
              alt="TOTL" 
              style={{ 
                width: '40px', 
                height: '40px',
                filter: 'brightness(0) invert(1)',
                display: 'block',
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)'
              }}
              onError={() => {}}
            />
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">
                Gameweek {gw} Results
              </h2>
            </div>

            {/* Score */}
            <div className="relative mb-6">
              <div className="text-center">
                <div className="mb-2 flex items-center justify-center gap-1">
                  <img
                    src="/assets/Volley/Volley-playing.png"
                    alt="Volley"
                    className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
                  />
                  <div className="text-5xl sm:text-6xl font-bold text-emerald-600">
                    {results.score}/{results.totalFixtures}
                  </div>
                </div>
              </div>
            </div>

            {/* Trophies - only show if > 0 */}
            {trophyCount > 0 && (
              <div className="mb-6 p-4 bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 rounded-xl shadow-2xl shadow-slate-600/50 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]">
                <div className="text-center mb-3 relative z-10">
                  <div className="text-lg font-bold text-white mb-2">Trophies Earned!</div>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    {results.trophies.gw && (
                      <div className="flex flex-col items-center">
                        <img
                          src="/assets/Icons/Trophy--Streamline-Rounded-Material-Pro-Free.svg"
                          alt="GW Winner"
                          className="w-12 h-12"
                        />
                        <span className="text-xs font-medium text-white mt-1">GW Winner</span>
                      </div>
                    )}
                    {results.trophies.form5 && (
                      <div className="flex flex-col items-center">
                        <img
                          src="/assets/5-week-form-badge.png"
                          alt="5-Week Form"
                          className="w-12 h-12"
                        />
                        <span className="text-xs font-medium text-white mt-1">5-Week Form</span>
                      </div>
                    )}
                    {results.trophies.form10 && (
                      <div className="flex flex-col items-center">
                        <img
                          src="/assets/10-week-form-badge.png"
                          alt="10-Week Form"
                          className="w-12 h-12"
                        />
                        <span className="text-xs font-medium text-white mt-1">10-Week Form</span>
                      </div>
                    )}
                    {results.trophies.overall && (
                      <div className="flex flex-col items-center">
                        <img
                          src="/assets/season-rank-badge.png"
                          alt="Overall Leader"
                          className="w-12 h-12"
                        />
                        <span className="text-xs font-medium text-white mt-1">Overall Leader</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ML Victories */}
            {results.mlVictories > 0 && (
              <div className="mb-6">
                <div className="text-center mb-3">
                  <div className="text-lg font-semibold text-slate-700">
                    Won {results.mlVictories} Mini-League{results.mlVictories !== 1 ? 's' : ''}!
                  </div>
                </div>
                <div className="flex gap-2 justify-center">
                  {(results.mlVictoryData || results.mlVictoryNames?.map((name, idx) => ({
                    id: `fallback-${idx}`,
                    name,
                    avatar: null,
                  })) || []).map((league) => {
                    const defaultAvatar = getDefaultMlAvatar(league.id);
                    const avatarUrl = getLeagueAvatarUrl(league);
                    return (
                      <div
                        key={league.id}
                        className="flex flex-col items-center bg-slate-50 rounded-lg p-2 min-w-[80px]"
                      >
                        <img
                          src={avatarUrl}
                          alt={`${league.name} avatar`}
                          className="w-12 h-12 rounded-full object-cover mb-1"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
                            if (target.src !== fallbackSrc) {
                              target.src = fallbackSrc;
                            }
                          }}
                          onLoad={() => {}}
                        />
                        <div className="text-xs text-slate-600 text-center truncate max-w-[80px]">
                          {league.name.length > 8 ? `${league.name.substring(0, 8)}...` : league.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* GW Leaderboard - Prominent */}
            {results.gwRank !== null && results.gwRankTotal !== null && (() => {
              const rankPercent = (results.gwRank / results.gwRankTotal) * 100;
              const formatted = formatPercentage(rankPercent);
              return (
                <div className="mb-3 p-3 bg-slate-50 rounded-xl">
                  <div className="text-center">
                    <span className="text-slate-700 font-semibold text-xs mb-1 block">Gameweek {gw} Leaderboard</span>
                    <div className="flex items-end justify-center gap-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-slate-800 font-bold text-3xl">
                          {results.gwRank}
                        </span>
                        <span className="text-slate-600 text-sm">{getOrdinalSuffix(results.gwRank)} of {results.gwRankTotal}</span>
                      </div>
                      {formatted && (
                        <span className={`text-2xl font-bold ${
                          formatted.isTop ? 'text-emerald-700' : 'text-orange-600'
                        }`}>
                          {formatted.text}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Other Leaderboard Stats - Compact */}
            {(results.leaderboardChanges.overall.after !== null || 
              results.leaderboardChanges.form5.after !== null || 
              results.leaderboardChanges.form10.after !== null) && (
              <div className="mb-4 p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-center gap-3">
                  {results.leaderboardChanges.overall.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">Overall:</span>
                      {results.leaderboardChanges.overall.change !== null && results.leaderboardChanges.overall.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.overall.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.overall.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.overall.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.overall.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.overall.after}</span>
                      )}
                    </div>
                  )}
                  {results.leaderboardChanges.form5.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">5W:</span>
                      {results.leaderboardChanges.form5.change !== null && results.leaderboardChanges.form5.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.form5.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.form5.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.form5.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.form5.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.form5.after}</span>
                      )}
                    </div>
                  )}
                  {results.leaderboardChanges.form10.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">10W:</span>
                      {results.leaderboardChanges.form10.change !== null && results.leaderboardChanges.form10.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.form10.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.form10.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.form10.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.form10.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.form10.after}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          </div>
        </div>
      )}

      {/* Share Sheet - render outside modal */}
      {showShareSheet && (
        <div style={{ zIndex: 1000002 }}>
          <ShareSheet
            isOpen={showShareSheet}
            onClose={handleCloseShareSheet}
            imageUrl={shareImageUrl || ''}
            fileName={`gw${gw}-results.png`}
            gw={gw}
            userName={userName || user?.user_metadata?.display_name || user?.email || 'User'}
          />
        </div>
      )}
    </>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }

  return content;
}

