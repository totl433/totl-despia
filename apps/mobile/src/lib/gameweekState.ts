export type GameweekState = 'GW_OPEN' | 'GW_PREDICTED' | 'DEADLINE_PASSED' | 'LIVE' | 'RESULTS_PRE_GW';

const DEADLINE_BUFFER_MINUTES = 75;

type FixtureKickoff = { kickoff_time?: string | null; fixture_index?: number | null; api_match_id?: number | null };
type LiveScoreLike = { status?: string | null; kickoff_time?: string | null; fixture_index?: number | null; api_match_id?: number | null };

function parseDateSafe(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Minimal on-device gameweek state inference using already-fetched Home data.
 * This avoids extra DB/BFF calls and is sufficient for UI toggles.
 */
export function getGameweekStateFromSnapshot(input: {
  fixtures: FixtureKickoff[];
  liveScores: LiveScoreLike[];
  hasSubmittedViewingGw: boolean;
  now?: Date;
}): GameweekState {
  const now = input.now ?? new Date();
  const fixtures = [...(input.fixtures ?? [])].map((f) => ({
    kickoff: parseDateSafe(f.kickoff_time),
    fixture_index: typeof f.fixture_index === 'number' ? f.fixture_index : null,
    api_match_id: typeof f.api_match_id === 'number' ? f.api_match_id : null,
  }));

  const fixturesWithKickoff = fixtures
    .filter((x): x is { kickoff: Date; fixture_index: number | null; api_match_id: number | null } => !!x.kickoff)
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

  if (fixturesWithKickoff.length === 0) return input.hasSubmittedViewingGw ? 'GW_PREDICTED' : 'GW_OPEN';

  const firstKickoff = fixturesWithKickoff[0]!.kickoff;
  const deadlineTime = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);

  const deadlinePassed = now >= deadlineTime;
  const firstGameStarted = now >= firstKickoff;

  if (!firstGameStarted) {
    if (deadlinePassed) return 'DEADLINE_PASSED';
    return input.hasSubmittedViewingGw ? 'GW_PREDICTED' : 'GW_OPEN';
  }

  const liveScores = input.liveScores ?? [];
  const hasActiveGame = liveScores.some((ls) => ls?.status === 'IN_PLAY' || ls?.status === 'PAUSED');

  // Match Despia/web logic:
  // GW is finished only when the LAST fixture (by kickoff time) is FINISHED in live_scores AND there are no active games.
  const lastFixtureByKickoff = fixturesWithKickoff[fixturesWithKickoff.length - 1] ?? null;
  const lastFixtureIndex = lastFixtureByKickoff?.fixture_index ?? null;
  const lastApiMatchId = lastFixtureByKickoff?.api_match_id ?? null;

  const lastGameLiveScore =
    typeof lastFixtureIndex === 'number'
      ? liveScores.find((ls) => ls?.fixture_index === lastFixtureIndex) ?? null
      : typeof lastApiMatchId === 'number'
        ? liveScores.find((ls) => ls?.api_match_id === lastApiMatchId) ?? null
        : null;

  const lastGameFinished = lastGameLiveScore?.status === 'FINISHED';

  if (!hasActiveGame && lastGameFinished) return 'RESULTS_PRE_GW';

  return 'LIVE';
}

