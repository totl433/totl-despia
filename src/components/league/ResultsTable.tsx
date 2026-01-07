import UserAvatar from '../UserAvatar';

export type ResultRow = {
  user_id: string;
  name: string;
  score: number;
  unicorns: number;
};

export interface ResultsTableProps {
  rows: ResultRow[];
  members: Array<{ id: string; name: string }>;
  currentUserId?: string;
  positionChangeKeys: Set<string>;
  isApiTestLeague: boolean;
  hasLiveFixtures: boolean;
  hasStartingSoonFixtures: boolean;
  hasStartedFixtures: boolean;
  allFixturesFinished: boolean;
  resGw: number;
}

/**
 * ResultsTable - Displays GW results table with scores and unicorns
 * Used in GW Results tab
 */
export default function ResultsTable({
  rows,
  members,
  currentUserId,
  positionChangeKeys,
  isApiTestLeague,
  hasLiveFixtures,
  hasStartingSoonFixtures,
  hasStartedFixtures,
  allFixturesFinished,
  resGw,
}: ResultsTableProps) {
  return (
    <div>
      <style>{`
        @keyframes flash {
          0%, 100% {
            background-color: rgb(209, 250, 229);
          }
          25% {
            background-color: rgb(167, 243, 208);
          }
          50% {
            background-color: rgb(209, 250, 229);
          }
          75% {
            background-color: rgb(167, 243, 208);
          }
        }
        @keyframes pulse-score {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
        @keyframes position-change {
          0% {
            background-color: rgb(254, 243, 199);
          }
          50% {
            background-color: rgb(253, 230, 138);
          }
          100% {
            background-color: transparent;
          }
        }
        .flash-user-row {
          animation: flash 1.5s ease-in-out 3;
        }
        .pulse-live-score {
          animation: pulse-score 2s ease-in-out infinite;
        }
        .position-changed {
          animation: position-change 1.5s ease-out;
        }
        .full-width-header-border::after {
          content: '';
          position: absolute;
          left: -1rem;
          right: -1rem;
          bottom: 0;
          height: 1px;
          background-color: #cbd5e1;
          z-index: 1;
        }
        .dark .full-width-header-border::after {
          background-color: #475569;
        }
      `}</style>
      
      {/* Table */}
      <div 
        className="overflow-y-auto overflow-x-hidden -mx-4 sm:mx-0 rounded-none sm:rounded-2xl border-x-0 sm:border-x border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-sm"
        style={{ 
          backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc'
        }}
      >
        <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>
          <thead className="sticky top-0" style={{ 
            position: 'sticky', 
            top: 0, 
            zIndex: 25, 
            backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', 
            display: 'table-header-group'
          } as any}>
            <tr style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', borderBottom: 'none' }}>
              <th className="py-4 text-left font-normal" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', width: '35px', paddingLeft: '0.5rem', paddingRight: '0.25rem', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8' }}>#</th>
              <th className="py-4 text-left font-normal text-xs" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8', paddingLeft: '0.5rem', paddingRight: '1rem', width: 'auto' }}>
                <div className="flex items-center gap-2">
                  Player
                  {isApiTestLeague && hasLiveFixtures && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white shadow-md shadow-red-500/30">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-medium">
                        LIVE
                      </span>
                    </div>
                  )}
                  {isApiTestLeague && !allFixturesFinished && hasStartingSoonFixtures && !hasLiveFixtures && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-md shadow-amber-500/30">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[10px] font-medium">{hasStartedFixtures ? 'Next Game Starting Soon' : 'Starting soon'}</span>
                    </div>
                  )}
                </div>
              </th>
              <th className="py-4 text-center font-normal" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', width: '50px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8' }}>Score</th>
              {members.length >= 3 && <th className="py-4 text-center font-normal text-base" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8' }}>🦄</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = r.user_id === currentUserId;
              const isLastRow = i === rows.length - 1;
              const hasPositionChanged = positionChangeKeys.has(r.user_id);
              return (
                <tr 
                  key={r.user_id} 
                  className={`${isMe ? 'flash-user-row' : ''} ${hasPositionChanged ? 'position-changed' : ''}`}
                  style={{
                    position: 'relative',
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc',
                    ...(isLastRow ? {} : { borderBottom: document.documentElement.classList.contains('dark') ? '1px solid #334155' : '1px solid #e2e8f0' })
                  }}
                >
                  <td className="py-4 text-left tabular-nums whitespace-nowrap relative text-slate-900 dark:text-slate-100" style={{ 
                    paddingLeft: '0.5rem', 
                    paddingRight: '0.25rem',
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc',
                    width: '35px'
                  }}>
                    {i + 1}
                  </td>
                  <td className="py-4" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc', paddingLeft: '0.5rem', paddingRight: '1rem' }}>
                    <div className="flex items-center gap-1.5">
                      {isApiTestLeague && hasLiveFixtures && (
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse flex-shrink-0" style={{ minWidth: '8px', minHeight: '8px' }}></div>
                      )}
                      {isApiTestLeague && !hasLiveFixtures && hasStartingSoonFixtures && (
                        <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <div className="flex-shrink-0">
                        <UserAvatar
                          userId={r.user_id}
                          name={r.name}
                          size={24}
                          className="border border-slate-200 dark:border-slate-700"
                          fallbackToInitials={true}
                        />
                      </div>
                      <span className="text-xs truncate min-w-0 whitespace-nowrap font-normal text-slate-900 dark:text-slate-100" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.name}
                      </span>
                    </div>
                  </td>
                  <td className={`py-4 text-center tabular-nums font-bold text-[#1C8376] bg-slate-50 dark:bg-slate-900 w-[50px] pl-1 pr-1 ${isApiTestLeague && hasLiveFixtures ? 'pulse-live-score' : ''}`}>{r.score}</td>
                  {members.length >= 3 && <td className={`py-4 text-center tabular-nums bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-[35px] pl-1 pr-1 ${isApiTestLeague && hasLiveFixtures ? 'pulse-live-score' : ''}`}>{r.unicorns}</td>}
                </tr>
              );
            })}
            {!rows.length && (
              <tr className="bg-slate-50 dark:bg-slate-900" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>
                <td className="px-4 py-6 text-slate-500 dark:text-slate-400 text-center bg-slate-50 dark:bg-slate-900" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }} colSpan={members.length >= 3 ? 4 : 3}>
                  No results recorded for GW {resGw} yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

