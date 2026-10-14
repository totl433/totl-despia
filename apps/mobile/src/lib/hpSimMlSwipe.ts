import type { LeaguePick } from '../components/league/LeaguePickPill';
import type { FixtureMlSwipeLeague } from '../components/home/fixtureMlSwipeTypes';
import { buildDevFixturePicks, DEV_FAKE_LEAGUE_MEMBERS } from './devFakeLeague';

/** Simulated signed-in user for HP Sim ML swipe pages. */
export const HP_SIM_ML_USER_ID = 'dev-u3';

const HP_SIM_ML_DEFS: Array<{ id: string; name: string; memberIds: string[] }> = [
  {
    id: 'sim-ml-prem',
    name: 'Prem Predictions',
    memberIds: DEV_FAKE_LEAGUE_MEMBERS.map((m) => m.id),
  },
  {
    id: 'sim-ml-fc',
    name: 'FC Football',
    memberIds: DEV_FAKE_LEAGUE_MEMBERS.slice(0, 5).map((m) => m.id),
  },
  {
    id: 'sim-ml-sunday',
    name: 'Sunday League',
    memberIds: ['dev-u1', 'dev-u3', 'dev-u5', 'dev-u7', 'dev-u8'],
  },
];

/**
 * Fake mini-leagues + per-fixture picks for HP Simulator.
 * Uses the same 8-player avatar chip spacing via LeaguePickChipsRow.
 */
export function buildHpSimMlSwipeLeagues(fixtureIndex: number): FixtureMlSwipeLeague[] {
  const idx = Math.max(1, Math.trunc(fixtureIndex) || 1);
  return HP_SIM_ML_DEFS.map((def, leagueIdx) => {
    const members = DEV_FAKE_LEAGUE_MEMBERS.filter((m) => def.memberIds.includes(m.id));
    const picksRecord = buildDevFixturePicks(
      members.map((m) => m.id),
      (idx + leagueIdx) % 7,
      idx % 4 === 0 && leagueIdx === 0
    ) as Record<string, LeaguePick>;
    // Keep “me” on a visible pick so brand ring shows in sim.
    if (!picksRecord[HP_SIM_ML_USER_ID] && members.some((m) => m.id === HP_SIM_ML_USER_ID)) {
      picksRecord[HP_SIM_ML_USER_ID] = (['H', 'D', 'A'] as const)[(idx + leagueIdx) % 3]!;
    }
    return {
      id: def.id,
      name: def.name,
      members,
      picksByUserId: picksRecord,
    };
  });
}
