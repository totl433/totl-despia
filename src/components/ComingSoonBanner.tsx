import { Link } from 'react-router-dom';

export type GameweekBannerProps = {
  gameweek: number;
  variant?: 'coming-soon' | 'live';
  message?: string;
  linkTo?: string;
  deadlineText?: string | null;
};

/**
 * Banner component for gameweek-related messages
 * Supports "Coming Soon" and "Live" variants with consistent styling
 * Uses left-justified layout with icon (consistent with ComingSoonBanner design)
 */
export default function GameweekBanner({
  gameweek,
  variant = 'coming-soon',
  message,
  linkTo,
  deadlineText,
}: GameweekBannerProps) {
  const isLive = variant === 'live';
  const bgColor = isLive ? '#1C8376' : '#e1eae9';
  const textColor = isLive ? 'text-white' : 'text-slate-900';
  const subtextColor = isLive ? 'text-white/90' : 'text-slate-600';
  
  const defaultMessage = isLive 
    ? (deadlineText ? `Deadline: ${deadlineText}` : "Don't miss the deadline!")
    : 'Fixtures will be published soon.';
  
  const displayMessage = message || defaultMessage;

  const content = (
    <div className="w-full px-4 py-3 relative gameweek-banner z-40" style={{ backgroundColor: bgColor }} data-banner-height>
      <div className="mx-auto max-w-6xl relative">
        {/* Circular icon with exclamation mark - top left */}
        <div className="absolute top-3 left-0 w-6 h-6 rounded-full bg-[#1C8376] flex items-center justify-center text-white text-[10px] font-normal">
          !
        </div>
        
        {/* Text content */}
        <div className="pl-10">
          <div className={`font-bold ${textColor} text-base`}>
            {isLive ? `GW${gameweek} is Live - Make your predictions` : `GW${gameweek} Coming Soon!`}
          </div>
          <div className={`text-sm ${subtextColor} mt-0.5`}>
            {displayMessage}
          </div>
        </div>
      </div>
    </div>
  );

  // If it's a live banner with a link, make it clickable
  if (linkTo && isLive) {
    return (
      <Link to={linkTo} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

