import { Link } from "react-router-dom";

interface LeaderboardCircleProps {
  to: string;
  rank: number | null;
  total: number | null;
  label: string;
  bgColor: string;
  gw?: number | null; // Optional GW number for Last GW
}

/**
 * LeaderboardCircle - A circular leaderboard indicator showing rank and player count
 * 
 * Usage:
 * <LeaderboardCircle
 *   to="/global?tab=lastgw"
 *   rank={54}
 *   total={110}
 *   label="GW20"
 *   bgColor="bg-blue-500"
 *   gw={20}
 * />
 */
export default function LeaderboardCircle({
  to,
  rank,
  total,
  label,
  bgColor: _bgColor, // Deprecated but kept for backwards compatibility
  gw,
}: LeaderboardCircleProps) {
  const displayLabel = gw ? `GW${gw}` : label;

  // Calculate percentage to top: rank 1 = 100%, rank N = (total - rank + 1) / total * 100
  // If no rank or total, default to 0
  const percentage = rank && total && total > 0 
    ? ((total - rank + 1) / total) * 100 
    : 0;

  // SVG circle constants - radius and circumference for progress calculation
  // Using a size that works for all responsive sizes (we'll scale with viewBox)
  const radius = 45; // Radius for the circle (inside a 100x100 viewBox)
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Create a unique ID for this circle's animation to avoid conflicts
  const circleId = `circle-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <Link to={to} className="flex flex-col items-center">
      <style>{`
        @keyframes progress-${circleId} {
          from {
            stroke-dashoffset: ${circumference};
          }
          to {
            stroke-dashoffset: ${strokeDashoffset};
          }
        }
        .progress-circle-${circleId} {
          animation: progress-${circleId} 1s ease-out forwards;
        }
      `}</style>
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 flex-shrink-0">
        {/* SVG for circular progress */}
        <svg 
          className="absolute inset-0 w-full h-full transform -rotate-90" 
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background circle (light grey) */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="4"
          />
          {/* Progress circle (emerald green) */}
          {percentage > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              strokeLinecap="round"
              className={`progress-circle-${circleId}`}
            />
          )}
        </svg>
        
        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-900">
          <div className="flex items-baseline justify-center">
            {rank ? (
              <>
                <span className="text-2xl sm:text-3xl lg:text-4xl">{rank}</span>
                <span className="text-[10px] sm:text-xs lg:text-sm font-bold">
                  {rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}
                </span>
              </>
            ) : (
              <span className="text-2xl sm:text-3xl lg:text-4xl">--</span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium text-slate-700 text-center">
        {displayLabel}
      </div>
    </Link>
  );
}

