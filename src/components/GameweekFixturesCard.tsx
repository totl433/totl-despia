import React, { useRef, useEffect, useState } from 'react';
import TeamBadge from './TeamBadge';
import type { Fixture, LiveScore } from './FixtureCard';

// Team colors for fallback
const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  ARS: { primary: "#EF0107", secondary: "#023474" },
  AVL: { primary: "#95BFE5", secondary: "#670E36" },
  BOU: { primary: "#DA291C", secondary: "#000000" },
  BRE: { primary: "#E30613", secondary: "#FBB800" },
  BHA: { primary: "#0057B8", secondary: "#FFCD00" },
  CHE: { primary: "#034694", secondary: "#034694" },
  CRY: { primary: "#1B458F", secondary: "#C4122E" },
  EVE: { primary: "#003399", secondary: "#003399" },
  FUL: { primary: "#FFFFFF", secondary: "#000000" },
  LIV: { primary: "#C8102E", secondary: "#00B2A9" },
  MCI: { primary: "#6CABDD", secondary: "#1C2C5B" },
  MUN: { primary: "#DA291C", secondary: "#FBE122" },
  NEW: { primary: "#241F20", secondary: "#FFFFFF" },
  NFO: { primary: "#DD0000", secondary: "#FFFFFF" },
  TOT: { primary: "#132257", secondary: "#FFFFFF" },
  WHU: { primary: "#7A263A", secondary: "#1BB1E7" },
  WOL: { primary: "#FDB913", secondary: "#231F20" },
  SUN: { primary: "#EB172B", secondary: "#211E1F" },
  LEE: { primary: "#FFCD00", secondary: "#1D428A" },
};

// Teams that have striped patterns (not solid colors)
const STRIPED_TEAMS: Set<string> = new Set([
  'BOU', // bournemouth
  'BRE', // brentford
  'BHA', // brighton
  'CRY', // crystal-palace
  'NEW', // newcastle
  'SUN', // sunderland
]);

// Kit colors for striped teams
const STRIPED_TEAM_COLORS: Record<string, string> = {
  'BOU': '#DA291C', // bournemouth - red (not black)
  'BRE': '#E30613', // brentford - red (not white)
  'BHA': '#0057B8', // brighton - blue (not white)
  'CRY': '#1B458F', // crystal-palace - blue (exception: use blue not red)
  'NEW': '#241F20', // newcastle - black (fallback when away)
  'SUN': '#E03A3E', // sunderland - red (not white)
};

// Helper function to get pattern file path from team code
function getTeamPatternPath(code: string | null | undefined): string | null {
  if (!code) return null;
  
  const codeToPattern: Record<string, string> = {
    'ARS': 'arsenal',
    'AVL': 'aston-villa',
    'BOU': 'bournemouth',
    'BRE': 'brentford',
    'BHA': 'brighton',
    'BUR': 'burnley',
    'CHE': 'chelsea',
    'CRY': 'crystal-palace',
    'EVE': 'everton',
    'FUL': 'fulham',
    'LEE': 'leeds',
    'LIV': 'liverpool',
    'MCI': 'man-city',
    'MUN': 'man-united',
    'NEW': 'newcastle',
    'NFO': 'nottingham-forest',
    'NOT': 'nottingham-forest',
    'TOT': 'spurs',
    'SUN': 'sunderland',
    'WHU': 'west-ham',
    'WOL': 'wolves',
  };
  
  const patternName = codeToPattern[code.toUpperCase()];
  return patternName ? `/assets/patterns/${patternName}.svg` : null;
}

// Check if a team has stripes
function hasStripes(code: string | null | undefined): boolean {
  if (!code) return false;
  return STRIPED_TEAMS.has(code.toUpperCase());
}

// Get solid color for striped team (for when both teams have stripes)
function getStripedTeamColor(code: string | null | undefined): string | null {
  if (!code) return null;
  return STRIPED_TEAM_COLORS[code.toUpperCase()] || null;
}

export interface MiniFixtureCardProps {
  fixture: Fixture;
  pick?: "H" | "D" | "A";
  liveScore?: LiveScore | null;
}

/**
 * Mini fixture card - compact version for displaying multiple fixtures
 */
export const MiniFixtureCard: React.FC<MiniFixtureCardProps> = ({
  fixture: f,
  pick,
  liveScore,
}) => {

  // Game state flags
  const hasLiveScore = !!liveScore;
  const isLive = hasLiveScore && liveScore.status === 'IN_PLAY';
  const isHalfTime = hasLiveScore && (liveScore.status === 'PAUSED' || liveScore.status === 'HALF_TIME' || liveScore.status === 'HT');
  const isFinished = hasLiveScore && liveScore.status === 'FINISHED';
  const isOngoing = isLive || isHalfTime;
  
  const showScore = hasLiveScore && (isOngoing || isFinished);
  const showLiveIndicator = isLive || isHalfTime;

  // Determine if pick is correct
  const getPickCorrectness = () => {
    if (!pick || !liveScore) return null;
    const result = (liveScore as any).result;
    if (result) {
      return result === pick;
    }
    // Use score comparison
    if (pick === 'H' && liveScore.homeScore > liveScore.awayScore) return true;
    if (pick === 'A' && liveScore.awayScore > liveScore.homeScore) return true;
    if (pick === 'D' && liveScore.homeScore === liveScore.awayScore) return true;
    return false;
  };

  const pickCorrect = getPickCorrectness();
  const hasPick = !!pick;

  // Format minute display
  const formatMinute = () => {
    if (isFinished) return 'FT';
    if (isHalfTime) return 'HT';
    if (isLive && liveScore?.minute !== null && liveScore?.minute !== undefined) {
      return `${liveScore.minute}'`;
    }
    return 'LIVE';
  };

  // Pattern logic (similar to SwipeCard)
  const homePatternPath = getTeamPatternPath(f.home_code);
  const awayPatternPath = getTeamPatternPath(f.away_code);
  const homeHasStripes = hasStripes(f.home_code);
  const awayHasStripes = hasStripes(f.away_code);
  const bothHaveStripes = homeHasStripes && awayHasStripes;
  const awaySolidColor = bothHaveStripes ? getStripedTeamColor(f.away_code) : null;
  const finalAwayPatternPath = bothHaveStripes ? null : awayPatternPath;
  
  // Get team colors
  const homeColor = TEAM_COLORS[f.home_code?.toUpperCase() || '']?.primary || "#EF0107";
  const awayColor = TEAM_COLORS[f.away_code?.toUpperCase() || '']?.primary || "#034694";

  // Ref for pattern container
  const patternRef = useRef<HTMLDivElement>(null);
  const [diagonalAngle, setDiagonalAngle] = useState(45);
  const minuteTextRef = useRef<HTMLSpanElement>(null);

  // Calculate diagonal angle
  useEffect(() => {
    const updateAngle = () => {
      if (patternRef.current) {
        const { width, height } = patternRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          const angle = Math.atan2(height, width) * (180 / Math.PI);
          setDiagonalAngle(angle);
        }
      }
    };
    
    updateAngle();
    window.addEventListener('resize', updateAngle);
    
    if (patternRef.current) {
      const resizeObserver = new ResizeObserver(updateAngle);
      resizeObserver.observe(patternRef.current);
      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', updateAngle);
      };
    }
    
    return () => {
      window.removeEventListener('resize', updateAngle);
    };
  }, []);

  const homeAngle = homeHasStripes ? 35 : diagonalAngle;
  const awayAngle = awayHasStripes ? 35 : (diagonalAngle + 45);

  const cardRef = useRef<HTMLDivElement>(null);


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
        .score-spacing {
          margin-left: -12px;
          margin-right: -12px;
        }
        @media (min-width: 640px) {
          .score-spacing {
            margin-left: -32px;
            margin-right: -32px;
          }
        }
      `}</style>
      <div ref={cardRef} className="relative bg-white rounded-lg border border-slate-200 flex flex-col overflow-hidden h-[85px] sm:h-[90px] w-full" style={{ boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.1)' }}>
      {/* Live indicator */}
      {showLiveIndicator && (
        <div className="absolute z-20" style={{ top: '6px', left: '6px' }}>
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full animate-pulse"></div>
        </div>
      )}

      {/* Top section - Teams and Score */}
      <div className="flex items-center justify-center gap-0 w-full h-[40px] flex-shrink-0 relative z-10 bg-white">
                  {/* Home team */}
                  <div className="flex flex-col items-center justify-center flex-1 min-w-0 h-full py-2">
                    <div className="w-[32px] h-[32px] sm:w-[44px] sm:h-[44px] md:w-[48px] md:h-[48px] flex items-center justify-center">
                      <TeamBadge code={f.home_code} size={32} className="sm:w-[44px] sm:h-[44px] md:w-[48px] md:h-[48px] max-w-full max-h-full" />
                    </div>
                  </div>

        {/* Score */}
        {showScore ? (
          <div className="score-spacing flex flex-col items-center justify-center flex-shrink-0 h-full leading-tight" style={{ paddingTop: '2px' }}>
            <div className="flex items-center gap-0.5 leading-none">
              <span className="text-xs sm:text-sm font-bold text-slate-900 leading-none">
                {liveScore!.homeScore}
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-500 leading-none">-</span>
              <span className="text-xs sm:text-sm font-bold text-slate-900 leading-none">
                {liveScore!.awayScore}
              </span>
            </div>
            <span 
              ref={minuteTextRef}
              className={`font-semibold leading-none ${isOngoing ? 'text-red-600' : 'text-slate-500'}`}
              className="text-[10px]"
              style={{ marginTop: '2px' }}
            >
              {formatMinute()}
            </span>
          </div>
        ) : (
          <div className="score-spacing flex items-center justify-center flex-shrink-0 text-[9px] sm:text-[10px] text-slate-400 h-full" style={{ paddingTop: '2px' }}>vs</div>
        )}

                  {/* Away team */}
                  <div className="flex flex-col items-center justify-center flex-1 min-w-0 h-full py-2">
                    <div className="w-[32px] h-[32px] sm:w-[44px] sm:h-[44px] md:w-[48px] md:h-[48px] flex items-center justify-center">
                      <TeamBadge code={f.away_code} size={32} className="sm:w-[44px] sm:h-[44px] md:w-[48px] md:h-[48px] max-w-full max-h-full" />
                    </div>
                  </div>
      </div>

      {/* Bottom section - Patterns */}
      <div ref={patternRef} className="relative overflow-hidden flex-shrink-0 h-[45px] sm:h-[50px]" style={{ minHeight: '45px' }}>
        {/* Home pattern (left half) */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
            overflow: 'hidden',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: homePatternPath ? `url(${homePatternPath})` : undefined,
              backgroundColor: homePatternPath ? undefined : homeColor,
              backgroundSize: homePatternPath ? '20%' : undefined,
              backgroundRepeat: homePatternPath ? 'repeat' : undefined,
              backgroundPosition: '0 0',
              transform: homePatternPath ? `rotate(${homeAngle}deg)` : undefined,
              transformOrigin: 'center center',
              width: homePatternPath ? '500%' : '100%',
              height: homePatternPath ? '500%' : '100%',
              left: homePatternPath ? '-200%' : '0',
              top: homePatternPath ? '-200%' : '0',
              opacity: 1,
            }}
          />
        </div>
        
        {/* Away pattern (right half) */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
            overflow: 'hidden',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: finalAwayPatternPath ? `url(${finalAwayPatternPath})` : undefined,
              backgroundColor: awaySolidColor || (finalAwayPatternPath ? undefined : awayColor),
              backgroundSize: finalAwayPatternPath ? '20%' : undefined,
              backgroundRepeat: finalAwayPatternPath ? 'repeat' : undefined,
              backgroundPosition: '0 0',
              transform: finalAwayPatternPath ? `rotate(${awayAngle}deg)` : undefined,
              transformOrigin: 'center center',
              width: finalAwayPatternPath ? '500%' : '100%',
              height: finalAwayPatternPath ? '500%' : '100%',
              left: finalAwayPatternPath ? '-200%' : '0',
              top: finalAwayPatternPath ? '-200%' : '0',
              opacity: 1,
            }}
          />
        </div>

        {/* Prediction pill - on top of patterns */}
        {hasPick && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <span
              className={`inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-extrabold whitespace-nowrap border-2 border-white ${
                pickCorrect === true && isFinished
                  ? 'bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]'
                  : pickCorrect === true && !isFinished
                  ? 'bg-emerald-600 text-white pulse-emerald-safe shadow-lg'
                  : pickCorrect === false && isFinished
                  ? 'bg-slate-400 text-white shadow-lg'
                  : 'bg-emerald-600 text-white shadow-lg'
              }`}
              style={{ opacity: 1 }}
            >
              <span className={`relative z-10 ${pickCorrect === false && isFinished ? 'line-through decoration-2 decoration-white' : ''}`}>
                {pick === 'H' ? 'Home Win' : pick === 'A' ? 'Away Win' : 'Draw'}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export interface GameweekFixturesCardProps {
  gw: number;
  fixtures: Fixture[];
  picks?: Record<number, "H" | "D" | "A">; // Map of fixture_index -> pick
  liveScores?: Map<number, LiveScore>; // Map of fixture_index -> liveScore
  className?: string;
}

/**
 * Gameweek Card showing all fixtures for a gameweek
 * Can be slightly longer than a normal swipe card to fit ~10 fixtures
 */
export default function GameweekFixturesCard({
  gw,
  fixtures,
  picks = {},
  liveScores = new Map(),
  className = '',
}: GameweekFixturesCardProps) {
  // Sort fixtures by fixture_index
  const sortedFixtures = [...fixtures].sort((a, b) => a.fixture_index - b.fixture_index);

  // Calculate user's score (matching Home Page logic)
  const calculateScore = () => {
    let score = 0;
    let liveCount = 0;
    let finishedCount = 0;
    let allFinished = true;
    let hasAnyActive = false;
    
    sortedFixtures.forEach((fixture) => {
      const pick = picks[fixture.fixture_index];
      const liveScore = liveScores.get(fixture.fixture_index);
      const status = liveScore?.status;
      const isActive = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
      
      if (isActive) {
        hasAnyActive = true;
        if (status === 'IN_PLAY' || status === 'PAUSED') liveCount++;
        if (status === 'FINISHED') finishedCount++;
        if (status !== 'FINISHED') allFinished = false;
        
        if (pick && liveScore) {
          let isCorrect = false;
          if ((liveScore as any).result) {
            isCorrect = (liveScore as any).result === pick;
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
    });
    
    return { score, liveCount, allFinished, hasAnyActive };
  };

  const { score, liveCount, allFinished, hasAnyActive } = calculateScore();

  return (
    <div className={`bg-white rounded-3xl border-2 border-[#1C8376]/20 shadow-xl p-2 sm:p-4 w-full max-w-[600px] aspect-[3/4] mx-auto flex flex-col ${className}`}>
      {/* Header */}
      <div className="mb-2 sm:mb-3 flex items-center flex-shrink-0 py-2 sm:py-3 px-1 sm:px-0">
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
              <span className="text-xs sm:text-sm font-semibold opacity-80">{fixtures.length}</span>
            </span>
          </div>
        )}
        {/* Name - centered */}
        <div className="flex-1 text-center text-lg sm:text-2xl font-bold text-slate-700">Phil Bolton</div>
        {/* Gameweek - right */}
        <div className="text-xs sm:text-sm font-medium text-[#1C8376] whitespace-nowrap flex-shrink-0">GW {gw}</div>
      </div>

      {/* Fixtures grid */}
      <div className="grid grid-cols-2 gap-4 sm:gap-8 flex-1 overflow-y-auto px-1 sm:px-0">
        {sortedFixtures.map((fixture) => (
          <div key={fixture.id || `${fixture.gw}-${fixture.fixture_index}`} className="relative h-[85px] sm:h-[90px]">
            <MiniFixtureCard
              fixture={fixture}
              pick={picks[fixture.fixture_index]}
              liveScore={liveScores.get(fixture.fixture_index) || null}
            />
          </div>
        ))}
      </div>

      {/* Empty state */}
      {fixtures.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <p className="text-sm">No fixtures available</p>
        </div>
      )}
    </div>
  );
}

