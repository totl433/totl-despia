import type { LeaguePick } from '../components/league/LeaguePickPill';

export const DEV_FAKE_LEAGUE_ID = '__dev_fake_ml_8__';
export const DEV_FAKE_LEAGUE_NAME = 'DEV: 8-Player Test League';

export const DEV_FAKE_LEAGUE_MEMBERS: Array<{
  id: string;
  name: string;
  avatar_url: string | null;
  avatar_bg_color: string;
}> = [
  { id: 'dev-u1', name: 'Alex', avatar_url: null, avatar_bg_color: '#F97316' },
  { id: 'dev-u2', name: 'Bea', avatar_url: null, avatar_bg_color: '#EF4444' },
  { id: 'dev-u3', name: 'Carl', avatar_url: null, avatar_bg_color: '#F59E0B' },
  { id: 'dev-u4', name: 'Dani', avatar_url: null, avatar_bg_color: '#22C55E' },
  { id: 'dev-u5', name: 'Elliot', avatar_url: null, avatar_bg_color: '#14B8A6' },
  { id: 'dev-u6', name: 'Faye', avatar_url: null, avatar_bg_color: '#3B82F6' },
  { id: 'dev-u7', name: 'Gus', avatar_url: null, avatar_bg_color: '#8B5CF6' },
  { id: 'dev-u8', name: 'Hana', avatar_url: null, avatar_bg_color: '#EC4899' },
];

export function isDevFakeLeagueId(leagueId: string): boolean {
  return __DEV__ && String(leagueId) === DEV_FAKE_LEAGUE_ID;
}

export function buildDevFixturePicks(memberIds: string[], fixtureIndex: number): Record<string, LeaguePick> {
  const picks: Record<string, LeaguePick> = {};
  const mode = Math.abs(Number(fixtureIndex)) % 4;

  if (mode === 0) {
    memberIds.forEach((id) => {
      picks[id] = 'H';
    });
    return picks;
  }

  if (mode === 1) {
    memberIds.forEach((id) => {
      picks[id] = 'A';
    });
    return picks;
  }

  if (mode === 2) {
    memberIds.forEach((id) => {
      picks[id] = 'D';
    });
    return picks;
  }

  const cycle: LeaguePick[] = ['H', 'D', 'A', 'H', 'A', 'D', 'H', 'A'];
  memberIds.forEach((id, idx) => {
    picks[id] = cycle[idx % cycle.length] ?? 'D';
  });
  return picks;
}
