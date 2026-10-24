/**
 * Stats hero / round-up GWs.
 * `lastCompletedGw` must already be scoped to the *active* season pile.
 * Do not pass a leftover prior-season max (e.g. 2025/26 GW38) when `metaGw` has reset.
 */
export function resolveStatsHeadlineGws(args: {
  lastCompletedGw: number | null;
  metaGw: number | null;
}): { lastCompletedGw: number | null; highlightGw: number | null } {
  const lastCompletedGw =
    typeof args.lastCompletedGw === 'number' && args.lastCompletedGw > 0 ? args.lastCompletedGw : null;
  const metaGw = typeof args.metaGw === 'number' && args.metaGw > 0 ? args.metaGw : null;

  if (lastCompletedGw != null && metaGw != null && lastCompletedGw > metaGw) {
    return { lastCompletedGw: null, highlightGw: metaGw };
  }

  const highlightGw =
    lastCompletedGw != null && metaGw != null ? Math.max(lastCompletedGw, metaGw) : lastCompletedGw ?? metaGw;
  return { lastCompletedGw, highlightGw };
}

/**
 * Trailing participation across season folders (oldest → newest).
 * Each folder is GW1..throughGw; a missing week breaks the run.
 */
export function countTrailingPlayedWeeks(
  seasons: ReadonlyArray<{ played: Iterable<number>; throughGw: number }>
): number {
  const flags: boolean[] = [];
  for (const season of seasons) {
    const through = Math.floor(Number(season.throughGw));
    if (!Number.isFinite(through) || through < 1) continue;
    const played = new Set<number>();
    for (const raw of season.played) {
      const gw = Number(raw);
      if (Number.isFinite(gw) && gw >= 1 && gw <= through) played.add(gw);
    }
    for (let gw = 1; gw <= through; gw++) flags.push(played.has(gw));
  }
  let streak = 0;
  for (let i = flags.length - 1; i >= 0; i--) {
    if (flags[i]) streak++;
    else break;
  }
  return streak;
}

export function playedGwSet(rows: Array<{ gw?: unknown } | null | undefined> | null | undefined): Set<number> {
  const out = new Set<number>();
  for (const row of rows ?? []) {
    const gw = Number(row?.gw);
    if (Number.isFinite(gw) && gw >= 1) out.add(gw);
  }
  return out;
}

/** True when max(results.gw) is leftover from a closed season after current_gw reset. */
export function isLeftoverPriorSeasonLastCompleted(
  lastCompletedGw: number | null | undefined,
  metaGw: number | null | undefined
): boolean {
  return (
    typeof lastCompletedGw === 'number' &&
    lastCompletedGw > 0 &&
    typeof metaGw === 'number' &&
    metaGw > 0 &&
    lastCompletedGw > metaGw
  );
}
