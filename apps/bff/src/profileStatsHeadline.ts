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
