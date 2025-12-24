export interface ScoreIndicatorProps {
  score: number;
  total: number;
  topPercent?: number | null;
  state?: 'starting-soon' | 'live' | 'finished';
}

export default function ScoreIndicator({
  score,
  total,
  topPercent,
  state = 'finished',
}: ScoreIndicatorProps) {
  const percentage = total > 0 ? (score / total) * 100 : 0;

  // Determine icon and text based on state
  let iconElement: JSX.Element | null = null;

  if (state === 'starting-soon') {
    // Clock icon for starting soon
    iconElement = (
      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  } else if (state === 'live') {
    // Red flashing dot + "Live" text for live games
    iconElement = (
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
        <span className="text-sm font-bold text-red-600">Live</span>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border bg-gradient-to-br from-[#1C8376]/5 to-blue-50/50 shadow-sm px-6 py-5">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          {iconElement}
          <div className="text-4xl font-extrabold text-[#1C8376]">
            {score}/{total}
          </div>
          {topPercent !== null && topPercent !== undefined && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-100 to-orange-100 border border-yellow-300">
              <span className="text-sm font-bold text-orange-700">
                Top {topPercent}%
              </span>
            </div>
          )}
        </div>
        <div className="mb-3 bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#1C8376] to-blue-500 transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

