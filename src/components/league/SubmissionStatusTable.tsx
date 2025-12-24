import { openWhatsApp } from '../../lib/whatsappShare';

export interface SubmissionStatusTableProps {
  members: Array<{ id: string; name: string }>;
  submittedMap: Map<string, boolean>;
  picksGw: number;
  allSubmitted: boolean;
  remaining: number;
  fixtures: Array<{ gw: number; kickoff_time?: string | null }>;
  onShareReminder?: () => void;
  variant?: 'full' | 'compact'; // 'full' for showSubmissionStatus, 'compact' for shouldShowWhoSubmitted
}

// Helper function to generate share reminder message
export function generateShareReminderMessage(picksGw: number, fixtures: Array<{ gw: number; kickoff_time?: string | null }>): string {
  const firstKickoff = new Date(fixtures.find(f => f.gw === picksGw)?.kickoff_time || '');
  const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000));
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dayOfWeek = dayNames[deadlineTime.getUTCDay()];
  const day = deadlineTime.getUTCDate();
  const month = months[deadlineTime.getUTCMonth()];
  const hours = deadlineTime.getUTCHours().toString().padStart(2, '0');
  const minutes = deadlineTime.getUTCMinutes().toString().padStart(2, '0');
  return `Gameweek ${picksGw} Predictions Reminder!\n\nDEADLINE: THIS ${dayOfWeek} ${day} ${month}, ${hours}:${minutes} BST\n\nDon't forget!\nplaytotl.com`;
}

// Helper function to handle share reminder click
export function handleShareReminder(picksGw: number, fixtures: Array<{ gw: number; kickoff_time?: string | null }>) {
  const message = generateShareReminderMessage(picksGw, fixtures);
  openWhatsApp(message);
}

/**
 * SubmissionStatusTable - Shows who has/hasn't submitted predictions
 * Used in GW Picks tab when not all members have submitted
 */
export default function SubmissionStatusTable({
  members,
  submittedMap,
  picksGw,
  allSubmitted,
  remaining,
  fixtures,
  onShareReminder,
  variant = 'full',
}: SubmissionStatusTableProps) {
  const handleShare = onShareReminder || (() => handleShareReminder(picksGw, fixtures));
  
  // Calculate deadline from fixtures
  const kickoffTimes = fixtures
    .map(f => f.kickoff_time)
    .filter((kt): kt is string => !!kt)
    .map(kt => new Date(kt))
    .filter(d => !isNaN(d.getTime()));
  
  const firstKickoff = kickoffTimes.length > 0 
    ? new Date(Math.min(...kickoffTimes.map(d => d.getTime())))
    : null;
  
  const deadlineTime = firstKickoff 
    ? new Date(firstKickoff.getTime() - (75 * 60 * 1000))
    : null;
  
  const deadlinePassed = deadlineTime ? new Date() >= deadlineTime : false;
  
  // Format deadline
  let deadlineStr = '';
  if (deadlineTime) {
    const dayNames = variant === 'compact' 
      ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayOfWeek = dayNames[deadlineTime.getUTCDay()];
    const day = deadlineTime.getUTCDate();
    const month = months[deadlineTime.getUTCMonth()];
    const hours = deadlineTime.getUTCHours().toString().padStart(2, '0');
    const minutes = deadlineTime.getUTCMinutes().toString().padStart(2, '0');
    deadlineStr = `${dayOfWeek} ${day} ${month}, ${hours}:${minutes} BST`;
  }

  if (variant === 'compact') {
    return (
      <div className="mt-2 pt-2">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-700">
            <>Waiting for <span className="font-semibold">{remaining}</span> of {members.length} to submit.</>
          </div>
          {!allSubmitted && (
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
              </svg>
              Share Reminder
            </button>
          )}
        </div>

        {deadlineStr && (
          <div className={`mb-3 text-xs font-medium ${deadlinePassed ? 'text-orange-600' : 'text-slate-600'} flex items-center gap-1.5`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {deadlinePassed ? 'Deadline Passed: ' : 'Deadline: '}{deadlineStr}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 w-2/3 font-semibold text-slate-600">Player</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {members
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((m) => {
                  const key = `${m.id}:${picksGw}`;
                  const submitted = !!submittedMap.get(key);
                  return (
                    <tr key={m.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-bold text-slate-900 truncate whitespace-nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</td>
                      <td className="px-4 py-3">
                        {submitted ? (
                          <span className="inline-flex items-center gap-1.5 justify-center rounded-full bg-[#1C8376]/10 text-[#1C8376]/90 text-xs px-2.5 py-1 border border-emerald-300 font-bold shadow-sm whitespace-nowrap w-24">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 justify-center rounded-full bg-amber-50 text-amber-700 text-xs px-2.5 py-1 border border-amber-200 font-semibold whitespace-nowrap w-24">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Not yet
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-700">
      <div className="mb-3 flex items-center justify-between">
        <div>
          {allSubmitted ? (
            <>All {members.length} members have submitted.</>
          ) : (
            <>Waiting for <span className="font-semibold">{remaining}</span> of {members.length} to submit.</>
          )}
        </div>
        {!allSubmitted && (
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
          </svg>
          Share Reminder
        </button>
        )}
      </div>

      {deadlineStr && (
        <div className={`mb-3 text-sm ${deadlinePassed ? 'text-orange-600 font-semibold' : 'text-slate-600'}`}>
          {deadlinePassed ? '⏰ Deadline Passed: ' : '⏰ Deadline: '}{deadlineStr}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 w-2/3 font-semibold text-slate-600">Player</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {members
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((m) => {
                const key = `${m.id}:${picksGw}`;
                const submitted = !!submittedMap.get(key);
                return (
                  <tr key={m.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-bold text-slate-900 truncate whitespace-nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</td>
                    <td className="px-4 py-3">
                      {submitted ? (
                        <span className="inline-flex items-center justify-center rounded-full bg-[#1C8376]/10 text-[#1C8376]/90 text-xs px-2 py-1 border border-emerald-300 font-bold shadow-sm whitespace-nowrap w-24">
                          ✅ Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-full bg-amber-50 text-amber-700 text-xs px-2 py-1 border border-amber-200 font-semibold whitespace-nowrap w-24">
                          ⏳ Not yet
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
