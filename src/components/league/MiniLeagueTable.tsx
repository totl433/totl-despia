import FormDisplay from './FormDisplay';

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
              <th className="py-3 text-left font-normal" style={{ backgroundColor: '#f8fafc', width: '30px', paddingLeft: '0.75rem', paddingRight: '0.5rem', color: '#94a3b8' }}>#</th>
              <th className="py-3 text-left font-normal text-xs" style={{ backgroundColor: '#f8fafc', color: '#94a3b8', paddingLeft: '0.5rem', paddingRight: '1rem' }}>Player</th>
              {showForm ? (
                <th className="px-4 py-3 text-left font-normal text-xs" style={{ backgroundColor: '#f8fafc', color: '#94a3b8' }}>Form</th>
              ) : (
                <>
                  <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8', fontSize: '0.75rem' }}>W</th>
                  <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8', fontSize: '0.75rem' }}>D</th>
                  <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8', fontSize: '0.75rem' }}>{isLateStartingLeague ? 'CP' : 'OCP'}</th>
                  {members.length >= 3 && <th className="py-3 text-center font-normal" style={{ backgroundColor: '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8', fontSize: '1rem' }}>🦄</th>}
                  <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8', fontSize: '0.75rem' }}>PTS</th>
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
                    paddingLeft: '0.75rem', 
                    paddingRight: '0.5rem',
                    backgroundColor: '#f8fafc',
                    width: '30px'
                  }}>
                    {i + 1}
                  </td>
                  <td className="py-4 truncate whitespace-nowrap bg-slate-50 pl-2 pr-4 overflow-hidden text-ellipsis">{r.name}</td>
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

