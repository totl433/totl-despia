import { forwardRef } from'react';

type LeaderboardRowData = {
 user_id: string;
 name: string | null;
 rank?: number;
 this_gw?: number;
 ocp?: number;
 formPoints?: number;
 points?: number;
};

type LeaderboardRowProps = {
 row: LeaderboardRowData;
 index: number;
 array: LeaderboardRowData[];
 activeTab:'overall' |'form5' |'form10' |'lastgw';
 isCurrentUser: boolean;
 prevRanks: Record<string, number>;
 currRanks: Record<string, number>;
 onUserClick?: (userId: string, userName: string | null) => void;
};

export const LeaderboardRow = forwardRef<HTMLTableRowElement, LeaderboardRowProps>(
 ({ row, index, array, activeTab, isCurrentUser, prevRanks, currRanks, onUserClick }, ref) => {
 // Calculate rank
 const currentRank ='rank' in row ? row.rank : index + 1;
 const rankCount = array.filter((item, idx) => {
 const itemRank ='rank' in item ? item.rank : idx + 1;
 return itemRank === currentRank;
 }).length;
 const isTied = rankCount > 1;
 const isTopRank = currentRank === 1;

 // Calculate rank movement indicator (only for overall tab)
 let indicator ="";
 let indicatorClass ="bg-gray-300";
 
 if (activeTab ==="overall") {
 const prev = prevRanks[row.user_id];
 const curr = currRanks[row.user_id];
 
 if (curr && prev) {
 if (curr < prev) {
 indicator ="▲";
 indicatorClass ="bg-emerald-500 text-white";
 } else if (curr > prev) {
 indicator ="▼";
 indicatorClass ="bg-red-500 text-white";
 } else {
 indicator ="→";
 indicatorClass ="bg-gray-500 text-white";
 }
 } else if (curr && !prev) {
 indicator ="";
 indicatorClass ="bg-gray-400";
 }
 }

 return (
 <tr 
 ref={ref}
 onClick={() => onUserClick?.(row.user_id, row.name)}
 style={{
 ...(index > 0 ? { 
 borderTop:'1px solid #e2e8f0',
 position:'relative',
 backgroundColor:'#f8fafc',
 cursor: onUserClick ?'pointer' :'default',
 } : { 
 position:'relative', 
 backgroundColor:'#f8fafc',
 cursor: onUserClick ?'pointer' :'default',
 })
 }}
        className={onUserClick ?'' :''}
 >
 {/* Rank number */}
 <td className="py-3 text-left tabular-nums whitespace-nowrap relative" style={{ 
 width:'45px',
 paddingLeft:'0.5rem', 
 paddingRight:'0.5rem',
 backgroundColor:'#f8fafc'
 }}>
 <span>{currentRank}{isTied ?'=' :''}</span>
 </td>

 {/* Player name with indicators */}
 <td className="px-4 py-3" style={{ backgroundColor:'#f8fafc' }}>
 <div className="flex items-center gap-2">
 {(indicator || indicatorClass) && activeTab ==="overall" && (
 <span
 className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold ${indicatorClass} align-middle flex-shrink-0`}
 aria-hidden
 >
 {indicator}
 </span>)}
 {isTopRank && (
 <span className="inline-flex items-center sparkle-trophy flex-shrink-0">
 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-4 h-4 text-yellow-500">
 <g>
 <path fill="currentColor" d="M16 3c1.1046 0 2 0.89543 2 2h2c1.1046 0 2 0.89543 2 2v1c0 2.695 -2.1323 4.89 -4.8018 4.9941 -0.8777 1.5207 -2.4019 2.6195 -4.1982 2.9209V19h3c0.5523 0 1 0.4477 1 1s-0.4477 1 -1 1H8c-0.55228 0 -1 -0.4477 -1 -1s0.44772 -1 1 -1h3v-3.085c-1.7965 -0.3015 -3.32148 -1.4 -4.19922 -2.9209C4.13175 12.8895 2 10.6947 2 8V7c0 -1.10457 0.89543 -2 2 -2h2c0 -1.10457 0.89543 -2 2 -2zm-8 7c0 2.2091 1.79086 4 4 4 2.2091 0 4 -1.7909 4 -4V5H8zM4 8c0 1.32848 0.86419 2.4532 2.06055 2.8477C6.02137 10.5707 6 10.2878 6 10V7H4zm14 2c0 0.2878 -0.0223 0.5706 -0.0615 0.8477C19.1353 10.4535 20 9.32881 20 8V7h-2z" strokeWidth="1"></path>
 </g>
 </svg>
 </span>)}
 <span className="font-normal text-sm truncate min-w-0 whitespace-nowrap" style={{ color:'rgb(0, 0, 0)', overflow:'hidden', textOverflow:'ellipsis' }}>
 {row.name}
 </span>
 {isCurrentUser && (
 <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 flex-shrink-0 flash-you-badge">
 you
 </span>)}
 </div>
 </td>

 {/* Overall tab columns */}
 {activeTab ==="overall" && (
 <>
 <td className="px-4 py-3 text-center tabular-nums font-bold" style={{ width:'40px', paddingLeft:'0.5rem', paddingRight:'0.5rem', backgroundColor:'#f8fafc' }}></td>
 <td className="px-1 py-3 text-center tabular-nums font-bold" style={{ width:'55px', paddingLeft:'0.5rem', paddingRight:'0.5rem', backgroundColor:'#f8fafc' }}>
 {'this_gw' in row ? row.this_gw : 0}
 </td>
 <td className="py-3 text-center tabular-nums font-bold" style={{ 
 width:'60px',
 paddingLeft:'0.5rem', 
 paddingRight:'0.5rem',
 backgroundColor:'#f8fafc'
 }}>
 {'ocp' in row ? row.ocp : 0}
 </td>
 </>)}

 {/* Form tab columns (both 5 Week and 10 Week) */}
 {(activeTab ==="form5" || activeTab ==="form10") && (
 <>
 <td className="px-4 py-3 text-center tabular-nums font-bold" style={{ width:'40px', paddingLeft:'0.5rem', paddingRight:'0.5rem', backgroundColor:'#f8fafc' }}></td>
 <td className="py-3 text-center tabular-nums font-bold" style={{ 
 width:'60px',
 paddingLeft:'0.5rem', 
 paddingRight:'0.5rem',
 backgroundColor:'#f8fafc'
 }}>
 {'formPoints' in row ? row.formPoints : 0}
 </td>
 </>)}
 
 {/* Last GW tab columns */}
 {activeTab ==="lastgw" && (
 <>
 <td className="px-4 py-3 text-center tabular-nums font-bold" style={{ width:'40px', paddingLeft:'0.5rem', paddingRight:'0.5rem', backgroundColor:'#f8fafc' }}></td>
 <td className="py-3 text-center tabular-nums font-bold" style={{ 
 width:'60px',
 paddingLeft:'0.5rem', 
 paddingRight:'0.5rem',
 backgroundColor:'#f8fafc'
 }}>
 {'points' in row ? row.points : 0}
 </td>
 </>)}
 </tr>);
 });

LeaderboardRow.displayName ='LeaderboardRow';

