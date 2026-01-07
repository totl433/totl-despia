import React from "react";

type ParChartProps = {
  weeklyData: Array<{
    gw: number;
    userPoints: number;
    averagePoints: number;
  }>;
  latestGw: number;
  showInfo?: boolean;
};

export const ParChart = React.memo(function ParChart({
  weeklyData,
  latestGw,
  showInfo = false,
}: ParChartProps) {
  // Calculate max value for scaling
  const allValues = weeklyData.flatMap(d => [d.userPoints, d.averagePoints]);
  const maxValue = allValues.length > 0 ? Math.max(...allValues, 10) : 10;
  const minValue = 0;
  const range = maxValue - minValue || 1;
  const graphHeight = 120;

  // Calculate width: 48px per bar + 8px gap between bars + container padding (p-3 = 12px each side) + extra buffer
  const barWidth = 48;
  const gap = 8; // gap-2 = 8px
  const containerPadding = 12; // p-3 = 12px on each side
  const innerPadding = 4; // 4px on each side for the bar container
  const extraBuffer = showInfo ? 48 : 16; // Extra buffer - more when info is shown to prevent cutoff
  const chartWidth = Math.max(340, (weeklyData.length * barWidth) + ((weeklyData.length - 1) * gap) + (containerPadding * 2) + (innerPadding * 2) + extraBuffer);

  return (
    <div 
      className="flex-shrink-0 h-[168px] bg-white dark:bg-slate-800 relative"
      style={{ width: `${chartWidth}px`, minWidth: `${chartWidth}px` }}
    >
      <div className="pt-3 pb-2 h-full flex flex-col" style={{ paddingLeft: '0', paddingRight: '12px' }}>
        <div className="flex-1"></div>
        
        <div className="mb-1 relative" style={{ height: '120px' }}>
          <div className="relative h-full">
            <div className="flex items-end gap-2 h-full" style={{ paddingLeft: '0', paddingRight: '4px' }}>
              {weeklyData.map((data) => {
                const { gw, userPoints, averagePoints } = data;
                const isLatest = gw === latestGw;
                const diff = userPoints - averagePoints;
                const isAbovePar = diff > 0;
                const isBelowPar = diff < 0;
                
                const userBarHeight = ((userPoints - minValue) / range) * graphHeight;
                const parBarHeight = ((averagePoints - minValue) / range) * graphHeight;
                const maxBarHeight = Math.max(userBarHeight, parBarHeight);

                return (
                  <div
                    key={gw}
                    className="flex flex-col items-center justify-end relative"
                    style={{ minWidth: '48px', width: '48px', height: '100%' }}
                  >
                    {/* Combined bar showing both average and user score as two sections */}
                    <div className="w-full relative" style={{ height: `${maxBarHeight}px` }}>
                      {/* Score label above bar - positioned relative to bar */}
                      {showInfo && (
                        <div 
                          className="absolute flex items-center justify-center"
                          style={{ 
                            bottom: `${maxBarHeight + 4}px`,
                            left: '0',
                            right: '0',
                            width: '100%',
                            zIndex: 10
                          }}
                        >
                          <div
                            className={`text-xs font-bold leading-none ${
                              isLatest ? 'text-[#1C8376] dark:text-emerald-400' :
                              isAbovePar ? 'text-emerald-600 dark:text-emerald-400' :
                              isBelowPar ? 'text-red-600 dark:text-red-400' :
                              'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {userPoints}
                          </div>
                        </div>
                      )}
                      {isAbovePar ? (
                        // Above average: average section at bottom (gray), your extra points on top (colored)
                        <>
                          <div
                            className="absolute bottom-0 w-full bg-slate-300 dark:bg-slate-600 opacity-60"
                            style={{
                              height: `${parBarHeight}px`,
                              minHeight: parBarHeight > 0 ? '2px' : '0',
                              borderTopLeftRadius: '2px',
                              borderTopRightRadius: parBarHeight === maxBarHeight ? '2px' : '0',
                            }}
                            title={`Par: ${averagePoints.toFixed(1)}`}
                          />
                          <div
                            className="absolute w-full transition-all bg-emerald-500 dark:bg-emerald-600"
                            style={{
                              bottom: `${parBarHeight}px`,
                              height: `${userBarHeight - parBarHeight}px`,
                              minHeight: (userBarHeight - parBarHeight) > 0 ? '2px' : '0',
                              borderTopLeftRadius: '2px',
                              borderTopRightRadius: '2px',
                            }}
                            title={`Your score: ${userPoints}`}
                          />
                        </>
                      ) : isBelowPar ? (
                        // Below average: your score at bottom (colored), missing points on top (gray)
                        <>
                          <div
                            className="absolute bottom-0 w-full transition-all bg-red-500 dark:bg-red-600"
                            style={{
                              height: `${userBarHeight}px`,
                              minHeight: userBarHeight > 0 ? '2px' : '0',
                              borderTopLeftRadius: userBarHeight === maxBarHeight ? '2px' : '0',
                              borderTopRightRadius: userBarHeight === maxBarHeight ? '2px' : '0',
                            }}
                            title={`Your score: ${userPoints}`}
                          />
                          <div
                            className="absolute w-full bg-slate-300 dark:bg-slate-600 opacity-60"
                            style={{
                              bottom: `${userBarHeight}px`,
                              height: `${parBarHeight - userBarHeight}px`,
                              minHeight: (parBarHeight - userBarHeight) > 0 ? '2px' : '0',
                              borderTopLeftRadius: '2px',
                              borderTopRightRadius: '2px',
                            }}
                            title={`Par: ${averagePoints.toFixed(1)}`}
                          />
                        </>
                      ) : (
                        // At par: single bar showing both are equal
                        <div
                          className="absolute bottom-0 w-full rounded-t bg-slate-400 dark:bg-slate-500 transition-all"
                          style={{
                            height: `${userBarHeight}px`,
                            minHeight: userBarHeight > 0 ? '4px' : '0',
                            borderRadius: '2px 2px 0 0',
                          }}
                          title={`Your score: ${userPoints} (Par: ${averagePoints.toFixed(1)})`}
                        />
                      )}
                      
                      {/* Difference indicator inside bottom of bar */}
                      {maxBarHeight > 15 && (
                        <div
                          className="absolute bottom-1 left-0 right-0 flex items-center justify-center"
                          style={{ height: '16px' }}
                        >
                          <div
                            className={`text-sm leading-none ${
                              isAbovePar ? 'text-emerald-600 dark:text-emerald-400' : 
                              isBelowPar ? 'text-white' : 
                              'text-white'
                            }`}
                            style={{ fontWeight: 900 }}
                          >
                            {isAbovePar ? `+${diff.toFixed(1)}` : 
                             isBelowPar ? `${diff.toFixed(1)}` : 
                             'Par'}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* GW label and average below bar - fixed height container */}
                    <div className="flex flex-col items-center justify-start" style={{ height: '28px', marginTop: '4px' }}>
                      <div
                        className={`text-[10px] font-medium leading-tight ${
                          isLatest
                            ? 'text-[#1C8376] dark:text-emerald-400 font-bold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        GW{gw}
                      </div>
                      <div className="text-[9px] font-medium text-slate-400 dark:text-slate-500 leading-none" style={{ visibility: showInfo ? 'visible' : 'hidden', height: '12px' }}>
                        av. {averagePoints.toFixed(1)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

