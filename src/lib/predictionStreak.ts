import { SEASON_LAST_GW } from './leaderboardMonths';

export type CareerSeason = 'previous' | 'current';

export type CareerMark = {
  gw: number;
  season: CareerSeason;
  points: number | null;
  played: boolean;
};

export type StreakBar = {
  gw: number;
  score: number | null;
  season: CareerSeason;
};

/**
 * Build a career timeline: previous season GW1–38, then current season GW1–currentGw.
 * GW numbers collide across seasons, so callers must key by season + gw.
 */
export function buildCareerMarks(input: {
  currentGw: number;
  previousLastGw?: number;
  currentPointsByGw: Map<number, number>;
  currentSubmitted: Set<number>;
  previousPointsByGw: Map<number, number>;
  previousSubmitted: Set<number>;
}): CareerMark[] {
  const previousLastGw = input.previousLastGw ?? SEASON_LAST_GW;
  const marks: CareerMark[] = [];

  for (let gw = 1; gw <= previousLastGw; gw++) {
    const points = input.previousPointsByGw.has(gw)
      ? input.previousPointsByGw.get(gw) ?? 0
      : null;
    marks.push({
      gw,
      season: 'previous',
      points,
      played: points !== null || input.previousSubmitted.has(gw),
    });
  }

  const currentEnd = Math.max(0, input.currentGw);
  for (let gw = 1; gw <= currentEnd; gw++) {
    const points = input.currentPointsByGw.has(gw)
      ? input.currentPointsByGw.get(gw) ?? 0
      : null;
    marks.push({
      gw,
      season: 'current',
      points,
      played: points !== null || input.currentSubmitted.has(gw),
    });
  }

  return marks;
}

/**
 * Consecutive played weeks from the end of the career timeline.
 * A trailing unplayed current-season GW is skipped so an open week does not reset the streak.
 */
export function countCareerStreak(
  marks: CareerMark[],
  skipTrailingUnplayedCurrent = true
): number {
  let end = marks.length - 1;
  if (skipTrailingUnplayedCurrent) {
    while (end >= 0 && marks[end].season === 'current' && !marks[end].played) {
      end -= 1;
    }
  }

  let streak = 0;
  for (let i = end; i >= 0; i--) {
    if (!marks[i].played) break;
    streak += 1;
  }
  return streak;
}

/**
 * Last 10 bars on the streak card.
 * New players (no previous-season play) only see the current season.
 * Veterans keep the full previous-season gaps so a missed week still shows.
 */
export function last10CareerScores(marks: CareerMark[]): StreakBar[] {
  const hasPreviousPlay = marks.some((mark) => mark.season === 'previous' && mark.played);
  const forBars = hasPreviousPlay
    ? marks
    : marks.filter((mark) => mark.season === 'current');

  return forBars.slice(-10).map((mark) => ({
    gw: mark.gw,
    score: mark.played ? mark.points : null,
    season: mark.season,
  }));
}

export function computeCareerStreak(input: {
  currentGw: number;
  previousLastGw?: number;
  currentPointsByGw: Map<number, number>;
  currentSubmitted: Set<number>;
  previousPointsByGw: Map<number, number>;
  previousSubmitted: Set<number>;
}): { streak: number; last10GwScores: StreakBar[] } {
  const marks = buildCareerMarks(input);
  return {
    streak: countCareerStreak(marks),
    last10GwScores: last10CareerScores(marks),
  };
}
