import { formatSeasonPredictionsDeadlineDate, formatSeasonPredictionsDeadlineTime } from '../../lib/seasonPredictions';

/**
 * Prominent Season Predictions deadline at the top of the page.
 * Usage: <SeasonPredictionsDeadline variant="open" />
 */
export default function SeasonPredictionsDeadline({
  variant = 'open',
}: {
  variant?: 'open' | 'locked' | 'passed';
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4">
      <div className="flex items-start gap-3">
        <svg
          className="w-6 h-6 shrink-0 text-amber-700 dark:text-amber-300 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
            {variant === 'passed' ? 'Deadline passed' : 'Deadline'}
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight mt-0.5">
            {formatSeasonPredictionsDeadlineDate()}
          </div>
          <div className="text-base font-semibold text-slate-800 dark:text-slate-200">
            {formatSeasonPredictionsDeadlineTime()}
          </div>
          {variant === 'open' && (
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Save a draft as you go, then Submit once — that locks it. Picks stay hidden until everyone has submitted.
            </p>
          )}
          {variant === 'locked' && (
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Your picks are locked. Everyone’s picks stay hidden until all four have submitted.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
