import { buildPuzzleFromSeason } from './buildPuzzle';
import { RETRO_SEASON_PACKS } from './data/seasonPacks';

export type RetroPick = 'H' | 'D' | 'A';

export type RetroFixture = {
  id: string;
  index: number;
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  kickoffLabel: string;
  result: RetroPick;
  homeScore: number;
  awayScore: number;
  /** Final-table position that season (debug / difficulty). */
  homeFinish: number | null;
  awayFinish: number | null;
};

export type RetroPuzzle = {
  seasonKey: string;
  seasonLabel: string;
  seasonFull: string;
  fixtures: RetroFixture[];
};

export const RETRO_TIMER_MS = 10000;

/** Available Prem seasons in the admin prototype (93/94 → 25/26). */
export const RETRO_AVAILABLE_SEASON_COUNT = RETRO_SEASON_PACKS.length;

/** `93/94` → `1993/94`, `00/01` → `2000/01`. */
export function seasonFullLabel(seasonLabel: string): string {
  const [a, b] = String(seasonLabel).split('/');
  if (!a || !b) return seasonLabel;
  const start = Number(a);
  if (Number.isNaN(start)) return seasonLabel;
  const century = start >= 90 ? '19' : '20';
  return `${century}${a}/${b}`;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fresh random season + 10 fixtures each call (admin prototype — unlimited replays).
 */
export function createMockRetroPuzzle(seed: number = Date.now()): RetroPuzzle {
  const rng = mulberry32(seed >>> 0);
  const pack = RETRO_SEASON_PACKS[Math.floor(rng() * RETRO_SEASON_PACKS.length)]!;
  // Different stream for fixture shuffle so season pick doesn't correlate fixtures
  const fixtureSeed = Math.floor(rng() * 0xffffffff);
  const fixtures = buildPuzzleFromSeason(pack, fixtureSeed, 10);
  return {
    seasonKey: pack.seasonKey,
    seasonLabel: pack.seasonLabel,
    seasonFull: seasonFullLabel(pack.seasonLabel),
    fixtures,
  };
}

/** @deprecated Prefer createMockRetroPuzzle(). */
export const MOCK_RETRO_SEASON = '96/97';
export const MOCK_RETRO_SEASON_FULL = '1996/97';
export const MOCK_RETRO_SEASON_KEY = '9697';
export const MOCK_RETRO_FIXTURES: RetroFixture[] = createMockRetroPuzzle(969701).fixtures;

export function pickLabel(pick: RetroPick): string {
  if (pick === 'H') return 'Home';
  if (pick === 'A') return 'Away';
  return 'Draw';
}
