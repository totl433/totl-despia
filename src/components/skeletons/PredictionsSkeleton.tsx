/**
 * Skeleton loader for Predictions page
 * Shows skeleton cards for fixtures
 */
export default function PredictionsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white rounded-xl shadow-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-slate-200 rounded w-32"></div>
            <div className="h-4 bg-slate-200 rounded w-20"></div>
          </div>
          
          {/* Teams */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 rounded bg-slate-200"></div>
              <div className="h-5 bg-slate-200 rounded w-24"></div>
            </div>
            
            <div className="px-4">
              <div className="h-8 bg-slate-200 rounded w-16"></div>
            </div>
            
            <div className="flex items-center gap-3 flex-1 justify-end">
              <div className="h-5 bg-slate-200 rounded w-24"></div>
              <div className="w-12 h-12 rounded bg-slate-200"></div>
            </div>
          </div>
          
          {/* Prediction buttons */}
          <div className="flex gap-2 mt-4">
            <div className="flex-1 h-10 bg-slate-200 rounded"></div>
            <div className="flex-1 h-10 bg-slate-200 rounded"></div>
            <div className="flex-1 h-10 bg-slate-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

