import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/profile/StatCard';
import { StreakStatCard } from '../components/profile/StreakStatCard';
import { TeamStatCard } from '../components/profile/TeamStatCard';
import { ParChart } from '../components/profile/ParChart';
import { TrophyCabinet } from '../components/profile/TrophyCabinet';
import { fetchUserStats, type UserStatsData } from '../services/userStats';
import LiveGamesToggle from '../components/LiveGamesToggle';
import UnicornCollection from '../components/profile/UnicornCollection';
import { useGameweekState } from '../hooks/useGameweekState';
import { supabase } from '../lib/supabase';
import GameweekResultsModal from '../components/GameweekResultsModal';

export default function Stats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showParChartInfo, setShowParChartInfo] = useState(false);
  const [currentGw, setCurrentGw] = useState<number | null>(null);
  const lastUpdatedGwRef = useRef<number | null>(null); // Track which GW we last updated stats for
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [resultsModalGw, setResultsModalGw] = useState<number | null>(null);
  const [latestGw, setLatestGw] = useState<number | null>(null);
  const [resultsModalLoading, setResultsModalLoading] = useState(false);
  
  async function loadStats() {
    if (!user) return;

    setLoading(true);
    try {
      const userStats = await fetchUserStats(user.id);
      setStats(userStats);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }
  
  // Get current GW from app_meta
  useEffect(() => {
    let alive = true;
    
    const fetchCurrentGw = async () => {
      const { data: meta } = await supabase
        .from("app_meta")
        .select("current_gw")
        .eq("id", 1)
        .maybeSingle();
      
      if (alive && meta) {
        const gw: number | null = (meta as any)?.current_gw ?? null;
        setCurrentGw(gw);
      }
    };
    
    fetchCurrentGw();
    
    // Subscribe to app_meta changes
    const channel = supabase
      .channel('stats-app-meta')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_meta',
        },
        () => {
          fetchCurrentGw();
        }
      )
      .subscribe();
    
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);
  
  // Get game state for current GW
  const { state: currentGwState } = useGameweekState(currentGw, user?.id);
  
  // Get game state for last completed GW (for results box)
  const { state: lastGwState } = useGameweekState(stats?.lastCompletedGw ?? null, user?.id);
  
  // Get latest GW for results modal
  useEffect(() => {
    let alive = true;
    
    const fetchLatestGw = async () => {
      const { data: meta } = await supabase
        .from("app_meta")
        .select("current_gw")
        .eq("id", 1)
        .maybeSingle();
      
      if (alive && meta) {
        const gw: number | null = (meta as any)?.current_gw ?? null;
        setLatestGw(gw);
      }
    };
    
    fetchLatestGw();
    
    return () => { alive = false; };
  }, []);
  
  // Initial load
  useEffect(() => {
    if (user) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [user]);
  
  // Determine which GW to show stats for based on game state (duplicate removed)
  // GW_OPEN/GW_PREDICTED: Show previous GW (lastCompletedGw) - already handled by fetchUserStats
  // LIVE: Show static stats (don't update)
  // RESULTS_PRE_GW: Show updated stats for completed GW (update once when it finishes)
  useEffect(() => {
    if (!user || !currentGw || currentGwState === null) {
      return;
    }
    
    let alive = true;
    
    const shouldRefreshStats = async () => {
      // In LIVE state, don't refresh (show static stats)
      if (currentGwState === 'LIVE') {
        // Stats should already be loaded from initial load
        return;
      }
      
      // In RESULTS_PRE_GW, check if we need to update stats for the completed GW
      if (currentGwState === 'RESULTS_PRE_GW') {
        // Get the last completed GW
        const { data: lastGwData } = await supabase
          .from('app_gw_results')
          .select('gw')
          .order('gw', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const lastCompletedGw = lastGwData?.gw || null;
        
        // Only refresh if this is a new completed GW we haven't updated for yet
        if (lastCompletedGw && lastCompletedGw !== lastUpdatedGwRef.current) {
          lastUpdatedGwRef.current = lastCompletedGw;
          if (alive) {
            loadStats();
          }
        }
        return;
      }
      
      // In GW_OPEN or GW_PREDICTED, show previous GW stats
      // Stats should already be loaded from initial load
      // No need to refresh unless we haven't loaded yet
    };
    
    shouldRefreshStats();
    
    return () => { alive = false; };
  }, [user, currentGw, currentGwState]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl lg:max-w-[1024px] mx-auto px-4 lg:px-6">
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <p className="text-slate-600">Please sign in to view your stats.</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has enough data
  const hasEnoughData = stats && (stats.lastCompletedGw !== null || stats.overallPercentile !== null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 overflow-x-hidden">
      <style>{`
        @keyframes sparkle {
          0%, 100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
          25% {
            opacity: 0.9;
            transform: scale(1.05) rotate(-3deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.1) rotate(3deg);
          }
          75% {
            opacity: 0.9;
            transform: scale(1.05) rotate(-3deg);
          }
        }
        .sparkle-trophy {
          animation: sparkle 2s ease-in-out infinite;
          filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6));
        }
        @media (min-width: 1024px) {
          .desktop-constrained-section {
            margin-right: 0 !important;
            padding-right: 1.5rem !important;
          }
          .desktop-constrained-unicorn {
            margin-right: 0 !important;
            padding-right: 1.5rem !important;
          }
          .unicorn-scroll-container {
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
      <div className="max-w-4xl lg:max-w-[1024px] mx-auto px-4 lg:px-6 py-6">
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span>Back to Profile</span>
        </Link>
        <PageHeader title="Stats" as="h1" className="mb-6" />

        {/* Gameweek Results Box - Show when results are available */}
        {stats && stats.lastCompletedGw !== null && (() => {
          const hasResults = lastGwState !== 'LIVE' && 
            lastGwState !== 'GW_OPEN' && 
            lastGwState !== 'GW_PREDICTED';
          
          if (!hasResults) return null;
          
          return (
            <button
              onClick={async () => {
                const gw = stats.lastCompletedGw;
                if (!gw) return;
                
                setResultsModalLoading(true);
                setResultsModalGw(gw);
                
                // Fetch data first, then open modal
                try {
                  const { fetchGwResults } = await import('../lib/fetchGwResults');
                  if (user?.id) {
                    await fetchGwResults(user.id, gw);
                    // Data is ready, now open modal
                    setShowResultsModal(true);
                  }
                } catch (error) {
                  // Error handled by modal
                } finally {
                  setResultsModalLoading(false);
                }
              }}
              className="w-full mb-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed"
              disabled={resultsModalLoading}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg whitespace-nowrap">Your Gameweek {stats.lastCompletedGw} Results</span>
                {resultsModalLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white flex-shrink-0 ml-2"></div>
                ) : (
                  <svg
                    className="w-5 h-5 flex-shrink-0 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })()}

        {!hasEnoughData && !loading ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <p className="text-slate-600 text-lg">
              Not enough games yet — check back after a few Gameweeks.
            </p>
            <p className="text-slate-500 text-sm mt-2">
              The numbers will start to tell a story soon.
            </p>
          </div>
        ) : (
          <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
            {/* 1. Last completed Gameweek percentile */}
            {stats && stats.lastCompletedGw !== null && stats.lastCompletedGwPercentile !== null && (() => {
              const percentile = stats.lastCompletedGwPercentile;
              const topPercent = Math.round(100 - percentile);
              const bottomPercent = Math.round(percentile);
              const isTop = percentile >= 75;
              
              return (
                <StatCard
                  label={`Gameweek ${stats.lastCompletedGw}`}
                  value={
                    isTop
                      ? `You were in the top ${topPercent}% of players.`
                      : `You were in the bottom ${bottomPercent}% of players.`
                  }
                  loading={loading}
                />
              );
            })()}

            {/* 2. Overall leaderboard percentile */}
            {stats && stats.overallPercentile !== null && (() => {
              const percentile = stats.overallPercentile;
              const topPercent = Math.round(100 - percentile);
              const bottomPercent = Math.round(percentile);
              const isTop = percentile >= 75;
              
              return (
                <StatCard
                  label="Overall"
                  value={
                    isTop
                      ? `You're in the top ${topPercent}% of players.`
                      : `You're in the bottom ${bottomPercent}% of players.`
                  }
                  loading={loading}
                />
              );
            })()}

            {/* 3. Most correctly predicted team */}
            {stats && stats.mostCorrectTeam && (
              <TeamStatCard
                label="Most correctly predicted team"
                teamCode={stats.mostCorrectTeam.code}
                teamName={stats.mostCorrectTeam.name}
                percentage={stats.mostCorrectTeam.percentage}
                isCorrect={true}
                loading={loading}
              />
            )}

            {/* 5. Most incorrectly picked team */}
            {stats && stats.mostIncorrectTeam && (
              <TeamStatCard
                label="Most incorrectly picked team"
                teamCode={stats.mostIncorrectTeam.code}
                teamName={stats.mostIncorrectTeam.name}
                percentage={stats.mostIncorrectTeam.percentage}
                isCorrect={false}
                loading={loading}
              />
            )}

            {/* 6. Correct prediction rate */}
            {stats && stats.correctPredictionRate !== null && (
              <StatCard
                label="Correct prediction rate"
                value={`${stats.correctPredictionRate.toFixed(2)}%`}
                loading={loading}
              />
            )}

            {/* Trophy Cabinet */}
            {stats && stats.trophyCabinet !== null && (
              <div className="lg:col-span-2">
                <TrophyCabinet
                lastGw={stats.trophyCabinet.lastGw}
                form5={stats.trophyCabinet.form5}
                form10={stats.trophyCabinet.form10}
                overall={stats.trophyCabinet.overall}
                loading={loading}
              />
              </div>
            )}

            {/* Unicorn Collection */}
            {user && (
              <div className="lg:col-span-2 lg:overflow-hidden lg:rounded-xl">
                <UnicornCollection userId={user.id} loading={loading} />
              </div>
            )}

            {/* 6. Chaos Index */}
            {stats && stats.chaosIndex !== null && (
              <StatCard
                label="Chaos Index"
                value={`${stats.chaosIndex.toFixed(2)}%`}
                subcopy="How often you pick an outcome that 25% or fewer players picked"
                loading={loading}
              />
            )}

            {/* 6b. Chaos Index Success Rate */}
            {stats && stats.chaosTotalCount !== null && stats.chaosTotalCount > 0 && stats.chaosCorrectCount !== null && (
              <StatCard
                label="Chaos Index Success Rate"
                value={`${((stats.chaosCorrectCount / stats.chaosTotalCount) * 100).toFixed(2)}%`}
                subcopy="How often you're right when you pick an outcome that 25% or fewer players picked"
                loading={loading}
              />
            )}

            {/* 6c. Weekly Par Chart */}
            {stats && stats.weeklyParData && stats.weeklyParData.length > 0 && stats.lastCompletedGw && (() => {
              const aboveAverageCount = stats.weeklyParData.filter(d => d.userPoints > d.averagePoints).length;
              const aboveAveragePercent = ((aboveAverageCount / stats.weeklyParData.length) * 100).toFixed(0);
              
              return (
              <div className="lg:col-span-2 desktop-constrained-section bg-white rounded-l-xl lg:rounded-xl shadow-md lg:overflow-hidden" style={{ marginRight: '-100vw', paddingRight: '100vw', paddingTop: '1.5rem', paddingBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-600">
                    Weekly Performance vs Average
                  </div>
                  <div className="pr-2">
                    <LiveGamesToggle 
                      value={showParChartInfo} 
                      onChange={setShowParChartInfo}
                      labels={{ on: 'Complex', off: 'Simple' }}
                    />
                  </div>
                </div>
                <div 
                  className="overflow-x-auto scrollbar-hide" 
                  style={{ 
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none', 
                    WebkitOverflowScrolling: 'touch', 
                    overscrollBehaviorX: 'contain',
                    overscrollBehaviorY: 'auto',
                    touchAction: 'pan-x',
                    marginLeft: '-1.5rem',
                    marginRight: '-1.5rem',
                    paddingLeft: '1.5rem',
                    paddingRight: '1.5rem',
                    width: 'calc(100% + 3rem)',
                  }}
                >
                  <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
                  <ParChart
                    weeklyData={stats.weeklyParData}
                    latestGw={stats.lastCompletedGw}
                    showInfo={showParChartInfo}
                  />
                </div>
                <div className="text-sm font-bold text-slate-700 mt-2">
                  You perform above average {aboveAveragePercent}% of the time.
                </div>
              </div>
              );
            })()}
            
            {/* Total Swing Stat Card */}
            {stats && stats.weeklyParData && stats.weeklyParData.length > 0 && (() => {
              const totalSwing = stats.weeklyParData.reduce((sum, d) => {
                return sum + (d.userPoints - d.averagePoints);
              }, 0);
              
              const swingText = totalSwing >= 0 
                ? `+${totalSwing.toFixed(1)}` 
                : totalSwing.toFixed(1);
              
              if (swingText === '0.0') return null;
              
              return (
                <StatCard
                  label="Total Swing"
                  value={swingText}
                  subcopy="Your total points difference from the average across all gameweeks"
                  loading={loading}
                />
              );
            })()}

            {/* 7. Best Streak (Top 25%) */}
            {stats && stats.bestStreak > 0 && stats.bestStreakGwRange && (
              <StreakStatCard
                label="Most consecutive weeks in the top 25%"
                streakCount={stats.bestStreak}
                gwRange={stats.bestStreakGwRange}
                loading={loading}
              />
            )}

            {/* 8. Average points per week */}
            {stats && stats.avgPointsPerWeek !== null && (
              <StatCard
                label="Avg points / week"
                value={stats.avgPointsPerWeek.toFixed(2)}
                loading={loading}
              />
            )}

            {/* 9. Best single GW */}
            {stats && stats.bestSingleGw && (
              <StatCard
                label="Best single Gameweek"
                value={
                  <span>
                    <span className="text-2xl font-bold text-slate-800">{stats.bestSingleGw.points}</span>
                    <span className="text-sm text-slate-600 ml-2">on GW{stats.bestSingleGw.gw}</span>
                  </span>
                }
                loading={loading}
              />
            )}

            {/* 10. Lowest single GW */}
            {stats && stats.lowestSingleGw && (
              <StatCard
                label="Lowest single Gameweek"
                value={
                  <span>
                    <span className="text-2xl font-bold text-slate-800">{stats.lowestSingleGw.points}</span>
                    <span className="text-sm text-slate-600 ml-2">on GW{stats.lowestSingleGw.gw}</span>
                  </span>
                }
                loading={loading}
              />
            )}
          </div>
        )}

        {/* GameweekResultsModal */}
        {showResultsModal && resultsModalGw && (
          <GameweekResultsModal
            isOpen={showResultsModal}
            onClose={() => {
              setShowResultsModal(false);
              setResultsModalGw(null);
              setResultsModalLoading(false);
            }}
            gw={resultsModalGw}
            nextGw={latestGw && latestGw > resultsModalGw ? latestGw : null}
            onLoadingChange={(loading) => {
              setResultsModalLoading(loading);
            }}
          />
        )}
      </div>
    </div>
  );
}

