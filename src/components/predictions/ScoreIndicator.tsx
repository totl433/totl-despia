export interface ScoreIndicatorProps {
  score: number;
  total: number;
  topPercent?: number | null;
}

export default function ScoreIndicator({
  score,
  total,
  topPercent,
}: ScoreIndicatorProps) {
  const percentage = total > 0 ? (score / total) * 100 : 0;

  return (
    <div className="mb-4 rounded-xl border bg-gradient-to-br from-[#1C8376]/5 to-blue-50/50 shadow-sm px-6 py-5">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
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

