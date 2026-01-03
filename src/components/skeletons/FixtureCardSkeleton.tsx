/**
 * Skeleton loader for FixtureCard
 * Matches the layout of FixtureCard for smooth loading transition
 */
export default function FixtureCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 animate-pulse">
      <div className="flex items-center justify-between">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded bg-slate-200"></div>
          <div className="h-4 bg-slate-200 rounded w-20"></div>
        </div>
        
        {/* Score/VS */}
        <div className="px-4">
          <div className="h-6 bg-slate-200 rounded w-12"></div>
        </div>
        
        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="h-4 bg-slate-200 rounded w-20"></div>
          <div className="w-8 h-8 rounded bg-slate-200"></div>
        </div>
      </div>
      
      {/* Kickoff time */}
      <div className="mt-3 h-3 bg-slate-200 rounded w-24 mx-auto"></div>
    </div>
  );
}

