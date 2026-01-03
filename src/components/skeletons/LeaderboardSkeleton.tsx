/**
 * Skeleton loader for LeaderboardCard
 * Matches the layout of leaderboard table for smooth loading transition
 */
export default function LeaderboardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 animate-pulse">
      {/* Header */}
      <div className="h-6 bg-slate-200 rounded w-32 mb-4"></div>
      
      {/* Table skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {/* Rank */}
              <div className="w-8 h-6 bg-slate-200 rounded"></div>
              {/* Name */}
              <div className="h-5 bg-slate-200 rounded w-32"></div>
            </div>
            {/* Score */}
            <div className="h-5 bg-slate-200 rounded w-12"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

