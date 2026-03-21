import type { Fixture, LiveScore, LiveStatus, Pick } from '@totl/domain';

import { TEAM_BADGES } from './teamBadges';

export type HeaderScoreSummary = {
  started: number;
  live: number;
  correct: number;
  total: number;
};

export function formatHeaderScoreLabel(summary: HeaderScoreSummary, live: boolean): string {
  return `${summary.correct}/${summary.total}`;
}

export type HeaderTickerEvent = {
  scorerName: string;
  minuteLabel: string;
  homeCode: string;
  awayCode: string;
  homeBadge: any;
  awayBadge: any;
  homeScore: string;
  awayScore: string;
  scoringSide: 'home' | 'away';
};

type GoalEvent = {
  team?: string | null;
  scorer?: string | null;
  minute?: number | null;
  isOwnGoal?: boolean | null;
};

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseGoals(raw: unknown): GoalEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((goal) => (goal && typeof goal === 'object' ? (goal as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((goal) => ({
      team: typeof goal?.team === 'string' ? goal.team : null,
      scorer: typeof goal?.scorer === 'string' ? goal.scorer : null,
      minute: typeof goal?.minute === 'number' ? goal.minute : null,
      isOwnGoal: typeof goal?.isOwnGoal === 'boolean' ? goal.isOwnGoal : null,
    }));
}

function getTickerScorerName(value: string | null | undefined): string {
  const full = String(value ?? '').trim();
  if (!full) return 'Unknown';
  const lower = full.toLowerCase();
  if (lower.includes('own goal') || lower.includes('(og)')) return full;
  const parts = full.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? full;
}

function determineScoringSide(goal: GoalEvent, fixture: Fixture): 'home' | 'away' {
  const goalTeam = normalize(goal.team);
  const homeCandidates = [
    fixture.home_code,
    fixture.home_name,
    fixture.home_team,
    TEAM_BADGES[String(fixture.home_code ?? '').toUpperCase()] ? fixture.home_code : null,
  ].map(normalize);
  const awayCandidates = [
    fixture.away_code,
    fixture.away_name,
    fixture.away_team,
    TEAM_BADGES[String(fixture.away_code ?? '').toUpperCase()] ? fixture.away_code : null,
  ].map(normalize);

  const matchesHome = goalTeam && homeCandidates.some((candidate) => candidate && (goalTeam.includes(candidate) || candidate.includes(goalTeam)));
  const matchesAway = goalTeam && awayCandidates.some((candidate) => candidate && (goalTeam.includes(candidate) || candidate.includes(goalTeam)));

  if (matchesHome && !matchesAway) return 'home';
  if (matchesAway && !matchesHome) return 'away';
  return 'away';
}

function parseUpdatedAtMs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function buildHeaderScoreSummary({
  fixtures,
  userPicks,
  liveByFixtureIndex,
  resultByFixtureIndex,
}: {
  fixtures: Fixture[];
  userPicks: Record<string, Pick | undefined>;
  liveByFixtureIndex: Map<number, LiveScore>;
  resultByFixtureIndex: Map<number, Pick>;
}): HeaderScoreSummary | null {
  if (!fixtures.length) return null;

  let started = 0;
  let live = 0;
  let correct = 0;

  for (const fixture of fixtures) {
    const fixtureIndex = fixture.fixture_index;
    const pick = userPicks[String(fixtureIndex)];

    const liveScore = liveByFixtureIndex.get(fixtureIndex);
    const status: LiveStatus = liveScore?.status ?? 'SCHEDULED';
    const finalResult = resultByFixtureIndex.get(fixtureIndex);
    const hasFinalResult = finalResult === 'H' || finalResult === 'D' || finalResult === 'A';
    const isStartedFromLive = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
    const isStarted = hasFinalResult || isStartedFromLive;

    if (!isStarted) continue;
    started += 1;

    if (status === 'IN_PLAY' || status === 'PAUSED') live += 1;
    if (!pick) continue;

    const outcome: Pick | null = hasFinalResult
      ? finalResult
      : typeof liveScore?.home_score === 'number' && typeof liveScore?.away_score === 'number'
        ? liveScore.home_score > liveScore.away_score
          ? 'H'
          : liveScore.home_score < liveScore.away_score
            ? 'A'
            : 'D'
        : null;

    if (outcome === pick) correct += 1;
  }

  return { started, live, correct, total: fixtures.length };
}

export function buildHeaderTickerEvent({
  fixtures,
  liveByFixtureIndex,
}: {
  fixtures: Fixture[];
  liveByFixtureIndex: Map<number, LiveScore>;
}): { tickerEvent: HeaderTickerEvent | null; tickerEventKey: string | null } {
  const fixtureByIndex = new Map<number, Fixture>();
  fixtures.forEach((fixture) => {
    fixtureByIndex.set(fixture.fixture_index, fixture);
  });

  const candidates = Array.from(liveByFixtureIndex.entries())
    .map(([fixtureIndex, liveScore]) => {
      const fixture = fixtureByIndex.get(fixtureIndex);
      if (!fixture) return null;

      const goals = parseGoals(liveScore.goals);
      const latestGoal = goals[goals.length - 1];
      if (!latestGoal) return null;

      return {
        fixture,
        liveScore,
        latestGoal,
        updatedAtMs: parseUpdatedAtMs(liveScore.updated_at ?? null),
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => {
      if (b.updatedAtMs !== a.updatedAtMs) return b.updatedAtMs - a.updatedAtMs;
      return Number(b.latestGoal.minute ?? -1) - Number(a.latestGoal.minute ?? -1);
    });

  const latest = candidates[0];
  if (!latest) return { tickerEvent: null, tickerEventKey: null };

  const { fixture, liveScore, latestGoal } = latest;
  const scoringSide = determineScoringSide(latestGoal, fixture);
  const homeCode = String(fixture.home_code ?? '').toUpperCase();
  const awayCode = String(fixture.away_code ?? '').toUpperCase();

  return {
    tickerEvent: {
      scorerName: getTickerScorerName(latestGoal.scorer),
      minuteLabel: typeof latestGoal.minute === 'number' ? `(${latestGoal.minute}')` : '',
      homeCode,
      awayCode,
      homeBadge: TEAM_BADGES[homeCode],
      awayBadge: TEAM_BADGES[awayCode],
      homeScore: String(liveScore.home_score ?? 0),
      awayScore: String(liveScore.away_score ?? 0),
      scoringSide,
    },
    tickerEventKey: [
      fixture.fixture_index,
      liveScore.updated_at ?? '',
      latestGoal.team ?? '',
      latestGoal.scorer ?? '',
      latestGoal.minute ?? '',
      liveScore.home_score ?? '',
      liveScore.away_score ?? '',
    ].join(':'),
  };
}

