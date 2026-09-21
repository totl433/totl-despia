import { getCleanPlayerClubSeed, type ClubSpell, type PlayerClubApp } from './seedApps';

export type PlayersDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type PlayersClubOption = {
  clubCode: string;
  clubName: string;
};

export type PlayersCard = {
  id: string;
  index: number;
  playerName: string;
  playerKey: string;
  correct: PlayersClubOption;
  appearances: number;
  /** Single season clue on the front, e.g. "96/97". */
  questionSeason: string | null;
  /** Full spell(s) on the reveal, e.g. "2006 - 2014 and 2016 - 2020". */
  yearsAtClub: string | null;
  difficulty: PlayersDifficulty;
  /** Three options; one is correct. */
  options: PlayersClubOption[];
};

export type PlayersPuzzle = {
  label: string;
  cards: PlayersCard[];
};

export const PLAYERS_TIMER_MS = 10000;
export const PLAYERS_CARD_COUNT = 10;

export function difficultyForApps(apps: number): PlayersDifficulty {
  if (apps >= 100) return 'easy';
  if (apps >= 40) return 'medium';
  if (apps >= 15) return 'hard';
  return 'expert';
}

export function difficultyLabel(d: PlayersDifficulty): string {
  if (d === 'easy') return 'Easy';
  if (d === 'medium') return 'Medium';
  if (d === 'hard') return 'Hard';
  return 'Expert';
}

/** "1996/97" or "96/97" → calendar start year. */
export function parseSeasonStartYear(season: string): number | null {
  const m = String(season || '')
    .trim()
    .match(/^(\d{2,4})\s*\/\s*(\d{2})$/);
  if (!m) return null;
  let y = Number(m[1]);
  if (Number.isNaN(y)) return null;
  if (y < 100) y += y >= 50 ? 1900 : 2000;
  return y;
}

/** "1996/97" → 1997 (season end calendar year). */
export function parseSeasonEndYear(season: string): number | null {
  const start = parseSeasonStartYear(season);
  if (start == null) return null;
  const m = String(season)
    .trim()
    .match(/^(\d{2,4})\s*\/\s*(\d{2})$/);
  if (!m) return null;
  let end = Math.floor(start / 100) * 100 + Number(m[2]);
  if (end < start) end += 100;
  return end;
}

/** Front clue: short season label "96/97". */
export function formatQuestionSeason(season: string): string | null {
  const start = parseSeasonStartYear(season);
  const end = parseSeasonEndYear(season);
  if (start == null || end == null) return null;
  return `${String(start % 100).padStart(2, '0')}/${String(end % 100).padStart(2, '0')}`;
}

/** One spell: "2006 - 2014". */
export function formatSpellYears(first?: string, last?: string): string | null {
  const a = (first || last || '').trim();
  const b = (last || first || '').trim();
  if (!a) return null;
  const start = parseSeasonStartYear(a);
  const end = parseSeasonEndYear(b);
  if (start == null || end == null) return null;
  if (start === end) return String(start);
  return `${start} - ${end}`;
}

/** Reveal: "2006 - 2014" or "2006 - 2014 and 2016 - 2020". */
export function formatYearsAtClub(spells: ClubSpell[]): string | null {
  const parts = spells
    .map((s) => formatSpellYears(s.firstSeason, s.lastSeason))
    .filter((x): x is string => Boolean(x));
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function seasonKey(year: number): string {
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}

/** All PL seasons from first→last inclusive (by season start year). */
export function seasonsBetween(first?: string, last?: string): string[] {
  const a = (first || last || '').trim();
  const b = (last || first || '').trim();
  if (!a) return [];
  const start = parseSeasonStartYear(a);
  const endStart = parseSeasonStartYear(b);
  if (start == null || endStart == null) return [a];
  const out: string[] = [];
  for (let y = start; y <= endStart; y++) out.push(seasonKey(y));
  return out.length ? out : [a];
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Target mix across a 10-card run (easy → harder). */
const SLOT_DIFFICULTIES: PlayersDifficulty[] = [
  'easy',
  'easy',
  'easy',
  'medium',
  'medium',
  'medium',
  'hard',
  'hard',
  'expert',
  'expert',
];

function clubsForPlayer(rows: PlayerClubApp[], playerKey: string): Set<string> {
  return new Set(rows.filter((r) => r.playerKey === playerKey).map((r) => r.clubCode));
}

function otherClubsForPlayer(
  rows: PlayerClubApp[],
  playerKey: string,
  correctCode: string
): PlayersClubOption[] {
  const seen = new Set<string>();
  const out: PlayersClubOption[] = [];
  for (const r of rows) {
    if (r.playerKey !== playerKey) continue;
    if (r.clubCode === correctCode) continue;
    if (seen.has(r.clubCode)) continue;
    seen.add(r.clubCode);
    out.push({ clubCode: r.clubCode, clubName: r.clubName });
  }
  return out;
}

/**
 * Pick 2 distractors. For the harder half (last 5), prefer at least one
 * other club that player actually played for — season is what separates them.
 */
function pickDistractors(
  allClubs: PlayersClubOption[],
  careerClubs: PlayersClubOption[],
  banned: Set<string>,
  rng: () => number,
  count: number,
  preferCareerClub: boolean
): PlayersClubOption[] {
  const picked: PlayersClubOption[] = [];
  const used = new Set<string>();

  if (preferCareerClub && careerClubs.length > 0) {
    const careerPool = shuffle(careerClubs, rng);
    const fromCareer = careerPool[0]!;
    picked.push(fromCareer);
    used.add(fromCareer.clubCode);
  }

  const filler = shuffle(
    allClubs.filter((c) => !banned.has(c.clubCode) && !used.has(c.clubCode)),
    rng
  );
  for (const c of filler) {
    if (picked.length >= count) break;
    picked.push(c);
    used.add(c.clubCode);
  }

  // If we still need slots (thin club list), allow any unused including career leftovers
  if (picked.length < count) {
    for (const c of shuffle(careerClubs.filter((c) => !used.has(c.clubCode)), rng)) {
      if (picked.length >= count) break;
      picked.push(c);
      used.add(c.clubCode);
    }
  }

  return picked.slice(0, count);
}

/**
 * Build a random 10-card Players puzzle from the local seed pack.
 * Later: swap seed for `retro_player_club_apps` when the DB is backfilled.
 */
export function createPlayersPuzzle(seed: number = Date.now()): PlayersPuzzle {
  const rng = mulberry32(seed >>> 0);
  const rows = getCleanPlayerClubSeed();

  const clubMap = new Map<string, PlayersClubOption>();
  for (const r of rows) {
    if (!clubMap.has(r.clubCode)) {
      clubMap.set(r.clubCode, { clubCode: r.clubCode, clubName: r.clubName });
    }
  }
  const allClubs = Array.from(clubMap.values());

  const byDiff: Record<PlayersDifficulty, PlayerClubApp[]> = {
    easy: [],
    medium: [],
    hard: [],
    expert: [],
  };
  for (const r of rows) {
    // Expert floor: at least 5 apps so nightmare one-offs stay optional later
    if (r.appearances < 5) continue;
    byDiff[difficultyForApps(r.appearances)].push(r);
  }

  const usedPlayers = new Set<string>();
  const cards: PlayersCard[] = [];

  for (let i = 0; i < PLAYERS_CARD_COUNT; i++) {
    const want = SLOT_DIFFICULTIES[i]!;
    const harderHalf = i >= 5;
    const band = byDiff[want].filter((r) => !usedPlayers.has(r.playerKey));
    // Last 5: prefer players with 2+ clubs so we can plant a career distractor
    const preferred = harderHalf
      ? band.filter((r) => otherClubsForPlayer(rows, r.playerKey, r.clubCode).length > 0)
      : band;
    const pool = shuffle(preferred.length ? preferred : band, rng);
    // Fallback to any unused row if a band is thin
    const pick =
      pool[0] ??
      shuffle(
        rows.filter((r) => {
          if (r.appearances < 5 || usedPlayers.has(r.playerKey)) return false;
          if (!harderHalf) return true;
          return otherClubsForPlayer(rows, r.playerKey, r.clubCode).length > 0;
        }),
        rng
      )[0] ??
      shuffle(
        rows.filter((r) => r.appearances >= 5 && !usedPlayers.has(r.playerKey)),
        rng
      )[0];

    if (!pick) break;
    usedPlayers.add(pick.playerKey);

    const correct = { clubCode: pick.clubCode, clubName: pick.clubName };
    const banned = clubsForPlayer(rows, pick.playerKey);
    const careerOthers = otherClubsForPlayer(rows, pick.playerKey, pick.clubCode);
    const distractors = pickDistractors(allClubs, careerOthers, banned, rng, 2, harderHalf);
    const options = shuffle([correct, ...distractors], rng);
    const spells = pick.spells?.length
      ? pick.spells
      : [{ firstSeason: pick.firstSeason, lastSeason: pick.lastSeason, appearances: pick.appearances }];
    const seasonPool = spells.flatMap((s) => seasonsBetween(s.firstSeason, s.lastSeason));
    const rawQuestion =
      seasonPool[Math.floor(rng() * Math.max(1, seasonPool.length))] ??
      pick.firstSeason ??
      pick.lastSeason;

    cards.push({
      id: `${pick.playerKey}-${pick.clubCode}-${i}`,
      index: i,
      playerName: pick.playerName,
      playerKey: pick.playerKey,
      correct,
      appearances: pick.appearances,
      questionSeason: rawQuestion ? formatQuestionSeason(rawQuestion) : null,
      yearsAtClub: formatYearsAtClub(spells),
      difficulty: difficultyForApps(pick.appearances),
      options,
    });
  }

  return {
    label: 'The Players',
    cards,
  };
}
