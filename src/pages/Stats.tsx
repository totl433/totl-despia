import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/profile/StatCard';
import { StreakStatCard } from '../components/profile/StreakStatCard';
import { TeamStatCard } from '../components/profile/TeamStatCard';
import { ParChart } from '../components/profile/ParChart';
import { fetchUserStats, type UserStatsData } from '../services/userStats';
import LiveGamesToggle from '../components/LiveGamesToggle';

export default function Stats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showParChartInfo, setShowParChartInfo] = useState(false);

  useEffect(() => {
    if (user) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  async function loadStats() {
    if (!user) return;

    setLoading(true);
    try {
      console.log('[Stats] Fetching user stats for user:', user.id);
      const userStats = await fetchUserStats(user.id);
      console.log('[Stats] Fetched stats:', userStats);
      setStats(userStats);
    } catch (error) {
      console.error('[Stats] Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
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
      <div className="max-w-4xl mx-auto p-6">
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
          <div className="space-y-6">
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
              
              // Calculate total swing (sum of all differences from average)
              const totalSwing = stats.weeklyParData.reduce((sum, d) => {
                return sum + (d.userPoints - d.averagePoints);
              }, 0);
              
              const swingText = totalSwing >= 0 
                ? `+${totalSwing.toFixed(1)}` 
                : totalSwing.toFixed(1);
              
              return (
              <div className="bg-white rounded-l-xl shadow-md" style={{ marginRight: '-100vw', paddingRight: '100vw', paddingTop: '1.5rem', paddingBottom: '1.5rem', paddingLeft: '1.5rem' }}>
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
      </div>
    </div>
  );
}

