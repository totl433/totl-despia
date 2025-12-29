import { Link } from 'react-router-dom';
import { useMemo } from 'react';

export type GameweekBannerProps = {
  gameweek: number;
  variant?: 'coming-soon' | 'live';
  message?: string;
  linkTo?: string;
  deadlineText?: string | null;
};

/**
 * Calculate countdown string from deadline text
 * Returns format like "2d 6h 45m" or null if deadline is in the past
 * Deadline format: "Mon, Dec 2, 18:15" (UTC time)
 */
function calculateCountdown(deadlineText: string | null): string | null {
  if (!deadlineText) return null;
  
  try {
    // Parse deadline text like "Mon, Dec 2, 18:15"
    const parts = deadlineText.split(', ');
    if (parts.length < 3) return null;
    
    const datePart = parts[1]; // "Dec 2"
    const timePart = parts[2]; // "18:15"
    const [hours, minutes] = timePart.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) return null;
    
    // Get current year and construct full date in UTC
    const now = new Date();
    const year = now.getUTCFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthMatch = datePart.match(/(\w+)\s+(\d+)/);
    if (!monthMatch) return null;
    
    const monthName = monthMatch[1];
    const day = parseInt(monthMatch[2], 10);
    const monthIndex = monthNames.indexOf(monthName);
    if (monthIndex === -1) return null;
    
    // Create deadline date in UTC
    const deadline = new Date(Date.UTC(year, monthIndex, day, hours, minutes));
    
    // If the deadline is in the past, try next year
    if (deadline <= now) {
      const nextYearDeadline = new Date(Date.UTC(year + 1, monthIndex, day, hours, minutes));
      if (nextYearDeadline <= now) return null;
      // Use next year's deadline
      const diff = nextYearDeadline.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hoursRemaining = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutesRemaining = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) {
        return `${days}d ${hoursRemaining}h ${minutesRemaining}m`;
      } else if (hoursRemaining > 0) {
        return `${hoursRemaining}h ${minutesRemaining}m`;
      } else {
        return `${minutesRemaining}m`;
      }
    }
    
    // Calculate difference
    const diff = deadline.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hoursRemaining}h ${minutesRemaining}m`;
    } else if (hoursRemaining > 0) {
      return `${hoursRemaining}h ${minutesRemaining}m`;
    } else {
      return `${minutesRemaining}m`;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Banner component for gameweek-related messages
 * Supports "Coming Soon" and "Live" variants with updated design
 */
export default function GameweekBanner({
  gameweek,
  variant = 'coming-soon',
  message,
  linkTo,
  deadlineText,
}: GameweekBannerProps) {
  const isLive = variant === 'live';
  
  // Calculate countdown for live banners
  const countdown = useMemo(() => {
    if (isLive && deadlineText) {
      return calculateCountdown(deadlineText);
    }
    return null;
  }, [isLive, deadlineText]);

  // Live banner: light gray background with new design
  const bgColor = isLive ? '#e9f0ef' : '#e1eae9';
  const textColor = isLive ? 'text-slate-900' : 'text-slate-900';
  const subtextColor = isLive ? 'text-slate-600' : 'text-slate-600';
  
  const defaultMessage = isLive 
    ? 'Fixtures will be published soon.'
    : 'Fixtures will be published soon.';
  
  const displayMessage = message || defaultMessage;

  return (
    <div className="w-full px-4 py-3 relative gameweek-banner z-40" style={{ backgroundColor: bgColor }} data-banner-height>
      <div className="mx-auto max-w-6xl flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0 flex-1 min-w-0">
          {isLive ? (
            <>
              <div className="flex items-center gap-3">
                {/* Circular icon with exclamation mark */}
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1C8376] flex items-center justify-center text-white text-[10px] font-normal">
                  !
                </div>
                <div className={`font-bold ${textColor} text-base`}>
                  Gameweek {gameweek} Predictions
                </div>
              </div>
              <div className={`text-sm ${subtextColor} ml-[32px]`}>
                Deadline{' '}
                {countdown && (
                  <span className="text-[#1C8376] font-bold">{countdown}</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                {/* Circular icon with exclamation mark */}
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1C8376] flex items-center justify-center text-white text-[10px] font-normal">
                  !
                </div>
                <div className={`font-bold ${textColor} text-base`}>
                  GW{gameweek} Coming Soon!
                </div>
              </div>
              <div className={`text-sm ${subtextColor} ml-[32px]`}>
                {displayMessage}
              </div>
            </>
          )}
        </div>
        
        {/* Go button for live banners */}
        {isLive && linkTo && (
          <Link
            to={linkTo}
            className="flex-shrink-0 px-4 py-2 bg-[#1C8376] text-white rounded-[20px] font-medium hover:bg-[#1C8376]/90 transition-colors flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            Go
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
