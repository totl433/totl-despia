import { countTrailingGameweekParticipationStreak, type GameweekStreakRow } from './gameweekStreakCount';

function rowsThrough(played: Set<number>, throughGw: number, seasonLabel: string): GameweekStreakRow[] {
  const through = Math.floor(throughGw);
  if (!Number.isFinite(through) || through < 1) return [];
  const rows: GameweekStreakRow[] = [];
  for (let gw = 1; gw <= through; gw++) {
    rows.push({ gw, points: played.has(gw) ? 1 : null, seasonLabel });
  }
  return rows;
}

export function mergeProfileCareerTotals(args: {
  priorOcp: number;
  seasonOcp: number;
  priorPlayed: Iterable<number>;
  priorThroughGw: number;
  seasonPlayed: Iterable<number>;
  seasonThroughGw: number;
}): { ocp: number; weeksStreak: number } {
  const prior = new Set<number>();
  for (const gw of args.priorPlayed) {
    const n = Number(gw);
    if (Number.isFinite(n) && n >= 1) prior.add(n);
  }
  const season = new Set<number>();
  for (const gw of args.seasonPlayed) {
    const n = Number(gw);
    if (Number.isFinite(n) && n >= 1) season.add(n);
  }
  const rows = [
    ...rowsThrough(prior, args.priorThroughGw, '2025/26'),
    ...rowsThrough(season, args.seasonThroughGw, '2026/27'),
  ];
  return {
    ocp: Number(args.priorOcp || 0) + Number(args.seasonOcp || 0),
    weeksStreak: countTrailingGameweekParticipationStreak(rows),
  };
}
