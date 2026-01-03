/**
 * Skeleton loader for MiniLeagueCard
 * Matches the layout of MiniLeagueCard for smooth loading transition
 */
export default function LeagueCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 animate-pulse">
      <div className="flex items-center gap-3">
        {/* Avatar skeleton */}
        <div className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0"></div>
        
        <div className="flex-1 min-w-0">
          {/* League name skeleton */}
          <div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div>
          
          {/* Member count skeleton */}
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>
        
        {/* Arrow icon skeleton */}
        <div className="w-6 h-6 bg-slate-200 rounded flex-shrink-0"></div>
      </div>
    </div>
  );
}

