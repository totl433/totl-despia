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
        color = 'bg-green-500'; // Lighter green for win (#22c55e)
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

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden select-none flex flex-col" style={{ pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', width: '100%', height: '100%', position: 'relative' }}>
      <div className="pt-2 px-8 pb-8 relative flex-shrink-0 pointer-events-none" style={{ pointerEvents: 'none' }}>
        {showSwipeHint && (
          <div className="absolute top-2 right-4 flex items-center gap-2 text-slate-400 text-xs font-semibold pointer-events-none" style={{ pointerEvents: 'none' }}>
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
            <div className="text-sm text-slate-500 font-medium pointer-events-none" style={{ pointerEvents: 'none' }}>
              {kickoffDate}
              {kickoffDate && kickoffTime && <span className="mx-2 pointer-events-none" style={{ pointerEvents: 'none' }}>•</span>}
              {kickoffTime && <span className="text-slate-700 pointer-events-none" style={{ pointerEvents: 'none' }}>{kickoffTime}</span>}
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
            <div className="text-sm font-bold text-slate-700 mt-2 text-center max-w-[120px] pointer-events-none" style={{ pointerEvents: 'none' }}>
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
            <div className="text-sm font-bold text-slate-700 mt-2 text-center max-w-[120px] pointer-events-none" style={{ pointerEvents: 'none' }}>
              {fixture.away_team || fixture.away_name}
            </div>
            {/* Form dots */}
            <div className="flex items-center gap-1.5 mt-3 pointer-events-none" style={{ pointerEvents: 'none' }}>
              {renderFormDots(awayForm)}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden pointer-events-none min-h-[192px]" style={{ pointerEvents: 'none' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: homeColor,
            clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: awayColor,
            clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}

