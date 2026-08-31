import FormDisplay from './FormDisplay';
import UserAvatar from '../UserAvatar';
import { assignCompetitionRanks, formatCompetitionRank } from '../../lib/competitionRanks';

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
 * Spacing/chrome matched to ResultsTable (GW table).
 */
export default function MiniLeagueTable({
  rows,
  members,
  showForm,
  currentUserId,
  loading,
  isLateStartingLeague,
}: MiniLeagueTableProps) {
  const ranked = assignCompetitionRanks(
    rows,
    (a, b) => a.mltPts === b.mltPts && a.unicorns === b.unicorns && a.ocp === b.ocp
  );

  return (
    <div>
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
              <th className="pt-3 pb-2 text-left font-normal" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', width: '35px', paddingLeft: '0.5rem', paddingRight: '0.25rem', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8' }}>#</th>
              <th className="pt-3 pb-2 text-left font-normal text-xs" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8', paddingLeft: '0.5rem', paddingRight: '1rem', width: 'auto' }}>Player</th>
              {showForm ? (
                <th className="px-4 pt-3 pb-2 text-left font-normal text-xs" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8' }}>Form</th>
              ) : (
                <>
                  <th className="pt-3 pb-2 text-center font-normal text-xs" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8' }}>W</th>
                  <th className="pt-3 pb-2 text-center font-normal text-xs" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8' }}>D</th>
                  <th className="pt-3 pb-2 text-center font-normal text-xs" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8' }}>{isLateStartingLeague ? 'CP' : 'OCP'}</th>
                  {members.length >= 3 && <th className="pt-3 pb-2 text-center font-normal text-base" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8' }}>🦄</th>}
                  <th className="pt-3 pb-2 text-center font-normal text-xs" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#94a3b8' }}>PTS</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = r.user_id === currentUserId;
              const isLastRow = i === rows.length - 1;
              const standing = ranked[i] ?? { rank: null, tied: false };
              return (
                <tr
                  key={r.user_id}
                  className={isMe ? 'flash-user-row' : ''}
                  style={{
                    position: 'relative',
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc',
                    ...(isLastRow ? {} : { borderBottom: document.documentElement.classList.contains('dark') ? '1px solid #334155' : '1px solid #e2e8f0' })
                  }}
                >
                  <td className="pt-2.5 pb-3 text-left tabular-nums whitespace-nowrap relative text-slate-900 dark:text-slate-100" style={{
                    paddingLeft: '0.5rem',
                    paddingRight: '0.25rem',
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc',
                    width: '35px'
                  }}>
                    {formatCompetitionRank(standing.rank, standing.tied)}
                  </td>
                  <td className="pt-2.5 pb-3" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc', paddingLeft: '0.5rem', paddingRight: '1rem' }}>
                    <div className="flex items-center gap-1.5">
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
                  {showForm ? (
                    <td className="px-4 pt-2.5 pb-3" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>
                      <FormDisplay form={r.form} />
                    </td>
                  ) : (
                    <>
                      <td className="pt-2.5 pb-3 text-center tabular-nums text-slate-900 dark:text-slate-100 w-[35px] pl-1 pr-1" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>{r.wins}</td>
                      <td className="pt-2.5 pb-3 text-center tabular-nums text-slate-900 dark:text-slate-100 w-[35px] pl-1 pr-1" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>{r.draws}</td>
                      <td className="pt-2.5 pb-3 text-center tabular-nums text-slate-900 dark:text-slate-100 w-10 pl-1 pr-1" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>{r.ocp}</td>
                      {members.length >= 3 && <td className="pt-2.5 pb-3 text-center tabular-nums text-slate-900 dark:text-slate-100 w-[35px] pl-1 pr-1" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>{r.unicorns}</td>}
                      <td className="pt-2.5 pb-3 text-center tabular-nums font-bold text-[#1C8376] w-10 pl-1 pr-1" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>{r.mltPts}</td>
                    </>
                  )}
                </tr>
              );
            })}
            {loading && (
              <tr style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>
                <td className="px-4 py-6 text-slate-500 dark:text-slate-400 text-center" colSpan={showForm ? 3 : (members.length >= 3 ? 7 : 6)} style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>
                  Calculating…
                </td>
              </tr>
            )}
            {!loading && !rows.length && (
              <tr style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>
                <td className="px-4 py-6 text-slate-500 dark:text-slate-400 text-center" colSpan={showForm ? 3 : (members.length >= 3 ? 7 : 6)} style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc' }}>
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
