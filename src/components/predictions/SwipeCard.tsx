import { useState, useEffect, useRef } from 'react';
import TeamBadge from '../TeamBadge';

export interface SwipeCardFixture {
  id: string;
  fixture_index: number;
  home_team: string;
  away_team: string;
  home_code?: string | null;
  away_code?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  home_crest?: string | null;
  away_crest?: string | null;
  kickoff_time?: string | null;
}

export interface SwipeCardProps {
  fixture: SwipeCardFixture;
  homeColor?: string;
  awayColor?: string;
  showSwipeHint?: boolean;
  homeForm?: string | null; // e.g., "WWLDW"
  awayForm?: string | null; // e.g., "LDWWL"
}

// Teams that have striped patterns (not solid colors)
const STRIPED_TEAMS: Set<string> = new Set([
  'BOU', // bournemouth
  'BRE', // brentford
  'BHA', // brighton
  'CRY', // crystal-palace
  'NEW', // newcastle
  'SUN', // sunderland
]);

// Kit colors for striped teams (the non-black/white color, except Palace uses blue, Newcastle uses black)
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

export default function SwipeCard({
  fixture,
  homeColor = "#EF0107",
  awayColor = "#034694",
  showSwipeHint = true,
  homeForm = null,
  awayForm = null,
}: SwipeCardProps) {
  const kickoffDate = fixture.kickoff_time
    ? new Date(fixture.kickoff_time).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : null;

  const kickoffTime = fixture.kickoff_time
    ? new Date(fixture.kickoff_time).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  // Helper function to render form dots
  const renderFormDots = (form: string | null | undefined) => {
    if (!form || form.length === 0) {
      // Show empty grey dots if no form data
      return Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-full bg-gray-300"
          style={{ pointerEvents: 'none' }}
        />
      ));
    }

    // Take last 5 characters (most recent 5 games)
    const lastFive = form.slice(-5).padStart(5, '?');
    
    return lastFive.split('').map((result, i) => {
      // Use brighter, more accessible colors with better contrast
      let color = 'bg-gray-300'; // Light grey for draw
      
      const upperResult = result.toUpperCase();
      if (upperResult === 'W') {
        color = 'bg-emerald-500'; // Lighter green for win (#22c55e)
      } else if (upperResult === 'L') {
        color = 'bg-red-600'; // Brighter red for loss (#dc2626)
      } else if (upperResult === 'D') {
        color = 'bg-gray-300'; // Light grey for draw (#d1d5db)
      }
      
      return (
        <div
          key={i}
          className={`w-3 h-3 rounded-full ${color} shadow-sm`}
          style={{ pointerEvents: 'none' }}
        />
      );
    });
  };

  const homePatternPath = getTeamPatternPath(fixture.home_code);
  const awayPatternPath = getTeamPatternPath(fixture.away_code);
  
  // Check if both teams have stripes - if so, use solid color for away team
  const homeHasStripes = hasStripes(fixture.home_code);
  const awayHasStripes = hasStripes(fixture.away_code);
  const bothHaveStripes = homeHasStripes && awayHasStripes;
  
  // If both have stripes, get solid color for away team, otherwise use pattern
  const awaySolidColor = bothHaveStripes ? getStripedTeamColor(fixture.away_code) : null;
  const finalAwayPatternPath = bothHaveStripes ? null : awayPatternPath;
  
  // Ref to measure container dimensions for dynamic angle calculation
  const containerRef = useRef<HTMLDivElement>(null);
  const [diagonalAngle, setDiagonalAngle] = useState(45); // Default to 45 degrees
  
  // Calculate diagonal angle based on container dimensions
  useEffect(() => {
    const updateAngle = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          // Calculate angle of diagonal from (0,0) to (width, height)
          // For polygon(0 0, 0 100%, 100% 100%) and polygon(0 0, 100% 0, 100% 100%)
          // Both diagonals go from top-left to bottom-right
          const angle = Math.atan2(height, width) * (180 / Math.PI);
          setDiagonalAngle(angle);
        }
      }
    };
    
    updateAngle();
    window.addEventListener('resize', updateAngle);
    
    // Use ResizeObserver for more accurate tracking
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(updateAngle);
      resizeObserver.observe(containerRef.current);
      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', updateAngle);
      };
    }
    
    return () => {
      window.removeEventListener('resize', updateAngle);
    };
  }, []);
  
  // Striped patterns use 35 degrees, non-striped patterns match the diagonal
  // Away pattern is offset by 45 degrees from home so they meet at 45°
  const homeAngle = homeHasStripes ? 35 : diagonalAngle;
  const awayAngle = awayHasStripes ? 35 : (diagonalAngle + 45);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden select-none flex flex-col" style={{ pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', width: '100%', height: '100%', position: 'relative' }}>
      <div className="pt-2 px-8 pb-8 relative flex-shrink-0 pointer-events-none" style={{ pointerEvents: 'none' }}>
        {showSwipeHint && (
          <div className="absolute top-2 right-4 flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-semibold pointer-events-none" style={{ pointerEvents: 'none' }}>
            <img
              src="https://cdn-icons-png.flaticon.com/512/4603/4603384.png"
              alt="Swipe gesture icon"
              className="w-6 h-6 opacity-80 pointer-events-none"
              style={{ pointerEvents: 'none' }}
            />
          </div>
        )}
        {/* Date and Time together */}
        {(kickoffDate || kickoffTime) && (
          <div className="text-center mb-6 pointer-events-none" style={{ pointerEvents: 'none' }}>
            <div className="text-sm text-slate-500 dark:text-slate-400 font-medium pointer-events-none" style={{ pointerEvents: 'none' }}>
              {kickoffDate}
              {kickoffDate && kickoffTime && <span className="mx-2 pointer-events-none" style={{ pointerEvents: 'none' }}>•</span>}
              {kickoffTime && <span className="text-slate-700 dark:text-slate-200 pointer-events-none" style={{ pointerEvents: 'none' }}>{kickoffTime}</span>}
            </div>
          </div>
        )}
        <div className="flex items-center justify-center gap-10 mb-4 relative pointer-events-none mt-6" style={{ pointerEvents: 'none' }}>
          <div className="flex flex-col items-center pointer-events-none" style={{ pointerEvents: 'none' }}>
            <div className="pointer-events-none" style={{ pointerEvents: 'none' }}>
              <TeamBadge
                code={fixture.home_code}
                crest={fixture.home_crest}
                size={120}
              />
            </div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-2 text-center max-w-[120px] pointer-events-none" style={{ pointerEvents: 'none' }}>
              {fixture.home_team || fixture.home_name}
            </div>
            {/* Form dots */}
            <div className="flex items-center gap-1.5 mt-3 pointer-events-none" style={{ pointerEvents: 'none' }}>
              {renderFormDots(homeForm)}
            </div>
          </div>
          <div className="flex flex-col items-center pointer-events-none" style={{ pointerEvents: 'none' }}>
            <div className="pointer-events-none" style={{ pointerEvents: 'none' }}>
              <TeamBadge
                code={fixture.away_code}
                crest={fixture.away_crest}
                size={120}
              />
            </div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-2 text-center max-w-[120px] pointer-events-none" style={{ pointerEvents: 'none' }}>
              {fixture.away_team || fixture.away_name}
            </div>
            {/* Form dots */}
            <div className="flex items-center gap-1.5 mt-3 pointer-events-none" style={{ pointerEvents: 'none' }}>
              {renderFormDots(awayForm)}
            </div>
          </div>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 relative overflow-hidden pointer-events-none min-h-[192px]" style={{ pointerEvents: 'none' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: homePatternPath ? `url(${homePatternPath})` : undefined,
              backgroundColor: homePatternPath ? undefined : homeColor,
              backgroundSize: homePatternPath ? '100%' : undefined,
              backgroundRepeat: homePatternPath ? 'no-repeat' : undefined,
              backgroundPosition: 'center',
              transform: homePatternPath ? `rotate(${homeAngle}deg)` : undefined,
              transformOrigin: 'center center',
              width: homePatternPath ? '200%' : '100%',
              height: homePatternPath ? '200%' : '100%',
              left: homePatternPath ? '-50%' : '0',
              top: homePatternPath ? '-50%' : '0',
              pointerEvents: 'none',
            }}
          />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: finalAwayPatternPath ? `url(${finalAwayPatternPath})` : undefined,
              backgroundColor: awaySolidColor || (finalAwayPatternPath ? undefined : awayColor),
              backgroundSize: finalAwayPatternPath ? '100%' : undefined,
              backgroundRepeat: finalAwayPatternPath ? 'no-repeat' : undefined,
              backgroundPosition: 'center',
              transform: finalAwayPatternPath ? `rotate(${awayAngle}deg)` : undefined,
              transformOrigin: 'center center',
              width: finalAwayPatternPath ? '200%' : '100%',
              height: finalAwayPatternPath ? '200%' : '100%',
              left: finalAwayPatternPath ? '-50%' : '0',
              top: finalAwayPatternPath ? '-50%' : '0',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}

