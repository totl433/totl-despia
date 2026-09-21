/**
 * Competition ranks (1224): tied standings share a rank; next rank skips.
 * Example: equal top two → both rank 1 (tied); third place is 3.
 */

export type CompetitionRank = {
  rank: number | null;
  tied: boolean;
};

export function formatCompetitionRank(rank: number | null, tied: boolean): string {
  if (rank == null) return '—';
  return tied ? `${rank}=` : `${rank}`;
}

/**
 * Assign competition ranks for a pre-sorted list.
 * @param isSameStanding - true when two rows share the same standing (should display as tied)
 * @param isRanked - false → no rank shown (e.g. did not submit)
 */
export function assignCompetitionRanks<T>(
  items: readonly T[],
  isSameStanding: (a: T, b: T) => boolean,
  isRanked: (item: T) => boolean = () => true
): CompetitionRank[] {
  const out: CompetitionRank[] = [];
  let currentRank = 1;
  let scoredIndex = 0;
  let prevRanked: T | undefined;

  for (let i = 0; i < items.length; i++) {
    const cur = items[i]!;
    if (!isRanked(cur)) {
      out.push({ rank: null, tied: false });
      continue;
    }

    if (prevRanked !== undefined && !isSameStanding(prevRanked, cur)) {
      currentRank = scoredIndex + 1;
    }

    let prevSame = false;
    for (let j = i - 1; j >= 0; j--) {
      const cand = items[j]!;
      if (!isRanked(cand)) continue;
      prevSame = isSameStanding(cand, cur);
      break;
    }
    let nextSame = false;
    for (let j = i + 1; j < items.length; j++) {
      const cand = items[j]!;
      if (!isRanked(cand)) continue;
      nextSame = isSameStanding(cand, cur);
      break;
    }

    out.push({ rank: currentRank, tied: prevSame || nextSame });
    prevRanked = cur;
    scoredIndex += 1;
  }

  return out;
}
