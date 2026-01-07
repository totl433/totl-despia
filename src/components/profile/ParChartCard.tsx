import React from"react";

type ParChartCardProps = {
 gw: number;
 userPoints: number;
 averagePoints: number;
 isLatest?: boolean;
};

export const ParChartCard = React.memo(function ParChartCard({
 gw,
 userPoints,
 averagePoints,
 isLatest = false,
}: ParChartCardProps) {
 const diff = userPoints - averagePoints;
 const isAbovePar = diff > 0;
 const isBelowPar = diff < 0;
 
 // Calculate bar heights - use a scale where max is the higher of user points or average
 const maxValue = Math.max(userPoints, averagePoints, 10); // At least 10 for scale
 const minValue = 0;
 const range = maxValue - minValue || 1;
 const graphHeight = 70;
 
 const userBarHeight = ((userPoints - minValue) / range) * graphHeight;
 const parBarHeight = ((averagePoints - minValue) / range) * graphHeight;

 return (
 <div className="flex-shrink-0 w-[340px] sm:w-[400px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden relative">
 <div className="p-3 h-full flex flex-col">
 <div className="flex-1"></div>
 
 <div className="mb-2 relative" style={{ height:'70px' }}>
 <div className="relative h-full">
 <div className="flex items-end justify-center gap-1 h-full px-1">
 {/* Single bar with two sections: average (bottom) and your score (top or full) */}
 <div className="flex flex-col items-center justify-end gap-1 flex-1 relative min-w-0">
 <div
 className={`text-xs font-bold mb-0.5 leading-none ${
 isLatest ?'text-[#1C8376]' : 
 isAbovePar ?'text-emerald-600' : 
 isBelowPar ?'text-red-600' :'text-slate-700'
 }`}
 >
 {userPoints}
 </div>
 
 {/* Combined bar showing both average and user score as two sections */}
 <div className="w-full relative" style={{ height: `${Math.max(userBarHeight, parBarHeight)}px` }}>
 {isAbovePar ? (
 // Above average: average section at bottom (gray), your extra points on top (colored)
 <>
 <div
 className="absolute bottom-0 w-full bg-slate-300 opacity-60"
 style={{
 height: `${parBarHeight}px`,
 minHeight: parBarHeight > 0 ?'2px' :'0',
 borderTopLeftRadius:'4px',
 borderTopRightRadius: parBarHeight === Math.max(userBarHeight, parBarHeight) ?'4px' :'0',
 }}
 title={`Par: ${averagePoints.toFixed(1)}`}
 />
 <div
 className={`absolute w-full ${
 isLatest
 ?'bg-[#1C8376]'
 :'bg-emerald-500'
 }`}
 style={{
 bottom: `${parBarHeight}px`,
 height: `${userBarHeight - parBarHeight}px`,
 minHeight: (userBarHeight - parBarHeight) > 0 ?'2px' :'0',
 borderTopLeftRadius:'4px',
 borderTopRightRadius:'4px',
 }}
 title={`Your score: ${userPoints}`}
 />
 </>) : isBelowPar ? (
 // Below average: your score at bottom (colored), missing points on top (gray)
 <>
 <div
 className={`absolute bottom-0 w-full ${
 isLatest
 ?'bg-[#1C8376]'
 :'bg-red-500'
 }`}
 style={{
 height: `${userBarHeight}px`,
 minHeight: userBarHeight > 0 ?'2px' :'0',
 borderTopLeftRadius: userBarHeight === Math.max(userBarHeight, parBarHeight) ?'4px' :'0',
 borderTopRightRadius: userBarHeight === Math.max(userBarHeight, parBarHeight) ?'4px' :'0',
 }}
 title={`Your score: ${userPoints}`}
 />
 <div
 className="absolute w-full bg-slate-300 opacity-60"
 style={{
 bottom: `${userBarHeight}px`,
 height: `${parBarHeight - userBarHeight}px`,
 minHeight: (parBarHeight - userBarHeight) > 0 ?'2px' :'0',
 borderTopLeftRadius:'4px',
 borderTopRightRadius:'4px',
 }}
 title={`Par: ${averagePoints.toFixed(1)}`}
 />
 </>) : (
 // At par: single bar showing both are equal
 <div
 className="absolute bottom-0 w-full rounded-t bg-slate-400"
 style={{
 height: `${userBarHeight}px`,
 minHeight: userBarHeight > 0 ?'4px' :'0'
 }}
 title={`Your score: ${userPoints} (Par: ${averagePoints.toFixed(1)})`}
 />)}
 </div>
 
 <div className={`text-[10px] font-medium leading-tight ${
 isLatest
 ?'text-[#1C8376] font-bold'
 :'text-slate-700'
 }`}>
 GW{gw}
 </div>
 </div>
 </div>
 </div>
 </div>
 
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1">
 <div className={`text-xs font-semibold ${
 isAbovePar ?'text-emerald-600' : 
 isBelowPar ?'text-red-600' :'text-slate-600'
 }`}>
 {isAbovePar ? `+${diff.toFixed(1)}` : 
 isBelowPar ? `${diff.toFixed(1)}` :'Par'}
 </div>
 </div>
 <div className="text-[10px] font-medium text-slate-400">
 Par: {averagePoints.toFixed(1)}
 </div>
 </div>
 </div>
 </div>);
});

