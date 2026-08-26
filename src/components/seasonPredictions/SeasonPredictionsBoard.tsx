import ClubBadge from '../ClubBadge';
import {
  BOTTOM_POSITIONS,
  TOP_POSITIONS,
  clubName,
  getPositionClub,
  managerLabel,
  ordinalSuffix,
  type NamedSeasonPicks,
  type SeasonPredictionPicks,
  type SeasonPredictionScoreBreakdown,
  type TablePosition,
} from '../../lib/seasonPredictions';

function PointsChip({ pts }: { pts: number }) {
  const tone =
    pts >= 3
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : pts === 1
        ? 'bg-[#1C8376]/15 text-[#1C8376]'
        : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {pts}pt
    </span>
  );
}

function FactLine({
  question,
  answer,
  pts,
}: {
  question: string;
  answer: string;
  pts?: number;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="min-w-0">
        <div className="text-xs text-slate-500 dark:text-slate-400">{question}</div>
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{answer}</div>
      </div>
      {pts != null && <PointsChip pts={pts} />}
    </div>
  );
}

function TableSplit() {
  return (
    <div
      className="my-1.5 border-t-2 border-dotted border-slate-300 dark:border-slate-500"
      aria-hidden
    />
  );
}

function ClubLine({
  position,
  code,
  pts,
}: {
  position: TablePosition;
  code: string | null;
  pts?: number;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-8 shrink-0 text-slate-400">{position}{ordinalSuffix(position)}</span>
      {code ? <ClubBadge code={code} size={20} /> : <span className="w-5" />}
      <span className="flex-1 font-medium text-slate-900 dark:text-slate-100">{clubName(code)}</span>
      {pts != null && <PointsChip pts={pts} />}
    </div>
  );
}

/**
 * After-submit Season Predictions board.
 * Without official results: everyone's picks only.
 * With official results: standings, results, and points on each pick.
 */
export default function SeasonPredictionsBoard({
  entries,
  results,
  scores,
}: {
  entries: NamedSeasonPicks[];
  results: SeasonPredictionPicks | null;
  scores: Record<string, SeasonPredictionScoreBreakdown>;
}) {
  const hasResults = !!results;
  const ranked = hasResults
    ? [...entries].sort((a, b) => (scores[b.userId]?.total ?? 0) - (scores[a.userId]?.total ?? 0))
    : [...entries].sort((a, b) => a.name.localeCompare(b.name));

  if (ranked.length === 0) {
    return (
      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Everyone's picks</h2>
        <p className="text-sm text-slate-500 mt-2">No submitted picks yet.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {hasResults && (
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">The table</h2>
          {ranked.map((entry, index) => (
            <div key={entry.userId} className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {index + 1}. {entry.name}
              </span>
              <span className="text-[#1C8376] font-bold">{scores[entry.userId]?.total ?? 0} pts</span>
            </div>
          ))}
        </section>
      )}

      {hasResults && (
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Official results</h2>
          {TOP_POSITIONS.map((position) => (
            <div key={position} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="w-8 shrink-0 text-slate-400">{position}{ordinalSuffix(position)}</span>
              <ClubBadge code={getPositionClub(results, position) || ''} size={20} />
              <span>{clubName(getPositionClub(results, position))}</span>
            </div>
          ))}
          <TableSplit />
          {BOTTOM_POSITIONS.map((position) => (
            <div key={position} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="w-8 shrink-0 text-slate-400">{position}{ordinalSuffix(position)}</span>
              <ClubBadge code={getPositionClub(results, position) || ''} size={20} />
              <span>{clubName(getPositionClub(results, position))}</span>
            </div>
          ))}
          <div className="pt-2 space-y-1">
            <FactLine question="Haaland Premier League goals" answer={String(results.haalandGoals ?? '—')} />
            <FactLine question="First starting manager sacked" answer={managerLabel(results.firstManagerId)} />
            <FactLine question="Highest scorer (not Haaland)" answer={results.highestScorer || '—'} />
            <FactLine question="Most assists" answer={results.mostAssists || '—'} />
          </div>
        </section>
      )}

      {ranked.map((entry) => {
        const breakdown = hasResults ? scores[entry.userId] : undefined;
        return (
          <section key={entry.userId} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{entry.name}</h3>
              {hasResults && (
                <span className="text-[#1C8376] font-bold">{breakdown?.total ?? 0} pts</span>
              )}
            </div>
            {TOP_POSITIONS.map((position, index) => (
              <ClubLine
                key={position}
                position={position}
                code={getPositionClub(entry.picks, position)}
                pts={breakdown?.top[index]}
              />
            ))}
            <TableSplit />
            {BOTTOM_POSITIONS.map((position, index) => (
              <ClubLine
                key={position}
                position={position}
                code={getPositionClub(entry.picks, position)}
                pts={breakdown?.bottom[index]}
              />
            ))}
            <div className="pt-2 space-y-1 border-t border-slate-100 dark:border-slate-700">
              <FactLine
                question="Haaland Premier League goals"
                answer={entry.picks.haalandGoals == null ? '—' : String(entry.picks.haalandGoals)}
                pts={breakdown?.haalandGoals}
              />
              <FactLine
                question="First starting manager sacked"
                answer={managerLabel(entry.picks.firstManagerId)}
                pts={breakdown?.firstManager}
              />
              <FactLine
                question="Highest scorer (not Haaland)"
                answer={entry.picks.highestScorer || '—'}
                pts={breakdown?.highestScorer}
              />
              <FactLine
                question="Most assists"
                answer={entry.picks.mostAssists || '—'}
                pts={breakdown?.mostAssists}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
