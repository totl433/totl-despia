
export type ComingSoonBannerProps = {
  gameweek: number;
  message?: string;
};

/**
 * Banner component to display "GWX Coming Soon" message
 * Used when fixtures for the next gameweek are not yet available
 */
export default function ComingSoonBanner({
  gameweek,
  message = 'Fixtures will be published soon.',
}: ComingSoonBannerProps) {
  return (
    <div className="w-full px-4 py-3 relative" style={{ backgroundColor: '#e1eae9' }}>
      <div className="mx-auto max-w-6xl relative">
        {/* Circular icon with exclamation mark - top left */}
        <div className="absolute top-3 left-0 w-6 h-6 rounded-full bg-[#1C8376] flex items-center justify-center text-white text-[10px] font-normal">
          !
        </div>
        
        {/* Text content */}
        <div className="pl-10">
          <div className="font-bold text-slate-900 text-base">
            GW{gameweek} Coming Soon!
          </div>
          <div className="text-sm text-slate-600 mt-0.5">
            {message}
          </div>
        </div>
      </div>
    </div>
  );
}

