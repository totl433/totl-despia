import { useState, useEffect } from 'react';
import TeamBadge from './TeamBadge';
import type { Fixture, LiveScore } from './FixtureCard';
import { getMediumName } from '../lib/teamNames';

export interface GameweekFixturesCardListProps {
  gw: number;
  fixtures: Fixture[];
  picks?: Record<number, "H" | "D" | "A">; // Map of fixture_index -> pick
  liveScores?: Map<number, LiveScore>; // Map of fixture_index -> liveScore
  className?: string;
  userName?: string;
  globalRank?: number; // User's global ranking
}

/**
 * Gameweek Card showing all fixtures for a gameweek in a list format
 * Alternative to the grid version
 */
export default function GameweekFixturesCardList({
  gw,
  fixtures,
  picks = {},
  liveScores = new Map(),
  className = '',
  userName = 'Phil Bolton',
  globalRank,
}: GameweekFixturesCardListProps) {
  // Detect screen size for badge sizing
  const [badgeSize, setBadgeSize] = useState(24);
  
  useEffect(() => {
    // Large mobile: 375px to 767px (between small mobile and tablet)
    // This covers Storybook's "large mobile" viewport
    const checkSize = () => {
      const width = window.innerWidth;
      // Large mobile range
      if (width >= 375 && width < 768) {
        setBadgeSize(22);
      } else {
        setBadgeSize(24);
      }
    };
    
    // Set initial value
    checkSize();
    
    // Listen for resize
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Sort fixtures by fixture_index
  const sortedFixtures = [...fixtures].sort((a, b) => a.fixture_index - b.fixture_index);

  // Calculate user's score
  const calculateScore = () => {
    let score = 0;
    let liveCount = 0;
    let totalFixturesWithPicks = 0;
    let allFinished = true;
    let hasAnyActive = false;

    sortedFixtures.forEach((fixture) => {
      const pick = picks[fixture.fixture_index];
      const liveScore = liveScores.get(fixture.fixture_index);

      if (pick) {
        totalFixturesWithPicks++;
      }

      if (liveScore) {
        const isLive = liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED';
        const isFinished = liveScore.status === 'FINISHED';

        if (isLive || isFinished) {
          hasAnyActive = true;
          if (isLive) liveCount++;
          if (!isFinished) allFinished = false;

          if (pick) {
            let isCorrect = false;
            const result = (liveScore as any).result;
            if (result) {
              isCorrect = result === pick;
            } else {
              isCorrect =
                (pick === 'H' && liveScore.homeScore > liveScore.awayScore) ||
                (pick === 'A' && liveScore.awayScore > liveScore.homeScore) ||
                (pick === 'D' && liveScore.homeScore === liveScore.awayScore);
            }
            if (isCorrect) score++;
          }
        } else {
          allFinished = false;
        }
      } else {
        allFinished = false;
      }
    });

    return { score, liveCount, allFinished, hasAnyActive, totalFixturesWithPicks };
  };

  const { score, liveCount, allFinished, hasAnyActive, totalFixturesWithPicks } = calculateScore();

  // Truncate username if longer than 18 characters
  const displayUserName = userName.length > 18 ? userName.substring(0, 18) + '...' : userName;

  return (
    <>
      <style>{`
        @keyframes pulse-emerald-shadow {
          0%, 100% {
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 0 rgba(16, 185, 129, 0.5);
          }
          50% {
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 20px 5px rgba(16, 185, 129, 0.5);
          }
        }
        .pulse-emerald-safe {
          animation: pulse-emerald-shadow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          opacity: 1 !important;
        }
        .team-name-small-mobile {
          display: inline;
        }
        @media (max-width: 359px) {
          .team-name-small-mobile {
            display: none;
          }
        }
        .username-responsive {
          font-size: 0.875rem; /* text-sm - 14px */
        }
        @media (min-width: 360px) {
          .username-responsive {
            font-size: 1.125rem; /* text-lg - 18px */
          }
        }
        @media (min-width: 640px) {
          .username-responsive {
            font-size: 1.5rem; /* text-2xl - 24px */
          }
        }
      `}</style>
      <div className={`bg-white rounded-3xl shadow-xl p-2 sm:p-4 w-full max-w-[600px] mx-auto flex flex-col ${className}`}>
      {/* Header */}
      <div className="mb-2 sm:mb-3 flex items-center justify-between flex-shrink-0 py-2 sm:py-3 px-1 sm:px-0">
        {/* Score pill - left */}
        {hasAnyActive && (
          <div className={`inline-flex items-center gap-0.5 sm:gap-1 px-2.5 py-1 sm:px-2 sm:py-1 rounded-full text-white flex-shrink-0 ${allFinished ? 'bg-slate-600' : 'bg-red-600'}`} style={{ transform: 'scale(1)', transformOrigin: 'left center' }}>
            {!allFinished && liveCount > 0 && (
              <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 bg-white rounded-full animate-pulse"></div>
            )}
            {allFinished && (
              <svg className="w-3 h-3 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            )}
            <span className="hidden sm:inline text-[9px] sm:text-xs font-medium opacity-90">{allFinished ? 'Score' : 'Live'}</span>
            <span className="flex items-baseline gap-0.5">
              <span className="text-sm sm:text-base font-extrabold">{score}</span>
              <span className="text-[10px] sm:text-xs font-medium opacity-90">/</span>
              <span className="text-xs sm:text-sm font-semibold opacity-80">{totalFixturesWithPicks}</span>
            </span>
          </div>
        )}
        {!hasAnyActive && <div></div>}
        {/* Name - centered */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="username-responsive font-bold text-slate-700 truncate leading-tight">{displayUserName}</div>
          {globalRank !== undefined && (
            <div className="text-[10px] sm:text-xs font-bold text-slate-500 -mt-1">
              #{globalRank}
            </div>
          )}
        </div>
        {/* Gameweek - right */}
        <div className="text-xs sm:text-sm font-medium text-[#1C8376] whitespace-nowrap flex-shrink-0 pr-2 sm:pr-0">GW {gw}</div>
      </div>

      {/* Fixtures list */}
      <div className="flex-1 overflow-y-auto px-1 sm:px-0">
        {sortedFixtures.map((fixture, index) => {
          const pick = picks[fixture.fixture_index];
          const liveScore = liveScores.get(fixture.fixture_index);
          const hasLiveScore = !!liveScore;
          const isLive = hasLiveScore && liveScore.status === 'IN_PLAY';
          const isHalfTime = hasLiveScore && (liveScore.status === 'PAUSED' || liveScore.status === 'HALF_TIME' || liveScore.status === 'HT');
          const isFinished = hasLiveScore && liveScore.status === 'FINISHED';
          const isOngoing = isLive || isHalfTime;
          const showScore = hasLiveScore && (isOngoing || isFinished);
          
          // Determine winning team for finished fixtures
          const homeIsWinning = isFinished && liveScore && liveScore.homeScore > liveScore.awayScore;
          const awayIsWinning = isFinished && liveScore && liveScore.awayScore > liveScore.homeScore;

          // Determine if pick is correct
          let pickCorrect: boolean | null = null;
          if (pick && liveScore) {
            const result = (liveScore as any).result;
            if (result) {
              pickCorrect = result === pick;
            } else {
              pickCorrect =
                (pick === 'H' && liveScore.homeScore > liveScore.awayScore) ||
                (pick === 'A' && liveScore.awayScore > liveScore.homeScore) ||
                (pick === 'D' && liveScore.homeScore === liveScore.awayScore);
            }
          }

          const formatMinute = () => {
            if (isFinished) return 'FT';
            if (isHalfTime) return 'HT';
            if (isLive && liveScore?.minute !== null && liveScore?.minute !== undefined) {
              return `${liveScore.minute}'`;
            }
            return 'LIVE';
          };

          return (
            <div
              key={fixture.id || `${fixture.gw}-${fixture.fixture_index}`}
              className={`py-1 sm:py-2 relative ${index > 0 ? 'border-t border-slate-200' : ''}`}
            >
              {/* Table-like structure for perfect alignment */}
              <div className="flex items-center justify-between" style={{ height: '32px' }}>
                {/* FT/Time indicator - far left */}
                <div className="flex-shrink-0 pr-2" style={{ width: '30px', height: '32px', display: 'flex', alignItems: 'center' }}>
                  {showScore ? (
                    isOngoing ? (
                      <div className="bg-red-500 rounded-full flex items-center justify-center animate-pulse" style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px' }}>
                        <span className="text-[10px] font-semibold text-white leading-none">
                          {formatMinute()}
                        </span>
                      </div>
                    ) : (
                      <span className={`text-[10px] font-semibold ${isOngoing ? 'text-red-600' : 'text-slate-500'}`}>
                        {formatMinute()}
                      </span>
                    )
                  ) : (
                    <span></span>
                  )}
                </div>

                {/* Home team - right aligned */}
                <div className="flex-1 flex items-center justify-end gap-0.5 pr-0.5" style={{ height: '32px' }}>
                  <span className={`team-name-small-mobile text-xs text-slate-700 truncate ${homeIsWinning ? 'font-bold' : 'font-medium'}`}>
                    {getMediumName(fixture.home_code || fixture.home_team || fixture.home_name || '') || fixture.home_name || fixture.home_team}
                  </span>
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: `${badgeSize}px`, height: `${badgeSize}px` }}>
                    <TeamBadge code={fixture.home_code} size={badgeSize} />
                  </div>
                </div>

                {/* Score or VS - centered between badges */}
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: '35px', height: '32px' }}>
                  {showScore ? (
                    <div className="flex items-center gap-1 leading-none">
                      <span className="text-sm font-bold text-slate-900 leading-none">
                        {liveScore!.homeScore}
                      </span>
                      <span className="text-sm font-bold text-slate-900 leading-none">-</span>
                      <span className="text-sm font-bold text-slate-900 leading-none">
                        {liveScore!.awayScore}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">vs</span>
                  )}
                </div>

                {/* Away team - left aligned */}
                <div className="flex-1 flex items-center justify-start gap-0.5 pl-0.5" style={{ height: '32px' }}>
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: `${badgeSize}px`, height: `${badgeSize}px` }}>
                    <TeamBadge code={fixture.away_code} size={badgeSize} />
                  </div>
                  <span className={`team-name-small-mobile text-xs text-slate-700 truncate ${awayIsWinning ? 'font-bold' : 'font-medium'}`}>
                    {getMediumName(fixture.away_code || fixture.away_team || fixture.away_name || '') || fixture.away_name || fixture.away_team}
                  </span>
                </div>

                {/* Prediction pill - fixed width column */}
                {pick && (
                  <div className="flex items-center justify-center ml-2" style={{ width: '80px', height: '32px', flexShrink: 0 }}>
                    <span
                      className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-extrabold whitespace-nowrap ${
                        pickCorrect === true && isFinished
                          ? 'bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]'
                          : pickCorrect === true && !isFinished
                          ? 'bg-emerald-600 text-white pulse-emerald-safe shadow-lg'
                          : pickCorrect === false && isFinished
                          ? 'bg-slate-400 text-white shadow-lg'
                          : 'bg-emerald-600 text-white shadow-lg'
                      }`}
                      style={{ opacity: 1, width: '100%' }}
                    >
                      <span className={`relative z-10 ${pickCorrect === false && isFinished ? 'line-through decoration-2 decoration-white' : ''}`}>
                        {pick === 'H' ? 'Home Win' : pick === 'A' ? 'Away Win' : 'Draw'}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {fixtures.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <p className="text-sm">No fixtures available</p>
        </div>
      )}
    </div>
    </>
  );
}

