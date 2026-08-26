import ClubBadge from '../ClubBadge';
import {
  BOTTOM_POSITIONS,
  SEASON_PREDICTION_CLUBS,
  SEASON_PREDICTION_MANAGERS,
  TOP_POSITIONS,
  getPositionClub,
  managerLabel,
  ordinalSuffix,
  setPositionClub,
  usedClubCodes,
  type SeasonPredictionPicks,
  type TablePosition,
} from '../../lib/seasonPredictions';

const selectClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100';
const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100';

function ClubSelect({
  value,
  used,
  locked,
  onChange,
}: {
  value: string | null;
  used: string[];
  locked: boolean;
  onChange: (code: string | null) => void;
}) {
  return (
    <select
      className={selectClass}
      value={value ?? ''}
      disabled={locked}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">Select club</option>
      {SEASON_PREDICTION_CLUBS.map((club) => (
        <option key={club.code} value={club.code} disabled={used.includes(club.code)}>
          {club.name}
        </option>
      ))}
    </select>
  );
}

function PositionRow({
  position,
  picks,
  locked,
  onChange,
}: {
  position: TablePosition;
  picks: SeasonPredictionPicks;
  locked: boolean;
  onChange: (next: SeasonPredictionPicks) => void;
}) {
  const code = getPositionClub(picks, position);
  return (
    <label className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-sm font-semibold text-slate-500 dark:text-slate-400">
        {position}{ordinalSuffix(position)}
      </span>
      {code ? <ClubBadge code={code} size={22} /> : <span className="w-[22px]" />}
      <div className="flex-1">
        <ClubSelect
          value={code}
          used={usedClubCodes(picks, position)}
          locked={locked}
          onChange={(next) => onChange(setPositionClub(picks, position, next))}
        />
      </div>
    </label>
  );
}

/**
 * Season Predictions entry form. Drafts can be incomplete; Submit uses full validation in the page.
 */
export default function SeasonPredictionsForm({
  picks,
  locked,
  onChange,
  showScoringHints = true,
}: {
  picks: SeasonPredictionPicks;
  locked: boolean;
  onChange: (next: SeasonPredictionPicks) => void;
  showScoringHints?: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Top 6</h2>
        {showScoringHints && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            1 point if the club finishes in the top 6, 3 points if you also have the right position.
          </p>
        )}
        {TOP_POSITIONS.map((position) => (
          <PositionRow key={position} position={position} picks={picks} locked={locked} onChange={onChange} />
        ))}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Bottom 3</h2>
        {showScoringHints && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Same scoring as the top 6, for 18th, 19th and 20th. Clubs cannot be used twice.
          </p>
        )}
        {BOTTOM_POSITIONS.map((position) => (
          <PositionRow key={position} position={position} picks={picks} locked={locked} onChange={onChange} />
        ))}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Players and manager</h2>
        {showScoringHints && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            1 point for the closest Haaland goals guess, or for a correct name. Ties get 1 each.
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Haaland Premier League goals</span>
          <input
            type="number"
            min={0}
            step={1}
            className={inputClass}
            value={picks.haalandGoals ?? ''}
            disabled={locked}
            onChange={(event) =>
              onChange({
                ...picks,
                haalandGoals: event.target.value === '' ? null : Number(event.target.value),
              })
            }
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">First starting manager sacked</span>
          <select
            className={selectClass}
            value={picks.firstManagerId ?? ''}
            disabled={locked}
            onChange={(event) => onChange({ ...picks, firstManagerId: event.target.value || null })}
          >
            <option value="">Select manager</option>
            {SEASON_PREDICTION_MANAGERS.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {managerLabel(manager.id)}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Highest scorer (not Haaland)</span>
          <input
            type="text"
            className={inputClass}
            value={picks.highestScorer}
            disabled={locked}
            placeholder="Player name"
            onChange={(event) => onChange({ ...picks, highestScorer: event.target.value })}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Most assists</span>
          <input
            type="text"
            className={inputClass}
            value={picks.mostAssists}
            disabled={locked}
            placeholder="Player name"
            onChange={(event) => onChange({ ...picks, mostAssists: event.target.value })}
          />
        </label>
      </section>
    </div>
  );
}
