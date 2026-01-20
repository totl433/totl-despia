export type GameweekState = 'GW_OPEN' | 'GW_PREDICTED' | 'DEADLINE_PASSED' | 'LIVE' | 'RESULTS_PRE_GW';

const DEADLINE_BUFFER_MINUTES = 75;

type FixtureKickoff = { kickoff_time?: string | null };
type LiveScoreLike = { status?: string | null; kickoff_time?: string | null };

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
  const fixtures = [...(input.fixtures ?? [])]
    .map((f) => ({ kickoff: parseDateSafe(f.kickoff_time) }))
    .filter((x): x is { kickoff: Date } => !!x.kickoff)
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

  if (fixtures.length === 0) return input.hasSubmittedViewingGw ? 'GW_PREDICTED' : 'GW_OPEN';

  const firstKickoff = fixtures[0]!.kickoff;
  const deadlineTime = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);

  const deadlinePassed = now >= deadlineTime;
  const firstGameStarted = now >= firstKickoff;

  if (!firstGameStarted) {
    if (deadlinePassed) return 'DEADLINE_PASSED';
    return input.hasSubmittedViewingGw ? 'GW_PREDICTED' : 'GW_OPEN';
  }

  const liveScores = input.liveScores ?? [];
  const hasActiveGame = liveScores.some((ls) => ls?.status === 'IN_PLAY' || ls?.status === 'PAUSED');

  // If there are no active games and at least one finished, treat as RESULTS_PRE_GW.
  // (We don't have full fixture->live coverage client-side, so this is a conservative approximation.)
  const hasAnyFinished = liveScores.some((ls) => ls?.status === 'FINISHED');
  if (!hasActiveGame && hasAnyFinished) return 'RESULTS_PRE_GW';

  return 'LIVE';
}

