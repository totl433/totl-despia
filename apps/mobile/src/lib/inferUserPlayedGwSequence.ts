/**
 * Gameweeks where `userId` has a row in `app_v_gw_points` (picked / has points for that GW).
 * Sorted ascending.
 */
export function inferUserPlayedGwSequence(
  rows: { user_id: string; gw: number }[],
  userId: string
): number[] {
  const uid = String(userId).toLowerCase();
  const s = new Set<number>();
  for (const r of rows) {
    if (String(r.user_id).toLowerCase() !== uid) continue;
    const gw = Number(r.gw);
    if (Number.isFinite(gw) && gw > 0) s.add(gw);
  }
  return [...s].sort((a, b) => a - b);
}
