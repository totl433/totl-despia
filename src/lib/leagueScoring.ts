export type LeagueScoringMember = { id: string; name: string };
export type LeagueScoringPick = { user_id: string; gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' };
export type LeagueScoringResultRow = {
  gw: number;
  fixture_index: number;
  result?: 'H' | 'D' | 'A' | null;
  home_goals?: number | null;
  away_goals?: number | null;
};

export type LeagueLiveScoresByFixtureIndex = Record<
  number,
  { homeScore: number; awayScore: number; status: string; minute?: number | null }
>;

export type GwTableResultRow = {
  user_id: string;
  name: string;
  score: number;
  unicorns: number;
};

function rowToOutcome(r: LeagueScoringResultRow): 'H' | 'D' | 'A' | null {
  if (r.result === 'H' || r.result === 'D' || r.result === 'A') return r.result;
  if (typeof r.home_goals === 'number' && typeof r.away_goals === 'number') {
    if (r.home_goals > r.away_goals) return 'H';
    if (r.home_goals < r.away_goals) return 'A';
    return 'D';
  }
  return null;
}

interface ComputeGwTableRowsProps {
  members: LeagueScoringMember[];
  picks: LeagueScoringPick[];
  results: LeagueScoringResultRow[];
  liveScores: LeagueLiveScoresByFixtureIndex;
  resGw: number;
  currentGw: number | null;
  isApiTestLeague: boolean;
  currentTestGw: number | null;
}

/**
 * Computes the rows for the GW Results Table (pure function).
 */
export function computeGwTableRows({
  members,
  picks,
  results,
  liveScores,
  resGw,
  currentGw,
  isApiTestLeague,
  currentTestGw,
}: ComputeGwTableRowsProps): GwTableResultRow[] {
  const outcomes = new Map<number, 'H' | 'D' | 'A'>();

  const useLiveScoresForOutcomes = isApiTestLeague
    ? resGw === currentTestGw
    : resGw === currentGw && Object.keys(liveScores).length > 0;

  if (useLiveScoresForOutcomes) {
    Object.entries(liveScores).forEach(([idxStr, live]) => {
      const idx = Number(idxStr);
      if (!Number.isFinite(idx)) return;
      if (live.status !== 'IN_PLAY' && live.status !== 'PAUSED' && live.status !== 'FINISHED') return;
      if (live.homeScore > live.awayScore) outcomes.set(idx, 'H');
      else if (live.awayScore > live.homeScore) outcomes.set(idx, 'A');
      else outcomes.set(idx, 'D');
    });
  } else {
    results.forEach((r) => {
      if (r.gw !== resGw) return;
      const out = rowToOutcome(r);
      if (!out) return;
      outcomes.set(r.fixture_index, out);
    });
  }

  const rows: GwTableResultRow[] = members.map((m) => ({
    user_id: m.id,
    name: m.name,
    score: 0,
    unicorns: 0,
  }));

  const picksByFixture = new Map<number, LeagueScoringPick[]>();
  picks.forEach((p) => {
    if (p.gw !== resGw) return;
    const arr = picksByFixture.get(p.fixture_index) ?? [];
    arr.push(p);
    picksByFixture.set(p.fixture_index, arr);
  });

  Array.from(outcomes.entries()).forEach(([idx, out]) => {
    const these = picksByFixture.get(idx) ?? [];
    const correctIds = these.filter((p) => p.pick === out).map((p) => p.user_id);

    correctIds.forEach((uid) => {
      const r = rows.find((x) => x.user_id === uid);
      if (r) r.score += 1;
    });

    if (correctIds.length === 1 && members.length >= 3) {
      const r = rows.find((x) => x.user_id === correctIds[0]);
      if (r) r.unicorns += 1;
    }
  });

  rows.sort(
    (a, b) => b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name)
  );

  return rows;
}

