import React from "react";

type StreakCardProps = {
  streak: number;
  last10GwScores: Array<{ gw: number; score: number | null }>;
  latestGw: number;
};

export const StreakCard = React.memo(function StreakCard({
  streak,
  last10GwScores,
  latestGw,
}: StreakCardProps) {
  const scores = last10GwScores;
  const playedScores = scores.filter(s => s.score !== null);
  const maxScore = playedScores.length > 0 ? Math.max(...playedScores.map(s => s.score!)) : 10;
  const minScore = 0;
  const range = maxScore - minScore || 1;
  const graphHeight = 60;

  return (
    <div className="flex-shrink-0 w-[340px] sm:w-[400px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow relative">
      <div className="p-3 h-full flex flex-col">
        <div className="flex-1"></div>
        
        <div className="mb-2 relative" style={{ height: '70px' }}>
          <div className="relative h-full">
            <div className="flex items-end justify-between gap-1 h-full px-1">
              {scores.map((gwData) => {
                const isPlayed = gwData.score !== null;
                const isLatest = gwData.gw === latestGw;
                const score = gwData.score ?? 0;
                const barHeight = isPlayed ? ((score - minScore) / range) * graphHeight : 0;
                
                return (
                  <div
                    key={gwData.gw}
                    className="flex flex-col items-center justify-end gap-1 flex-1 relative min-w-0"
                  >
                    {isPlayed && (
                      <div
                        className={`text-xs font-bold mb-0.5 leading-none ${
                          isLatest ? 'text-[#1C8376]' : 'text-slate-700'
                        }`}
                      >
                        {score}
                      </div>
                    )}
                    
                    <div
                      className={`w-full rounded-t transition-all ${
                        isPlayed
                          ? isLatest
                            ? 'bg-[#1C8376]'
                            : 'bg-slate-400'
                          : 'bg-slate-200'
                      }`}
                      style={{
                        height: `${barHeight}px`,
                        minHeight: isPlayed ? '4px' : '0'
                      }}
                      title={isPlayed ? `GW${gwData.gw}: ${score}` : `GW${gwData.gw}: Not played`}
                    />
                    
                    <div
                      className={`text-[10px] font-medium leading-tight ${
                        isPlayed
                          ? isLatest
                            ? 'text-[#1C8376] font-bold'
                            : 'text-slate-700'
                          : 'text-slate-400'
                      }`}
                    >
                      GW{gwData.gw}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-slate-900">
              Your Streak{' '}
              <span className="font-bold text-orange-500">
                {streak > 0 
                  ? `${streak} ${streak === 1 ? 'Week' : 'Weeks'}`
                  : 'Start your streak!'}
              </span>
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400">Last 10</span>
        </div>
      </div>
    </div>
  );
});

