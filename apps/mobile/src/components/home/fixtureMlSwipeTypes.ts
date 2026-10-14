import type { LeaguePick } from '../league/LeaguePickPill';

/** One mini-league page for post-deadline expanded fixture swipe. */
export type FixtureMlSwipeLeague = {
  id: string;
  name: string;
  members: Array<{
    id: string;
    name: string;
    avatar_url?: string | null;
    avatar_bg_color?: string | null;
  }>;
  /** Pick per member for this fixture. */
  picksByUserId: Map<string, LeaguePick> | Record<string, LeaguePick>;
};

export function fixtureMlPicksToMap(
  picks: FixtureMlSwipeLeague['picksByUserId']
): Map<string, LeaguePick> {
  if (picks instanceof Map) return picks;
  return new Map(Object.entries(picks ?? {})) as Map<string, LeaguePick>;
}

/** Post-deadline states where ML swipe is allowed. */
export function isFixtureMlSwipeState(gwState: string | null | undefined): boolean {
  return gwState === 'DEADLINE_PASSED' || gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
}
