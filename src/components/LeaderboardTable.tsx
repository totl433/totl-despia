import { forwardRef } from 'react';
import { LeaderboardRow } from './LeaderboardRow';

type LeaderboardRowData = {
  user_id: string;
  name: string | null;
  rank?: number;
  this_gw?: number;
  ocp?: number;
  formPoints?: number;
  points?: number;
};

type LeaderboardTableProps = {
  rows: LeaderboardRowData[];
  activeTab: 'overall' | 'form5' | 'form10' | 'lastgw';
  currentUserId: string | undefined;
  prevRanks: Record<string, number>;
  currRanks: Record<string, number>;
  latestGw: number | null;
  userRowRef: React.RefObject<HTMLTableRowElement>;
};

export const LeaderboardTable = forwardRef<HTMLDivElement, LeaderboardTableProps>(
  ({ rows, activeTab, currentUserId, prevRanks, currRanks, latestGw, userRowRef }, ref) => {
    return (
      <div 
        ref={ref}
        className="flex-1 overflow-y-auto overflow-x-hidden -mx-4 sm:mx-0 rounded-none sm:rounded-2xl border-x-0 sm:border-x border-b border-slate-200 bg-slate-50 shadow-sm"
        style={{ 
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          paddingTop: '0',
          paddingBottom: '100px',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          backgroundColor: '#f8fafc',
          touchAction: 'pan-y'
        }}
      >
        <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', backgroundColor: '#f8fafc' }}>
          <thead className="sticky top-0 full-width-header-border" style={{ 
            position: 'sticky', 
            top: 0, 
            zIndex: 25, 
            backgroundColor: '#f8fafc', 
            display: 'table-header-group'
          } as any}>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <th className="py-3 text-left font-normal" style={{ backgroundColor: '#f8fafc', width: '45px', paddingLeft: '0.5rem', paddingRight: '0.5rem', color: '#64748b' }}>#</th>
              <th className="px-4 py-3 text-left font-normal text-xs" style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>Player</th>
              {activeTab === "overall" && (
                <>
                  <th className="px-4 py-3 text-center font-semibold" style={{ backgroundColor: '#f8fafc', width: '40px', borderTop: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}></th>
                  <th className="px-1 py-3 text-center font-normal" style={{ backgroundColor: '#f8fafc', width: '55px', color: '#64748b', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>GW{latestGw || '?'}</th>
                  <th className="py-3 text-center font-normal" style={{ backgroundColor: '#f8fafc', width: '60px', paddingLeft: '0.5rem', paddingRight: '0.5rem', color: '#64748b' }}>OCP</th>
                </>
              )}
              {(activeTab === "form5" || activeTab === "form10") && (
                <>
                  <th className="px-4 py-3 text-center font-semibold" style={{ backgroundColor: '#f8fafc', width: '40px', borderTop: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}></th>
                  <th className="py-3 text-center font-normal" style={{ backgroundColor: '#f8fafc', width: '60px', paddingLeft: '0.5rem', paddingRight: '0.5rem', color: '#64748b' }}>PTS</th>
                </>
              )}
              {activeTab === "lastgw" && (
                <>
                  <th className="px-4 py-3 text-center font-semibold" style={{ backgroundColor: '#f8fafc', width: '40px', borderTop: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}></th>
                  <th className="py-3 text-center font-semibold" style={{ backgroundColor: '#f8fafc', width: '60px', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>GW{latestGw || '?'}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i, arr) => {
              const isCurrentUser = r.user_id === currentUserId;
              return (
                <LeaderboardRow
                  key={r.user_id}
                  ref={isCurrentUser ? userRowRef : null}
                  row={r}
                  index={i}
                  array={arr}
                  activeTab={activeTab}
                  isCurrentUser={isCurrentUser}
                  prevRanks={prevRanks}
                  currRanks={currRanks}
                  latestGw={latestGw}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
);

LeaderboardTable.displayName = 'LeaderboardTable';

