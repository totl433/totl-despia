import UserAvatar from '../UserAvatar';
import type { SeasonPredictionPlayerStatus } from '../../lib/seasonPredictions';

/**
 * Waiting room after submit: who is in, whose picks are still outstanding.
 * Usage: <SeasonPredictionsLobby players={status} />
 */
export default function SeasonPredictionsLobby({
  players,
}: {
  players: SeasonPredictionPlayerStatus[];
}) {
  const remaining = players.filter((player) => !player.submitted).length;

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Who’s in</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {remaining === 0
            ? 'Everyone has submitted. Picks are unlocked.'
            : `Waiting for ${remaining} of ${players.length} to submit. Picks stay hidden until all four are in.`}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <ul>
          {players.map((player, index) => (
            <li
              key={player.userId}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                index > 0 ? 'border-t border-slate-200 dark:border-slate-700' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar
                  userId={player.userId}
                  name={player.name}
                  size={24}
                  className="flex-shrink-0"
                  fallbackToInitials
                />
                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {player.name}
                </span>
              </div>
              {player.submitted ? (
                <span className="inline-flex items-center gap-1.5 justify-center rounded-full bg-[#1C8376]/10 text-[#1C8376] text-xs px-2.5 py-1 border border-emerald-300 font-bold whitespace-nowrap w-24">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Submitted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200 text-xs px-2.5 py-1 border border-amber-200 dark:border-amber-800 font-semibold whitespace-nowrap w-24">
                  Not yet
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
