/**
 * Previous Seasons — completed seasons only (OCP, overall rank, top %).
 * Mirrors app StatsPreviousSeasonsCard for playtotl.com/profile/stats.
 */
import { useMemo } from 'react';
import { supabase } from '../../lib/supabase';

export type SeasonArchiveStat = {
  seasonLabel: string;
  ocp: number | null;
  rank: number | null;
  rankedPlayers: number | null;
  topPercent: number | null;
  note?: string | null;
};

export type ClosedSeasonStandings = {
  ocp: number | null;
  rank: number | null;
  rankedPlayers: number | null;
  topPercent: number | null;
};

export async function fetchClosed2526Standings(userId: string): Promise<ClosedSeasonStandings> {
  const meRes = await supabase
    .from('app_v_ocp_overall')
    .select('user_id, ocp')
    .eq('user_id', userId)
    .maybeSingle();
  if (meRes.error) throw meRes.error;
  if (!meRes.data) return { ocp: null, rank: null, rankedPlayers: null, topPercent: null };

  const ocp = Math.round(Number((meRes.data as { ocp?: number }).ocp ?? 0));
  const [betterRes, totalRes] = await Promise.all([
    supabase.from('app_v_ocp_overall').select('user_id', { count: 'exact', head: true }).gt('ocp', ocp),
    supabase.from('app_v_ocp_overall').select('user_id', { count: 'exact', head: true }),
  ]);
  if (betterRes.error) throw betterRes.error;
  if (totalRes.error) throw totalRes.error;
  const better = betterRes.count ?? 0;
  const total = totalRes.count ?? 0;
  const rank = total > 0 ? better + 1 : null;
  const topPercent =
    rank != null && total > 0 ? Math.max(1, Math.min(99, Math.ceil((rank / total) * 100))) : null;
  return { ocp, rank, rankedPlayers: total || null, topPercent };
}

/** Build previous-season rows — completed seasons only (currently 2025/26). */
export function buildSeasonArchiveStats(args: {
  closed2526: ClosedSeasonStandings | null;
}): SeasonArchiveStat[] {
  const { closed2526 } = args;
  return [
    {
      seasonLabel: '2025/26',
      ocp: closed2526?.ocp ?? null,
      rank: closed2526?.rank ?? null,
      rankedPlayers: closed2526?.rankedPlayers ?? null,
      topPercent: closed2526?.topPercent ?? null,
      note:
        closed2526?.rank != null
          ? 'Final 2025/26 overall standing (season total correct predictions).'
          : 'No 2025/26 overall row found for your account yet.',
    },
  ];
}

function topLine(topPercent: number | null): string {
  if (typeof topPercent !== 'number' || Number.isNaN(topPercent)) return '—';
  return `Top ${Math.max(1, Math.min(99, Math.round(topPercent)))}%`;
}

function rankLine(rank: number | null, total: number | null): string {
  if (rank == null) return '—';
  if (total != null && total > 0) {
    return `${rank.toLocaleString()} of ${total.toLocaleString()}`;
  }
  return String(rank);
}

export function StatsPreviousSeasons({
  seasons,
  selectedLabel,
  onSelectLabel,
  loading = false,
}: {
  seasons: SeasonArchiveStat[];
  selectedLabel: string;
  onSelectLabel: (label: string) => void;
  loading?: boolean;
}) {
  const selected = useMemo(
    () => seasons.find((s) => s.seasonLabel === selectedLabel) ?? seasons[0] ?? null,
    [seasons, selectedLabel]
  );
  const canPickSeason = seasons.length > 1;

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 lg:col-span-2">
        <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
        <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
    );
  }

  if (!seasons.length || !selected) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 lg:col-span-2">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Previous Seasons</h2>
      <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
        Your finish for each completed season — OCP, overall place, and percentage.
      </p>

      {canPickSeason ? (
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Season</span>
          <select
            className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3.5 py-3 text-base font-bold text-slate-800 dark:text-slate-100"
            value={selected.seasonLabel}
            onChange={(e) => onSelectLabel(e.target.value)}
          >
            {seasons.map((s) => (
              <option key={s.seasonLabel} value={s.seasonLabel}>
                {s.seasonLabel}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3.5 py-3">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Season</div>
          <div className="mt-1 text-base font-bold text-slate-800 dark:text-slate-100">{selected.seasonLabel}</div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-700/80 p-3">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">OCP</div>
          <div className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">
            {selected.ocp == null ? '—' : Math.round(selected.ocp)}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-700/80 p-3">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Overall rank</div>
          <div className="mt-2 text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">
            {rankLine(selected.rank, selected.rankedPlayers)}
          </div>
        </div>
      </div>

      <div className="mt-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/80 p-3">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Finish</div>
        <div className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">
          {topLine(selected.topPercent)}
        </div>
        {selected.note ? (
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">{selected.note}</p>
        ) : null}
      </div>
    </div>
  );
}
