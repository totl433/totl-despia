import React from 'react';
import FormDisplay from './FormDisplay';
import UserAvatar from '../UserAvatar';

export type MltRow = {
  user_id: string;
  name: string;
  mltPts: number;
  ocp: number;
  unicorns: number;
  wins: number;
  draws: number;
  form: ("W" | "D" | "L")[];
};

export interface MiniLeagueTableProps {
  rows: MltRow[];
  members: Array<{ id: string; name: string }>;
  showForm: boolean;
  currentUserId?: string;
  loading: boolean;
  isLateStartingLeague: boolean;
}

/**
 * MiniLeagueTable - Displays the mini league standings table
 * Shows either Points view (W/D/OCP/Unicorns/PTS) or Form view (last 5 results)
 */
export default function MiniLeagueTable({
  rows,
  members,
  showForm,
  currentUserId,
  loading,
  isLateStartingLeague,
}: MiniLeagueTableProps) {
  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueTable.tsx:36',message:'MiniLeagueTable render',data:{rowsLength:rows.length,membersLength:members.length,loading,rowUserIds:rows.map(r=>r.user_id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
  }, [rows, members, loading]);
  // #endregion

  return (
    <div className="pt-4">
      <style>{`
        .mlt-table tbody tr:last-child {
          border-bottom: none !important;
          border: none !important;
        }
        .mlt-table tbody tr:last-child td {
          border-bottom: none !important;
          border: none !important;
        }
        .mlt-table tbody tr:last-child th {
          border-bottom: none !important;
          border: none !important;
        }
        .mlt-table {
          border-bottom: none !important;
        }
        .mlt-table tbody {
          border-bottom: none !important;
        }
        .mlt-table-container {
          border-bottom: none !important;
        }
        .mlt-table-container table {
          border-bottom: none !important;
        }
        .mlt-table-container tbody {
          border-bottom: none !important;
        }
        .mlt-table-container tbody tr:last-child {
          border-bottom: none !important;
          border: none !important;
        }
        .mlt-table-container tbody tr:last-child td {
          border-bottom: none !important;
          border: none !important;
        }
      `}</style>
      <div 
        className="mlt-table-container overflow-y-auto overflow-x-hidden -mx-4 sm:mx-0 rounded-none sm:rounded-2xl border-x-0 sm:border-x bg-slate-50"
        style={{ 
          backgroundColor: '#f8fafc',
          borderBottom: 'none',
          boxShadow: 'none'
        }}
      >
        <table className="mlt-table w-full text-sm border-collapse" style={{ tableLayout: 'fixed', backgroundColor: '#f8fafc', border: 'none', borderBottom: 'none' }}>
          <thead className="sticky top-0" style={{ 
            position: 'sticky', 
            top: 0, 
            zIndex: 25, 
            backgroundColor: '#f8fafc', 
            display: 'table-header-group'
          } as any}>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: 'none' }}>
              <th className="py-3 text-left font-normal" style={{ backgroundColor: '#f8fafc', width: '35px', paddingLeft: '0.5rem', paddingRight: '0.25rem', color: '#94a3b8' }}>#</th>
              <th className="py-3 text-left font-normal text-xs" style={{ backgroundColor: '#f8fafc', color: '#94a3b8', paddingLeft: '0.5rem', paddingRight: '1rem', width: 'auto' }}>Player</th>
              {showForm ? (
                <th className="px-4 py-3 text-left font-normal text-xs" style={{ backgroundColor: '#f8fafc', color: '#94a3b8' }}>Form</th>
              ) : (
                <>
                  <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8' }}>W</th>
                  <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8' }}>D</th>
                  <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8' }}>{isLateStartingLeague ? 'CP' : 'OCP'}</th>
                  {members.length >= 3 && <th className="py-3 text-center font-normal text-base" style={{ backgroundColor: '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8' }}>🦄</th>}
                  <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8' }}>PTS</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = r.user_id === currentUserId;
              const isLastRow = i === rows.length - 1;
              return (
                <tr 
                  key={r.user_id} 
                  className={isMe ? 'flash-user-row' : ''}
                  style={{
                    position: 'relative',
                    backgroundColor: '#f8fafc',
                    ...(isLastRow ? {} : { borderBottom: '1px solid #e2e8f0' })
                  }}
                >
                  <td className="py-4 text-left tabular-nums whitespace-nowrap relative" style={{ 
                    paddingLeft: '0.5rem', 
                    paddingRight: '0.25rem',
                    backgroundColor: '#f8fafc',
                    width: '35px'
                  }}>
                    {i + 1}
                  </td>
                  <td className="py-4 bg-slate-50 pl-0 pr-4" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-shrink-0">
                        <UserAvatar
                          userId={r.user_id}
                          name={r.name}
                          size={24}
                          className="border border-slate-200"
                          fallbackToInitials={true}
                        />
                      </div>
                      <span className="text-xs truncate min-w-0 whitespace-nowrap font-normal" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.name}
                      </span>
                    </div>
                  </td>
                  {showForm ? (
                    <td className="px-4 py-4 bg-slate-50">
                      <FormDisplay form={r.form} />
                    </td>
                  ) : (
                    <>
                      <td className="py-4 text-center tabular-nums bg-slate-50 w-[35px] pl-1 pr-1">{r.wins}</td>
                      <td className="py-4 text-center tabular-nums bg-slate-50 w-[35px] pl-1 pr-1">{r.draws}</td>
                      <td className="py-4 text-center tabular-nums bg-slate-50 w-10 pl-1 pr-1">{r.ocp}</td>
                      {members.length >= 3 && <td className="py-4 text-center tabular-nums bg-slate-50 w-[35px] pl-1 pr-1">{r.unicorns}</td>}
                      <td className="py-4 text-center tabular-nums font-bold text-[#1C8376] bg-slate-50 w-10 pl-1 pr-1">{r.mltPts}</td>
                    </>
                  )}
                </tr>
              );
            })}
            {loading && (
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <td className="px-4 py-6 text-slate-500 text-center" colSpan={showForm ? 3 : (members.length >= 3 ? 7 : 6)} style={{ backgroundColor: '#f8fafc' }}>
                  Calculating…
                </td>
              </tr>
            )}
            {!loading && !rows.length && (
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <td className="px-4 py-6 text-slate-500 text-center" colSpan={showForm ? 3 : (members.length >= 3 ? 7 : 6)} style={{ backgroundColor: '#f8fafc' }}>
                  No gameweeks completed yet — this will populate after the first results are saved.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

