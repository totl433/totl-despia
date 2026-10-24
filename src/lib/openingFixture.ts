export type FixtureKickoff = {
  fixture_index: number;
  kickoff_time: string | null | undefined;
};

/**
 * The "opening game" is the earliest kickoff in a gameweek when that slot is
 * solo (Friday night, or Sat 12:30 before the main batch). If multiple fixtures
 * share the earliest kickoff, there is no opening game.
 */
export function getOpeningFixtureIndex(fixtures: FixtureKickoff[]): number | null {
  const withTime = fixtures
    .map((f) => {
      if (!f.kickoff_time) return null;
      const t = new Date(f.kickoff_time).getTime();
      if (Number.isNaN(t)) return null;
      return { fixture_index: f.fixture_index, t };
    })
    .filter((x): x is { fixture_index: number; t: number } => x !== null);

  if (withTime.length === 0) return null;

  withTime.sort((a, b) => a.t - b.t || a.fixture_index - b.fixture_index);
  const earliest = withTime[0]!.t;
  const atEarliest = withTime.filter((f) => f.t === earliest);
  if (atEarliest.length !== 1) return null;
  return atEarliest[0]!.fixture_index;
}

/**
 * Map gw -> opening fixture_index for a season's fixture list.
 */
export function buildOpeningFixtureIndexByGw(
  fixtures: Array<{ gw: number; fixture_index: number; kickoff_time: string | null | undefined }>
): Map<number, number> {
  const byGw = new Map<number, FixtureKickoff[]>();
  fixtures.forEach((f) => {
    const list = byGw.get(f.gw) ?? [];
    list.push({ fixture_index: f.fixture_index, kickoff_time: f.kickoff_time });
    byGw.set(f.gw, list);
  });

  const out = new Map<number, number>();
  byGw.forEach((list, gw) => {
    const idx = getOpeningFixtureIndex(list);
    if (idx !== null) out.set(gw, idx);
  });
  return out;
}
