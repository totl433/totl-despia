/** Matches BFF `rankUserInGwLiveScores` / Global GW live table (ties share rank 1). */
export function rankUserInGwLiveScores(
  userId: string,
  rows: Array<{ user_id: string; score: number }>
): number | null {
  if (!rows.length) return null;
  const uid = String(userId).toLowerCase();
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.user_id.localeCompare(b.user_id));
  let currentRank = 1;
  for (let idx = 0; idx < sorted.length; idx++) {
    const p = sorted[idx]!;
    if (idx > 0 && sorted[idx - 1]!.score !== p.score) currentRank = idx + 1;
    if (String(p.user_id).toLowerCase() === uid) return currentRank;
  }
  return null;
}
